"""
Medical Transcription Service
Supports AssemblyAI and Deepgram Flux for real-time medical transcription
"""

import asyncio
import json
import logging
import os
from typing import AsyncGenerator, Dict, Optional
from datetime import datetime
from enum import Enum

from fastapi import FastAPI, WebSocket, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google.cloud import firestore, pubsub_v1, storage

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class TranscriptionProvider(str, Enum):
    """Supported transcription providers"""
    ASSEMBLYAI = "assemblyai"
    DEEPGRAM = "deepgram"


# FastAPI app
app = FastAPI(
    title="Medical Transcription Service",
    description="Real-time medical transcription with AssemblyAI & Deepgram Flux"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
PROJECT_ID = os.getenv('GCP_PROJECT_ID', 'transcriberx-477408')
ASSEMBLYAI_API_KEY = os.getenv('ASSEMBLYAI_API_KEY')
DEEPGRAM_API_KEY = os.getenv('DEEPGRAM_API_KEY')
DEFAULT_PROVIDER = os.getenv('TRANSCRIPTION_PROVIDER', 'assemblyai')
USE_FIRESTORE = os.getenv('USE_FIRESTORE', 'true').lower() == 'true'

# Validate at least one API key is set
if not ASSEMBLYAI_API_KEY and not DEEPGRAM_API_KEY:
    logger.error("Neither ASSEMBLYAI_API_KEY nor DEEPGRAM_API_KEY is set!")
    raise ValueError("At least one transcription API key is required")

# Initialize GCP clients
db = None
publisher = None

if USE_FIRESTORE:
    try:
        db = firestore.Client(project=PROJECT_ID)
        publisher = pubsub_v1.PublisherClient()
        logger.info("✓ Firestore and Pub/Sub initialized")
    except Exception as e:
        logger.warning(f"Failed to initialize Firestore/PubSub: {e}. Running without persistence.")
        db = None
        publisher = None

logger.info(f"✓ Medical Transcription Service started")
logger.info(f"✓ GCP Project: {PROJECT_ID}")
logger.info(f"✓ Default Provider: {DEFAULT_PROVIDER}")
logger.info(f"✓ Available: AssemblyAI={bool(ASSEMBLYAI_API_KEY)}, Deepgram={bool(DEEPGRAM_API_KEY)}")


# ============================================================================
# ASSEMBLYAI TRANSCRIPTION
# ============================================================================

async def transcribe_assemblyai(
    audio_stream: AsyncGenerator[bytes, None],
    session_id: str
) -> AsyncGenerator[Dict, None]:
    """
    Transcribe using AssemblyAI Real-time API with real-time processing.
    """
    import assemblyai as aai
    from assemblyai import RealtimeTranscriber
    import queue
    import threading
    
    logger.info(f"[AssemblyAI] Starting real-time transcription for session {session_id}")

    # Queues for coordination
    result_queue = asyncio.Queue()
    audio_queue_sync = queue.Queue()
    transcription_complete = asyncio.Event()
    
    # Configure AssemblyAI
    aai.settings.api_key = ASSEMBLYAI_API_KEY
    
    # Create RealtimeTranscriber
    transcriber = RealtimeTranscriber(
        sample_rate=16000,
        on_data=lambda transcript: asyncio.run_coroutine_threadsafe(
            result_queue.put({
                'text': transcript.text if transcript.text else '',
                'is_final': transcript.message_type == 'FinalTranscript',
                'session_id': session_id,
                'provider': 'assemblyai',
                'timestamp': datetime.now().isoformat(),
                'confidence': transcript.confidence if hasattr(transcript, 'confidence') else 0.95
            }),
            asyncio.get_event_loop()
        ) if transcript.text else None,
        on_error=lambda error: logger.error(f"[AssemblyAI] Error: {error}"),
        on_open=lambda session: logger.info(f"[AssemblyAI] Session opened: {session}"),
        on_close=lambda: transcription_complete.set()
    )
    
    # Connect
    transcriber.connect()
    logger.info("[AssemblyAI] Connected successfully")
    
    # Start streaming in a thread
    def run_streaming():
        try:
            while not transcription_complete.is_set():
                try:
                    chunk = audio_queue_sync.get(timeout=1.0)
                    if chunk == b'END_OF_STREAM':
                        break
                    transcriber.stream(chunk)
                except queue.Empty:
                    continue
        except Exception as e:
            logger.error(f"[AssemblyAI] Streaming thread error: {e}")
        finally:
            transcriber.close()
            transcription_complete.set()
    
    stream_thread = threading.Thread(target=run_streaming, daemon=True)
    stream_thread.start()
    
    # Feed audio from async stream to sync queue
    async def feed_audio():
        try:
            async for chunk in audio_stream:
                if chunk == b'END_OF_STREAM':
                    logger.info("[AssemblyAI] End of stream")
                    audio_queue_sync.put(b'END_OF_STREAM')
                    break
                audio_queue_sync.put(chunk)
        except Exception as e:
            logger.error(f"[AssemblyAI] Feed audio error: {e}")
            transcription_complete.set()
    
    feed_task = asyncio.create_task(feed_audio())
    
    # Yield results
    try:
        while not transcription_complete.is_set() or not result_queue.empty():
            try:
                result = await asyncio.wait_for(result_queue.get(), timeout=0.1)
                yield result
            except asyncio.TimeoutError:
                continue
    finally:
        await feed_task
        client.disconnect(terminate=True)
        stream_thread.join(timeout=2)
        logger.info("[AssemblyAI] Transcription session ended")


# ============================================================================
# DEEPGRAM TRANSCRIPTION
# ============================================================================

async def transcribe_deepgram(
    audio_stream: AsyncGenerator[bytes, None],
    session_id: str
) -> AsyncGenerator[Dict, None]:
    """
    Transcribe using Deepgram REST API with streaming.
    Buffers audio and sends chunks periodically for transcription.
    """
    import aiohttp
    from io import BytesIO
    
    logger.info(f"[Deepgram] Starting transcription for session {session_id}")
    
    try:
        # Collect audio in memory
        audio_buffer = BytesIO()
        chunk_count = 0
        
        logger.info("[Deepgram] Buffering audio stream...")
        async for chunk in audio_stream:
            if chunk == b'END_OF_STREAM':
                logger.info("[Deepgram] End of stream signal received")
                break
            
            audio_buffer.write(chunk)
            chunk_count += 1
            
            if chunk_count % 100 == 0:
                logger.info(f"[Deepgram] Buffered {chunk_count} chunks ({audio_buffer.tell()} bytes)")
        
        audio_data = audio_buffer.getvalue()
        logger.info(f"[Deepgram] Total audio: {chunk_count} chunks, {len(audio_data)} bytes")
        
        if len(audio_data) == 0:
            logger.warning("[Deepgram] No audio data to transcribe")
            return
        
        # Send to Deepgram REST API
        deepgram_url = "https://api.deepgram.com/v1/listen"
        
        headers = {
            "Authorization": f"Token {DEEPGRAM_API_KEY}",
            "Content-Type": "application/octet-stream"
        }
        
        params = {
            "model": "nova-2",
            "language": "en-US",
            "encoding": "linear16",
            "sample_rate": "16000",
            "channels": "1",
            "punctuate": "true",
            "smart_format": "true",
            "diarize": "true"
        }
        
        logger.info(f"[Deepgram] Sending {len(audio_data)} bytes to REST API...")
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                deepgram_url,
                headers=headers,
                params=params,
                data=audio_data
            ) as response:
                if response.status != 200:
                    error_text = await response.text()
                    logger.error(f"[Deepgram] API error {response.status}: {error_text}")
                    raise Exception(f"Deepgram API error: {response.status}")
                
                result_data = await response.json()
                logger.info(f"[Deepgram] Received response")
                
                # Parse results
                if "results" not in result_data or "channels" not in result_data["results"]:
                    logger.warning("[Deepgram] No results in response")
                    return
                
                channels = result_data["results"]["channels"]
                if not channels:
                    logger.warning("[Deepgram] Empty channels in response")
                    return
                
                # Process each channel
                for channel_idx, channel in enumerate(channels):
                    if "alternatives" not in channel or not channel["alternatives"]:
                        continue
                    
                    alternative = channel["alternatives"][0]
                    transcript = alternative.get("transcript", "")
                    
                    if not transcript:
                        logger.info("[Deepgram] Empty transcript in response")
                        continue
                    
                    logger.info(f"[Deepgram] Transcript: {transcript[:100]}...")
                    
                    # Build result
                    result = {
                        "text": transcript,
                        "is_final": True,
                        "session_id": session_id,
                        "provider": "deepgram",
                        "timestamp": datetime.now().isoformat(),
                        "confidence": alternative.get("confidence", 0.95)
                    }
                    
                    # Add word-level details
                    if "words" in alternative:
                        result["words"] = [
                            {
                                "word": w.get("word", ""),
                                "confidence": w.get("confidence", 0.95),
                                "start": w.get("start", 0),
                                "end": w.get("end", 0),
                                "speaker": w.get("speaker", None)
                            }
                            for w in alternative["words"]
                        ]
                        
                        # Extract speaker info
                        speakers = [w.get("speaker") for w in alternative.get("words", []) if w.get("speaker") is not None]
                        if speakers:
                            result["speaker"] = max(set(speakers), key=speakers.count)
                    
                    logger.info(f"[Deepgram] Yielding result")
                    yield result
    
    except Exception as e:
        logger.error(f"[Deepgram] Transcription error: {e}", exc_info=True)
        raise
    finally:
        logger.info("[Deepgram] Transcription session ended")


# ============================================================================
# FASTAPI ENDPOINTS
# ============================================================================

class SessionRequest(BaseModel):
    patient_id: str
    doctor_id: str
    provider: Optional[str] = None


class SessionResponse(BaseModel):
    session_id: str
    status: str
    provider: str


@app.post("/v1/sessions", response_model=SessionResponse)
async def create_session(request: SessionRequest):
    """Create new transcription session"""
    import uuid

    session_id = str(uuid.uuid4())
    provider = request.provider or DEFAULT_PROVIDER
    
    # Validate provider and API key availability
    if provider == TranscriptionProvider.ASSEMBLYAI and not ASSEMBLYAI_API_KEY:
        raise HTTPException(status_code=400, detail="AssemblyAI API key not configured")
    if provider == TranscriptionProvider.DEEPGRAM and not DEEPGRAM_API_KEY:
        raise HTTPException(status_code=400, detail="Deepgram API key not configured")
    
    # Validate provider
    try:
        TranscriptionProvider(provider)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid provider '{provider}'. Must be 'assemblyai' or 'deepgram'"
        )

    # Initialize session in Firestore
    if db:
        try:
            session_ref = db.collection('sessions').document(session_id)
            session_ref.set({
                'patient_id': request.patient_id,
                'doctor_id': request.doctor_id,
                'provider': provider,
                'status': 'created',
                'created_at': firestore.SERVER_TIMESTAMP
            })
        except Exception as e:
            logger.warning(f"Failed to save session to Firestore: {e}")

    logger.info(f"Created session {session_id} with {provider}")

    return SessionResponse(
        session_id=session_id,
        status='created',
        provider=provider
    )


@app.websocket("/v1/transcribe/stream")
async def transcribe_websocket(websocket: WebSocket, session_id: str):
    """
    WebSocket endpoint for real-time transcription

    Query params:
        - session_id: Session ID created via POST /v1/sessions

    Audio format:
        - PCM 16-bit signed integer
        - 16kHz sample rate
        - Mono channel
    """
    logger.info(f"[WebSocket] Connection request for session {session_id}")

    try:
        await websocket.accept()
        logger.info(f"[WebSocket] Connection accepted for session {session_id}")

        # Get session details and determine provider
        provider = DEFAULT_PROVIDER
        session_ref = None
        
        if db:
            try:
                session_ref = db.collection('sessions').document(session_id)
                session_doc = await asyncio.to_thread(session_ref.get)

                if session_doc.exists:
                    session_data = session_doc.to_dict()
                    provider = session_data.get('provider', DEFAULT_PROVIDER)
                    session_ref.update({
                        'status': 'streaming',
                        'started_at': firestore.SERVER_TIMESTAMP
                    })
            except Exception as e:
                logger.warning(f"[WebSocket] Firestore access failed: {e}")

        logger.info(f"[WebSocket] Using {provider} for session {session_id}")

        # Create audio stream generator from WebSocket
        async def audio_generator():
            try:
                chunk_count = 0
                while True:
                    try:
                        data = await asyncio.wait_for(websocket.receive_bytes(), timeout=30.0)

                        if data == b'END_OF_STREAM':
                            logger.info(f"[WebSocket] END_OF_STREAM signal received")
                            yield b'END_OF_STREAM'
                            break

                        chunk_count += 1
                        if chunk_count % 100 == 0:
                            logger.debug(f"[WebSocket] Received {chunk_count} audio chunks")

                        yield data

                    except asyncio.TimeoutError:
                        logger.warning(f"[WebSocket] No data for 30s, ending stream")
                        yield b'END_OF_STREAM'
                        break
                    except Exception as e:
                        logger.error(f"[WebSocket] Error receiving data: {e}")
                        break

            except Exception as e:
                logger.error(f"[WebSocket] Audio generator error: {e}")
                raise

        # Select transcription function based on provider
        if provider == TranscriptionProvider.DEEPGRAM:
            transcribe_func = transcribe_deepgram
        else:
            transcribe_func = transcribe_assemblyai

        # Start transcription
        result_count = 0
        try:
            async for result in transcribe_func(audio_generator(), session_id):
                # Add session context
                result['session_id'] = session_id

                # Send to client
                await websocket.send_json(result)
                result_count += 1

                # Save final transcripts to Firestore
                if result.get('is_final') and db and session_ref:
                    try:
                        session_ref.update({
                            'transcript': firestore.ArrayUnion([result])
                        })
                    except Exception as e:
                        logger.error(f"Failed to save to Firestore: {e}")

                    # Publish to Pub/Sub for downstream processing
                    if publisher:
                        try:
                            await publish_transcript(session_id, result)
                        except Exception as e:
                            logger.error(f"Failed to publish transcript: {e}")

            logger.info(f"[WebSocket] Transcription completed, sent {result_count} results")

            # Update session status
            if db and session_ref:
                try:
                    session_ref.update({
                        'status': 'completed',
                        'ended_at': firestore.SERVER_TIMESTAMP,
                        'total_results': result_count
                    })
                except Exception as e:
                    logger.warning(f"Failed to update session status: {e}")

        except Exception as transcription_error:
            logger.error(f"[WebSocket] Transcription error: {transcription_error}", exc_info=True)
            await websocket.send_json({'error': f'Transcription failed: {str(transcription_error)}'})

            # Update error status
            if db and session_ref:
                try:
                    session_ref.update({
                        'status': 'error',
                        'error': str(transcription_error),
                        'ended_at': firestore.SERVER_TIMESTAMP
                    })
                except Exception as e:
                    logger.warning(f"Failed to update error status: {e}")

    except Exception as e:
        logger.error(f"[WebSocket] WebSocket error: {str(e)}", exc_info=True)
        try:
            await websocket.send_json({'error': str(e)})
        except:
            pass
    finally:
        try:
            await websocket.close()
            logger.info(f"[WebSocket] Connection closed for session {session_id}")
        except:
            pass


async def publish_transcript(session_id: str, transcript_data: Dict):
    """Publish transcript to Pub/Sub for disease detection and processing"""
    try:
        topic_path = publisher.topic_path(PROJECT_ID, 'transcript-events')

        message_data = json.dumps({
            'session_id': session_id,
            'transcript': transcript_data,
            'timestamp': datetime.utcnow().isoformat()
        }).encode('utf-8')

        future = publisher.publish(topic_path, message_data)
        await asyncio.to_thread(future.result)

        logger.debug(f"Published transcript for session {session_id}")

    except Exception as e:
        logger.error(f"Failed to publish transcript: {str(e)}")
        raise


@app.post("/v1/sessions/{session_id}/end")
async def end_session(session_id: str):
    """End transcription session and generate final transcript"""
    if not db:
        raise HTTPException(status_code=503, detail="Firestore not available")
    
    try:
        session_ref = db.collection('sessions').document(session_id)
        session_doc = await asyncio.to_thread(session_ref.get)

        if not session_doc.exists:
            raise HTTPException(status_code=404, detail=f"Session {session_id} not found")

        session_data = session_doc.to_dict()

        # Generate full transcript
        transcript_segments = session_data.get('transcript', [])
        full_transcript = generate_full_transcript(transcript_segments)

        # Save to Cloud Storage
        storage_client = storage.Client()
        bucket_name = f"{PROJECT_ID}-transcripts"
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(f"transcripts/{session_id}.txt")

        await asyncio.to_thread(
            blob.upload_from_string,
            full_transcript,
            content_type='text/plain'
        )

        # Update session
        session_ref.update({
            'status': 'finalized',
            'finalized_at': firestore.SERVER_TIMESTAMP,
            'storage_path': f"gs://{bucket_name}/transcripts/{session_id}.txt"
        })

        return {
            'session_id': session_id,
            'status': 'finalized',
            'full_transcript': full_transcript,
            'word_count': len(full_transcript.split()),
            'provider': session_data.get('provider')
        }

    except Exception as e:
        logger.error(f"Error ending session {session_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


def generate_full_transcript(transcript_segments: list) -> str:
    """Generate formatted full transcript"""
    transcript_lines = []
    
    for segment in transcript_segments:
        if not segment.get('is_final'):
            continue
        
        timestamp = segment.get('timestamp', '')
        text = segment.get('text', '')
        provider = segment.get('provider', '')
        
        transcript_lines.append(f"[{timestamp}] [{provider}] {text}")
    
    return '\n\n'.join(transcript_lines)


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "transcription",
        "version": "4.0.0",
        "providers": {
            "assemblyai": bool(ASSEMBLYAI_API_KEY),
            "deepgram": bool(DEEPGRAM_API_KEY)
        },
        "default_provider": DEFAULT_PROVIDER
    }


@app.get("/info")
async def service_info():
    """Get service information"""
    return {
        "project_id": PROJECT_ID,
        "firestore_enabled": USE_FIRESTORE,
        "default_provider": DEFAULT_PROVIDER,
        "available_providers": {
            "assemblyai": {
                "available": bool(ASSEMBLYAI_API_KEY),
                "features": [
                    "Real-time streaming",
                    "Speaker diarization",
                    "Medical vocabulary",
                    "High accuracy"
                ]
            },
            "deepgram": {
                "available": bool(DEEPGRAM_API_KEY),
                "model": "flux-general-en",
                "features": [
                    "Ultra-low latency (~260ms)",
                    "Smart turn detection",
                    "Voice Activity Detection",
                    "Nova-3 accuracy"
                ]
            }
        },
        "audio_format": {
            "encoding": "PCM 16-bit",
            "sample_rate": "16kHz",
            "channels": "Mono"
        }
    }


if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv('PORT', 8080))
    logger.info(f"Starting Medical Transcription Service on port {port}")
    
    uvicorn.run(app, host="0.0.0.0", port=port)
