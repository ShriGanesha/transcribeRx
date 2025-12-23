import React, { useEffect, useRef, useState } from "react";
import { LoginPage } from "./pages/LoginPage";
import { Dashboard } from "./pages/Dashboard";
import { DataProvider } from "./context/DataContext";

type Turn = {
  turn: number;
  speaker: string;
  start: number;
  end: number;
  text?: string;
};

type Report = {
  chief_complaint?: string;
  subjective_summary?: string;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  key_symptoms?: string[];
  red_flags?: string[];
  differentials?: Array<{ condition: string; rationale: string }>;
  risk_level?: string;
  recommended_next_steps?: string[];
  patient_friendly_summary?: string;
  raw_summary?: string;
  icd10_codes?: string[];
  pdf_url?: string;
};


type DiseaseHighlight = {
  disease: string;
  disease_name?: string;
  icd10_code?: string;
  confidence: number;
  severity: 'low' | 'medium' | 'high';
  position: { start: number; end: number };
  supporting_symptoms?: string[];
};

type Recommendation = {
  recommendation: string;
  category: string;
  priority: string;
  rationale: string;
};

type Doctor = {
  id: string;
  name: string;
  email: string;
  specialty: string;
  department: string;
  avatar: string;
};

export default function App() {
  const [currentDoctor, setCurrentDoctor] = useState<Doctor | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [diseases, setDiseases] = useState<DiseaseHighlight[]>([]);
  const [liveTranscript, setLiveTranscript] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isLiveTranscribing, setIsLiveTranscribing] = useState(false);
  const [liveTranscriptHistory, setLiveTranscriptHistory] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [soapNote, setSoapNote] = useState<Report | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isRecording, setIsRecording] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioNodesRef = useRef<{source: MediaStreamAudioSourceNode | null, processor: ScriptProcessorNode | null} | null>(null);
  const timerRef = useRef<number | null>(null);
  const diseaseDetectionTimerRef = useRef<number | null>(null);
  const lastDetectedTextRef = useRef<string>('');
  
  const TRANSCRIPTION_URL = process.env.REACT_APP_TRANSCRIPTION_URL || 'https://transcription-service-7748133863.us-central1.run.app';
  const DISEASE_DETECTION_URL = process.env.REACT_APP_DISEASE_DETECTION_URL || 'https://disease-detection-service-7748133863.us-central1.run.app';
  const SOAP_GENERATOR_URL = process.env.REACT_APP_SOAP_GENERATOR_URL || 'https://soap-generator-service-7748133863.us-central1.run.app';
  const RECOMMENDATIONS_URL = process.env.REACT_APP_RECOMMENDATIONS_URL || 'https://recommendations-service-7748133863.us-central1.run.app';
  
  useEffect(() => {
    console.log('=== SERVICE CONFIGURATION ===');
    console.log('Transcription URL:', TRANSCRIPTION_URL);
    console.log('Disease Detection URL:', DISEASE_DETECTION_URL);
    console.log('SOAP Generator URL:', SOAP_GENERATOR_URL);
    console.log('Recommendations URL:', RECOMMENDATIONS_URL);
    console.log('============================');
    
    checkServiceHealth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkServiceHealth = async () => {
    console.log('[Health] 🔍 Checking service health...');
    const services = [
      { name: 'Transcription', url: TRANSCRIPTION_URL },
      { name: 'Disease Detection', url: DISEASE_DETECTION_URL },
      { name: 'SOAP Generator', url: SOAP_GENERATOR_URL },
      { name: 'Recommendations', url: RECOMMENDATIONS_URL }
    ];

    for (const service of services) {
      try {
        const response = await fetch(`${service.url}/health`, {
          method: 'GET',
          mode: 'cors'
        });
        if (response.ok) {
          console.log(`[Health] ✅ ${service.name} service is healthy`);
        } else {
          console.warn(`[Health] ⚠️  ${service.name} returned status ${response.status}`);
        }
      } catch (error) {
        console.warn(`[Health] ❌ ${service.name} service unreachable:`, error instanceof Error ? error.message : String(error));
      }
    }
  };

  const testSessionCreation = async () => {
    console.log('[Test] 🧪 Testing session creation...');
    try {
      const sessionUrl = `${TRANSCRIPTION_URL}/v1/sessions`;
      console.log('[Test] Calling:', sessionUrl);
      
      const response = await fetch(sessionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: 'TEST-P-' + Math.random().toString(36).substr(2, 9),
          doctor_id: 'TEST-D-' + Math.random().toString(36).substr(2, 9),
          provider: 'deepgram'
        }),
        mode: 'cors'
      });

      console.log('[Test] Response status:', response.status, response.statusText);
      const data = await response.json();
      console.log('[Test] ✅ Session creation successful:', data);
      return data;
    } catch (error) {
      console.error('[Test] ❌ Session creation failed:', error);
      return null;
    }
  };

  const testServiceDiagnostic = async () => {
    console.log('[Test] 🧪 Testing service diagnostic...');
    try {
      const diagnosticUrl = `${TRANSCRIPTION_URL}/diagnostic`;
      console.log('[Test] Calling:', diagnosticUrl);
      
      const response = await fetch(diagnosticUrl, {
        method: 'GET',
        mode: 'cors'
      });

      console.log('[Test] Response status:', response.status);
      const data = await response.json();
      console.log('[Test] ✅ Diagnostic info:', data);
      
      if (!data.deepgram_api_key_set && !data.assemblyai_api_key_set) {
        alert('⚠️ WARNING: No transcription API keys are configured!\nDeepgram API Key: ' + data.deepgram_api_key_set + '\nAssemblyAI API Key: ' + data.assemblyai_api_key_set);
      }
      
      return data;
    } catch (error) {
      console.error('[Test] ❌ Diagnostic failed:', error);
      return null;
    }
  };

  useEffect(() => {
    (window as any).testSessionCreation = testSessionCreation;
    (window as any).checkServiceHealth = checkServiceHealth;
    (window as any).testServiceDiagnostic = testServiceDiagnostic;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  useEffect(() => {
    if (!isRecording) return;

    timerRef.current = window.setInterval(() => {
      setRecordingTime(prev => prev + 1);
    }, 1000);

    initializeLiveTranscription();

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording]);
  
  const startSession = async () => {
    try {
      setLoading(true);
      const sessionUrl = `${TRANSCRIPTION_URL}/v1/sessions`;
      console.log('[Session] 🔄 Creating new session at:', sessionUrl);
      console.log('[Session] TRANSCRIPTION_URL env:', process.env.REACT_APP_TRANSCRIPTION_URL);
      
      const payload = {
        patient_id: 'P-' + Math.random().toString(36).substr(2, 9),
        doctor_id: 'D-' + Math.random().toString(36).substr(2, 9)
      };
      console.log('[Session] Request payload:', payload);
      
      const response = await fetch(sessionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        mode: 'cors'
      });
      
      console.log('[Session] Response status:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Session] ❌ Failed to create session:', response.status);
        console.error('[Session] Error response:', errorText);
        const errorMsg = `Failed to create session: ${response.status} - ${response.statusText}. 
        This might be a CORS issue or the service is not responding. 
        Check browser console (F12) for details. Service URL: ${sessionUrl}`;
        throw new Error(errorMsg);
      }
      
      const data = await response.json();
      console.log('[Session] ✅ Session created successfully:', data);
      setSession(data);
      setLoading(false);
    } catch (error) {
      console.error('[Session] ❌ Error starting session:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[Session] Error details:', errorMsg);
      alert(`Failed to start session: ${errorMsg}`);
      setLoading(false);
    }
  };
  
  const startRecording = async () => {
    if (!session) {
      alert('Please start a session first');
      return;
    }
    
    try {
      console.log('[Recording] 🎤 Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('[Recording] ✅ Microphone access granted');
      
      const buildWsUrl = (base: string) => {
        try {
          const u = new URL(base);
          const wsProtocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
          return `${wsProtocol}//${u.host}${u.pathname.replace(/\/$/, '')}/v1/transcribe/stream?session_id=${session.session_id}`;
        } catch (e) {
          console.warn('Invalid TRANSCRIPTION_URL, falling back:', e);
          return `${base.replace(/^https:/,'wss:').replace(/^http:/,'ws:')}/v1/transcribe/stream?session_id=${session.session_id}`;
        }
      };
      const wsUrl = buildWsUrl(TRANSCRIPTION_URL);
      console.log('[Recording] 🔌 Connecting to WebSocket:', wsUrl);
      console.log('[Recording] Session ID:', session.session_id);
      wsRef.current = new WebSocket(wsUrl);
      
      setIsLiveTranscribing(true);
      
      wsRef.current.onopen = () => {
        console.log('[Recording] ✅ WebSocket connected successfully');
        setIsConnected(true);
        setIsRecording(true);
      };

      wsRef.current.onmessage = (event) => {
        console.log('[Recording] 📨 Message received, type:', typeof event.data, 'length:', event.data?.length || event.data?.byteLength || 'unknown');
        
        try {
          let data;
          if (typeof event.data === 'string') {
            console.log('[Recording] 📨 String message (first 100 chars):', event.data.substring(0, 100));
            data = JSON.parse(event.data);
          } else if (event.data instanceof ArrayBuffer) {
            console.log('[Recording] ⚠️ Received binary ArrayBuffer, length:', event.data.byteLength);
            return;
          } else {
            console.log('[Recording] ⚠️ Received unknown data type:', typeof event.data);
            return;
          }

          if (data.error) {
            console.error('[Recording] ❌ Error from server:', data.error);
            alert('Transcription error: ' + data.error);
            return;
          }

          if (data.text) {
            console.log('[Recording] 📝 Transcription:', data.text);
          
            let formattedText = data.text;
            if (data.words && data.words.length > 0) {
              const speakerGroups: { [key: string]: string[] } = {};
              data.words.forEach((word: any) => {
                const speaker = word.speaker_tag || 'SPEAKER_1';
                if (!speakerGroups[speaker]) {
                  speakerGroups[speaker] = [];
                }
                speakerGroups[speaker].push(word.word);
              });
              
              formattedText = Object.entries(speakerGroups)
                .map(([speaker, words]) => {
                  const speakerLabel = speaker === 'SPEAKER_2' ? 'Patient' : 'Doctor';
                  return `${speakerLabel}: ${words.join(' ')}`;
                })
                .join('\n');
            }
            
            if (data.is_final) {
              console.log('[Recording] ✅ Final transcript received');
              setLiveTranscriptHistory(prev => [...prev, formattedText]);
              setLiveTranscript('');
              detectDiseases(formattedText);
            } else {
              setLiveTranscript(formattedText);
              if (data.text.split(' ').length >= 5) {
                detectDiseasesDebounced(data.text);
              }
            }
          }
        } catch (error) {
          console.error('[Recording] ❌ Error parsing message:', error);
        }
      };

      wsRef.current.onclose = (event) => {
        console.log('[Recording] 🔴 WebSocket closed');
        console.log('[Recording] Close code:', event.code, '| Reason:', event.reason || '(no reason)');
        console.log('[Recording] Clean close?:', event.code === 1000);
        setIsConnected(false);
        if (event.code !== 1000) {
          console.error('[Recording] ⚠️ WebSocket closed unexpectedly with code:', event.code);
          if (event.reason) {
            console.error('[Recording] Close reason:', event.reason);
          }
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('[Recording] 🔴 WebSocket error event:', error);
        console.error('[Recording] Error type:', error instanceof Event ? 'Event object' : typeof error);
        console.error('[Recording] WebSocket readyState:', wsRef.current?.readyState);
        setIsConnected(false);
      };
      
      console.log('[Recording] 🔊 Creating audio context...');
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      const source = audioContextRef.current.createMediaStreamSource(stream);
      console.log('[Recording] ✅ Audio context created, sample rate:', audioContextRef.current.sampleRate);

      const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      let audioChunkCount = 0;
      processor.onaudioprocess = (event) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          const inputBuffer = event.inputBuffer;
          const inputData = inputBuffer.getChannelData(0);
          const pcm = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            pcm[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32767));
          }
          wsRef.current.send(pcm.buffer);
          audioChunkCount++;
          
          if (audioChunkCount % 10 === 0) {
            console.log('[Recording] 🎵 Sent audio chunks:', audioChunkCount, 'bytes:', pcm.byteLength);
          }
        } else {
          if (audioChunkCount === 0) {
            console.warn('[Recording] ⚠️ WebSocket not open, readyState:', wsRef.current?.readyState);
          }
        }
      };

      source.connect(processor);
      processor.connect(audioContextRef.current.destination);

      audioNodesRef.current = { source, processor };
      
      const monitorInterval = setInterval(() => {
        if (wsRef.current) {
          const readyState = wsRef.current.readyState;
          const states = ['CONNECTING(0)', 'OPEN(1)', 'CLOSING(2)', 'CLOSED(3)'];
          console.log('[Monitor] WebSocket state:', states[readyState], '| Audio chunks sent:', audioChunkCount);
        }
      }, 5000);
      
      (window as any).__recordingMonitor = monitorInterval;
      
    } catch (error) {
      console.error('[Recording] ❌ Failed to start recording:', error);
      alert('Failed to access microphone: ' + (error instanceof Error ? error.message : String(error)));
    }
  };
  
  const stopRecording = async () => {
    if (audioNodesRef.current) {
      audioNodesRef.current.source?.disconnect();
      audioNodesRef.current.processor?.disconnect();
      audioNodesRef.current = null;
    }

    if (wsRef.current) {
      try {
        const state = wsRef.current.readyState;
        if (state === WebSocket.OPEN) {
          wsRef.current.send('END_OF_STREAM');
        }
        if (state !== WebSocket.CLOSING && state !== WebSocket.CLOSED) {
          wsRef.current.close(1000, 'Client stopped');
        }
      } catch (e) {
        console.warn('WebSocket finalize error:', e);
      }
    }

    setIsRecording(false);
    setIsConnected(false);
    setIsLiveTranscribing(false);

    if (session) {
      await generateSOAP();
      await generateRecommendations();
    }
  };
  
  const detectDiseasesDebounced = (text: string) => {
    if (diseaseDetectionTimerRef.current) {
      clearTimeout(diseaseDetectionTimerRef.current);
    }

    if (text.length < 10) return;
    
    const similarity = calculateSimilarity(lastDetectedTextRef.current, text);
    if (similarity > 0.85) {
      console.log('[DiseaseDetection] Text too similar to last detection, skipping');
      return;
    }

    diseaseDetectionTimerRef.current = window.setTimeout(() => {
      console.log('[DiseaseDetection] Triggering detection for text:', text.substring(0, 50) + '...');
      lastDetectedTextRef.current = text;
      detectDiseases(text);
    }, 1500);
  };

  const calculateSimilarity = (text1: string, text2: string): number => {
    if (!text1 || !text2) return 0;
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    return union.size > 0 ? intersection.size / union.size : 0;
  };

  const detectDiseases = async (text: string) => {
    if (!session) {
      console.log('[DiseaseDetection] No session, skipping');
      return;
    }

    try {
      console.log('[DiseaseDetection] Calling API:', DISEASE_DETECTION_URL);
      console.log('[DiseaseDetection] Text:', text);

      const response = await fetch(`${DISEASE_DETECTION_URL}/v1/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session.session_id,
          transcript: text
        })
      });

      if (!response.ok) {
        console.error(`[DiseaseDetection] HTTP ${response.status}: ${response.statusText}`);
        const errorText = await response.text();
        console.error('[DiseaseDetection] Error response:', errorText);
        return;
      }

      const data = await response.json();
      console.log('[DiseaseDetection] Response:', data);

      if (data.detections && data.detections.length > 0) {
        console.log('[DiseaseDetection] Found', data.detections.length, 'diseases');
        setDiseases(prev => {
          const existing = new Set(prev.map((d: DiseaseHighlight) => d.disease_name));
          const newDetections = data.detections.filter((d: DiseaseHighlight) => !existing.has(d.disease_name));
          return [...prev, ...newDetections];
        });
      }
    } catch (error) {
      console.error('[DiseaseDetection] Failed:', error);
    }
  };
  
  const generateSOAP = async () => {
    if (!session) {
      console.log('[SOAP] No session, skipping');
      return;
    }

    const fullTranscript = liveTranscriptHistory.join('\n\n');

    if (!fullTranscript || fullTranscript.trim().length === 0) {
      console.error('[SOAP] No transcript available');
      alert('No transcript available. Please record some conversation first.');
      return;
    }

    setLoading(true);
    console.log('[SOAP] Generating SOAP note for session:', session.session_id);
    console.log('[SOAP] Full transcript length:', fullTranscript.length);
    console.log('[SOAP] Detected diseases:', diseases.length);

    try {
      const response = await fetch(`${SOAP_GENERATOR_URL}/v1/soap/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session.session_id,
          transcript: fullTranscript,
          detected_diseases: diseases.map(d => ({
            disease_name: d.disease_name || d.disease,
            icd10_code: d.icd10_code,
            confidence: d.confidence,
            severity: d.severity
          })),
          specialty: 'general'
        })
      });

      if (!response.ok) {
        console.error(`[SOAP] HTTP ${response.status}: ${response.statusText}`);
        const errorText = await response.text();
        console.error('[SOAP] Error response:', errorText);
        alert(`Failed to generate SOAP note: ${response.statusText}`);
        return;
      }

      const data = await response.json();
      console.log('[SOAP] Response:', data);
      setSoapNote(data);
    } catch (error) {
      console.error('[SOAP] Failed:', error);
      alert('Failed to generate SOAP note. Check console for details.');
    } finally {
      setLoading(false);
    }
  };
  
  const generateRecommendations = async () => {
    if (!session) return;

    const fullTranscript = liveTranscriptHistory.join('\n\n');

    if (!fullTranscript || fullTranscript.trim().length === 0) {
      console.error('[Recommendations] No transcript available');
      return;
    }

    setLoading(true);
    console.log('[Recommendations] Generating for session:', session.session_id);
    console.log('[Recommendations] Transcript length:', fullTranscript.length);
    console.log('[Recommendations] Detected diseases:', diseases.length);

    try {
      const response = await fetch(`${RECOMMENDATIONS_URL}/v1/recommendations/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session.session_id,
          transcript: fullTranscript,
          detected_diseases: diseases.map(d => ({
            disease_name: d.disease_name || d.disease,
            icd10_code: d.icd10_code,
            confidence: d.confidence,
            severity: d.severity
          })),
          soap_note: soapNote || null
        })
      });

      if (!response.ok) {
        console.error(`[Recommendations] HTTP ${response.status}: ${response.statusText}`);
        const errorText = await response.text();
        console.error('[Recommendations] Error response:', errorText);
        return;
      }

      const data = await response.json();
      console.log('[Recommendations] Response:', data);
      setRecommendations(data.recommendations || []);
    } catch (error) {
      console.error('[Recommendations] Failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const initializeLiveTranscription = async () => {
    setIsLiveTranscribing(true);
  };

  const startLiveTranscription = async () => {
    if (!session) {
      alert('Please start a session first');
      return;
    }
    await startRecording();
  };

  const stopLiveTranscription = () => {
    stopRecording();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  if (!currentDoctor) {
    return <LoginPage onLogin={setCurrentDoctor} />;
  }

  if (currentDoctor) {
    return (
      <DataProvider doctorId={currentDoctor.id}>
        <Dashboard 
          doctor={currentDoctor} 
          onLogout={() => setCurrentDoctor(null)}
          session={session}
          isRecording={isRecording}
          isLiveTranscribing={isLiveTranscribing}
          isConnected={isConnected}
          isAnalyzing={isAnalyzing}
          busy={busy}
          recordingTime={recordingTime}
          liveTranscript={liveTranscript}
          liveTranscriptHistory={liveTranscriptHistory}
          diseases={diseases}
          soapNote={soapNote}
          recommendations={recommendations}
          loading={loading}
          onStartSession={startSession}
          onStartRecording={startRecording}
          onStopRecording={stopRecording}
          onGenerateSOAP={generateSOAP}
          onGenerateRecommendations={generateRecommendations}
        />
      </DataProvider>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px'
    }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        {/* Header Card */}
        <div style={{
          background: 'white',
          borderRadius: 8,
          padding: 16,
          marginBottom: 16,
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <h1 style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            margin: 0
          }}>
                        Medical Transcriber
          </h1>

          {/* Control Panel */}
          <div style={{
            marginTop: 24,
            padding: 24,
            background: '#f9fafb',
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16
          }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              {!session ? (
                <button
                  onClick={startSession}
                  disabled={loading}
                  style={{
                    padding: '16px 32px',
                    fontSize: '1.1rem',
                    fontWeight: 600,
                    background: loading ? '#d1d5db' : 'linear-gradient(45deg, #10b981, #059669)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 12,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    boxShadow: loading ? 'none' : '0 4px 12px rgba(16, 185, 129, 0.3)'
                  }}
                >
                  Start New Session
                </button>
              ) : (
                <>
                  <div style={{
                    padding: '12px 24px',
                    background: '#dbeafe',
                    borderRadius: 8,
                    color: '#1e40af',
                    fontWeight: 600
                  }}>
                    Session: {session.session_id}
                  </div>

                  {!isRecording ? (
                    <button
                      onClick={startLiveTranscription}
                      disabled={busy}
                      style={{
                        padding: '16px 32px',
                        fontSize: '1.1rem',
                        fontWeight: 600,
                        background: busy ? '#d1d5db' : 'linear-gradient(45deg, #ef4444, #dc2626)',
                        color: 'white',
                        border: 'none',
                        borderRadius: 12,
                        cursor: busy ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        boxShadow: busy ? 'none' : '0 4px 12px rgba(239, 68, 68, 0.3)'
                      }}
                    >
                      Start Recording
                    </button>
                  ) : (
                    <button
                      onClick={stopLiveTranscription}
                      disabled={busy}
                      style={{
                        padding: '16px 32px',
                        fontSize: '1.1rem',
                        fontWeight: 600,
                        background: 'linear-gradient(45deg, #3b82f6, #2563eb)',
                        color: 'white',
                        border: 'none',
                        borderRadius: 12,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
                      }}
                    >
                      Stop & Analyze
                    </button>
                  )}

                  <button
                    onClick={() => {
                      if (turns.length > 0) {
                        setBusy(true);
                        setIsAnalyzing(true);
                        generateSOAP();
                        generateRecommendations();
                        setTimeout(() => {
                          setBusy(false);
                          setIsAnalyzing(false);
                        }, 2000);
                      }
                    }}
                    disabled={busy || turns.length === 0}
                    style={{
                      padding: '16px 24px',
                      fontSize: '1rem',
                      fontWeight: 600,
                      background: (busy || turns.length === 0) ? '#d1d5db' : 'linear-gradient(45deg, #10b981, #059669)',
                      color: 'white',
                      border: 'none',
                      borderRadius: 12,
                      cursor: (busy || turns.length === 0) ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      boxShadow: (busy || turns.length === 0) ? 'none' : '0 4px 12px rgba(16, 185, 129, 0.3)',
                      animation: (!isRecording && !isLiveTranscribing && liveTranscriptHistory.length > 0 && !soapNote) ? 'pulse 2s infinite' : 'none',
                      transform: (!isRecording && !isLiveTranscribing && liveTranscriptHistory.length > 0 && !soapNote) ? 'scale(1.05)' : 'scale(1)',
                      transition: 'transform 0.3s ease'
                    }}
                  >
                    Summarize
                  </button>

                  <button
                    onClick={() => {
                      setTurns([]);
                      setRecordingTime(0);
                      setDiseases([]);
                      setLiveTranscript('');
                      setLiveTranscriptHistory([]);
                      setIsAnalyzing(false);
                      setIsConnected(false);
                      setIsLiveTranscribing(false);
                      setSoapNote(null);
                      setRecommendations([]);
                      setIsRecording(false);
                    }}
                    style={{
                      padding: '16px 24px',
                      fontSize: '1rem',
                      fontWeight: 600,
                      background: '#6b7280',
                      color: 'white',
                      border: 'none',
                      borderRadius: 12,
                      cursor: 'pointer'
                    }}
                  >
                    Clear
                  </button>
                </>
              )}
            </div>

            {isRecording && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 24px',
                background: '#fee2e2',
                borderRadius: 8,
                border: '2px solid #ef4444'
              }}>
                <div style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: '#ef4444',
                  animation: 'pulse 1.5s ease-in-out infinite'
                }} />
                <span style={{ fontWeight: 600, color: '#991b1b' }}>
                  Recording: {formatTime(recordingTime)}
                </span>
              </div>
            )}

            {busy && (
              <div style={{
                padding: '12px 24px',
                background: '#dbeafe',
                borderRadius: 8,
                color: '#1e40af',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}>
                <div style={{
                  width: 16,
                  height: 16,
                  border: '2px solid #3b82f6',
                  borderTop: '2px solid transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
                {isAnalyzing ? 'Analyzing with AI...' : 'Processing audio...'}
              </div>
            )}
          </div>
        </div>
        {/* Main Dashboard Layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24, alignItems: 'start' }}>
          {/* Left Side - Live Transcription Card (Always Visible) */}
          <div style={{
            background: 'white',
            borderRadius: 16,
            padding: 24,
            boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
            border: '2px solid #10b981',
            display: 'flex',
            flexDirection: 'column',
            height: '100%'
          }}>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              marginBottom: 16,
              color: '#1f2937',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              Live Transcription
              <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: isConnected ? '#10b981' : '#ef4444',
                animation: isLiveTranscribing ? 'pulse 1.5s ease-in-out infinite' : 'none'
              }} />
              <span style={{
                fontSize: '0.8rem',
                color: isConnected ? '#10b981' : '#ef4444',
                marginLeft: 'auto'
              }}>
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </h2>

            <div style={{
              display: 'flex',
              gap: 12,
              marginBottom: 16
            }}>
              <button
                onClick={startLiveTranscription}
                disabled={isLiveTranscribing || isAnalyzing || !session}
                style={{
                  background: (isLiveTranscribing || !session) ? '#9ca3af' : '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  padding: '8px 16px',
                  fontSize: '0.9rem',
                  cursor: (isLiveTranscribing || !session) ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                Start Live
              </button>

              <button
                onClick={stopLiveTranscription}
                disabled={!isLiveTranscribing}
                style={{
                  background: !isLiveTranscribing ? '#9ca3af' : '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  padding: '8px 16px',
                  fontSize: '0.9rem',
                  cursor: !isLiveTranscribing ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                Stop
              </button>
            </div>

            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: 20,
              background: '#f9fafb',
              borderRadius: 12,
              border: '1px solid #e5e7eb',
              fontSize: '1rem'
            }}>
              {isLiveTranscribing && (
                <div style={{
                  color: '#ef4444',
                  fontSize: '0.85rem',
                  marginBottom: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: 8,
                  background: '#fef2f2',
                  borderRadius: 8
                }}>
                  <div style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#ef4444',
                    animation: 'pulse 1s ease-in-out infinite'
                  }} />
                  Listening...
                </div>
              )}

              {(liveTranscript || liveTranscriptHistory.length > 0) ? (
                <div>
                  {/* Display all transcripts in chronological order */}
                  {liveTranscriptHistory.map((transcript, index) => {
                    const isSpeaker1 = transcript.startsWith('Speaker 1');
                    const isSpeaker2 = transcript.startsWith('Speaker 2');

                    return (
                      <div key={index} style={{
                        marginBottom: 12,
                        padding: 14,
                        background: isSpeaker1 ? '#dbeafe' : isSpeaker2 ? '#fef3c7' : '#f3f4f6',
                        borderRadius: 8,
                        borderLeft: `4px solid ${isSpeaker1 ? '#2563eb' : isSpeaker2 ? '#f59e0b' : '#6b7280'}`,
                        lineHeight: 1.6
                      }}>
                        <div style={{
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          color: isSpeaker1 ? '#1e40af' : isSpeaker2 ? '#b45309' : '#374151',
                          marginBottom: 6
                        }}>
                          {transcript.split(':')[0]}
                        </div>
                        <div style={{
                          color: '#1f2937',
                          fontSize: '0.95rem'
                        }}>
                          {transcript.substring(transcript.indexOf(':') + 1).trim()}
                        </div>
                      </div>
                    );
                  })}

                  {/* Current interim transcript */}
                  {liveTranscript && (
                    <div style={{
                      marginBottom: 12,
                      padding: 14,
                      background: '#e0f2fe',
                      borderRadius: 8,
                      borderLeft: '4px solid #0ea5e9',
                      lineHeight: 1.6,
                      border: '2px dashed #0ea5e9'
                    }}>
                      <div style={{
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        color: '#0369a1',
                        marginBottom: 6
                      }}>
                        {liveTranscript.split(':')[0]} (speaking...)
                      </div>
                      <div style={{
                        color: '#1f2937',
                        fontSize: '0.95rem',
                        fontStyle: 'italic'
                      }}>
                        {liveTranscript.substring(liveTranscript.indexOf(':') + 1).trim()}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{
                  color: '#6b7280',
                  fontStyle: 'italic',
                  textAlign: 'center',
                  padding: 40
                }}>
                  {isLiveTranscribing ? 'Waiting for speech...' : 'Click "Start Live" to begin transcription'}
                </div>
              )}
            </div>
          </div>

          {/* Right Side - All Other Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>

            {/* Smart Disease Detection Card (Always Visible) */}
            <div style={{
              background: 'white',
              borderRadius: 12,
              padding: 16,
              boxShadow: diseases.length > 0 ? '0 8px 24px rgba(239, 68, 68, 0.2)' : '0 4px 15px rgba(0,0,0,0.1)',
              height: 'fit-content',
              border: diseases.length > 0 ? '2px solid #ef4444' : '1px solid #e5e7eb',
              transition: 'all 0.3s ease'
            }}>
              <h2 style={{
                fontSize: '1.1rem',
                fontWeight: 700,
                marginBottom: 12,
                color: '#1f2937',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}>
                Smart Disease Detection
                {diseases.length > 0 && (
                  <span style={{
                    marginLeft: 'auto',
                    padding: '4px 12px',
                    background: '#ef4444',
                    color: 'white',
                    borderRadius: 12,
                    fontSize: '0.75rem',
                    fontWeight: 700
                  }}>
                    {diseases.length} detected
                  </span>
                )}
              </h2>
              <div style={{
                minHeight: 100,
                maxHeight: 400,
                overflowY: 'auto'
              }}>
                {diseases.length === 0 ? (
                  <div style={{
                    color: '#6b7280',
                    fontStyle: 'italic',
                    textAlign: 'center',
                    padding: 20,
                    fontSize: '0.9rem'
                  }}>
                    No conditions detected
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {diseases.map((disease, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '12px 14px',
                          borderRadius: 8,
                          border: `2px solid ${
                            disease.severity === 'high' ? '#ef4444' :
                            disease.severity === 'medium' ? '#f59e0b' : '#10b981'
                          }`,
                          background: `${
                            disease.severity === 'high' ? '#fef2f2' :
                            disease.severity === 'medium' ? '#fffbeb' : '#f0fdf4'
                          }`,
                          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                          transition: 'transform 0.2s ease',
                          cursor: 'pointer'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'scale(1.02)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'scale(1)';
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          marginBottom: 8
                        }}>
                          <div style={{ flex: 1 }}>
                            <div style={{
                              fontWeight: 700,
                              fontSize: '0.95rem',
                              color: disease.severity === 'high' ? '#991b1b' :
                                    disease.severity === 'medium' ? '#92400e' : '#065f46',
                              marginBottom: 4
                            }}>
                              {disease.disease_name || disease.disease}
                            </div>
                            {disease.icd10_code && disease.icd10_code !== 'UNKNOWN' && (
                              <div style={{
                                fontSize: '0.75rem',
                                color: '#6b7280',
                                fontFamily: 'monospace',
                                padding: '2px 6px',
                                background: 'white',
                                borderRadius: 4,
                                display: 'inline-block',
                                marginBottom: 6
                              }}>
                                ICD-10: {disease.icd10_code}
                              </div>
                            )}
                          </div>
                          <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-end',
                            gap: 4
                          }}>
                            <span style={{
                              fontSize: '0.75rem',
                              padding: '4px 10px',
                              borderRadius: 4,
                              background: 'white',
                              color: '#6b7280',
                              fontWeight: 600
                            }}>
                              {Math.round(disease.confidence * 100)}%
                            </span>
                            <span style={{
                              fontSize: '0.7rem',
                              padding: '3px 8px',
                              borderRadius: 4,
                              background: disease.severity === 'high' ? '#ef4444' :
                                        disease.severity === 'medium' ? '#f59e0b' : '#10b981',
                              color: 'white',
                              fontWeight: 600,
                              textTransform: 'uppercase'
                            }}>
                              {disease.severity}
                            </span>
                          </div>
                        </div>
                        {disease.supporting_symptoms && disease.supporting_symptoms.length > 0 && (
                          <div style={{
                            marginTop: 8,
                            paddingTop: 8,
                            borderTop: '1px solid rgba(0,0,0,0.1)'
                          }}>
                            <div style={{
                              fontSize: '0.75rem',
                              color: '#6b7280',
                              marginBottom: 4,
                              fontWeight: 600
                            }}>
                              Supporting symptoms:
                            </div>
                            <div style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: 4
                            }}>
                              {disease.supporting_symptoms.slice(0, 5).map((symptom, sIdx) => (
                                <span
                                  key={sIdx}
                                  style={{
                                    fontSize: '0.7rem',
                                    padding: '3px 8px',
                                    background: 'white',
                                    borderRadius: 10,
                                    color: '#374151',
                                    border: '1px solid rgba(0,0,0,0.1)'
                                  }}
                                >
                                  {symptom}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Clinical Summary Card (Always Visible) */}
            <div style={{
              background: 'white',
              borderRadius: 12,
              padding: 16,
              boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
              height: 'fit-content'
            }}>
              <h2 style={{
                fontSize: '1.1rem',
                fontWeight: 700,
                marginBottom: 12,
                color: '#1f2937',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}>
                Clinical Summary (SOAP Note)
              </h2>
              <div style={{
                minHeight: 60,
                maxHeight: '60vh',
                overflowY: 'auto',
                overflowX: 'hidden',
                fontSize: '0.85rem',
                paddingRight: 8,
                scrollBehavior: 'smooth'
              }}>
                {soapNote?.subjective || soapNote?.objective || soapNote?.assessment || soapNote?.plan ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {soapNote.subjective && (
                      <div style={{
                        padding: 14,
                        background: '#eff6ff',
                        borderRadius: 8,
                        border: '1px solid #bfdbfe'
                      }}>
                        <div style={{ fontWeight: 700, color: '#1e40af', marginBottom: 8, fontSize: '0.95rem' }}>S - Subjective</div>
                        <div style={{ color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap', fontSize: '0.87rem' }}>{soapNote.subjective}</div>
                      </div>
                    )}
                    {soapNote.objective && (
                      <div style={{
                        padding: 14,
                        background: '#f0fdf4',
                        borderRadius: 8,
                        border: '1px solid #bbf7d0'
                      }}>
                        <div style={{ fontWeight: 700, color: '#15803d', marginBottom: 8, fontSize: '0.95rem' }}>O - Objective</div>
                        <div style={{ color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap', fontSize: '0.87rem' }}>{soapNote.objective}</div>
                      </div>
                    )}
                    {soapNote.assessment && (
                      <div style={{
                        padding: 14,
                        background: '#fef3c7',
                        borderRadius: 8,
                        border: '1px solid #fde68a'
                      }}>
                        <div style={{ fontWeight: 700, color: '#92400e', marginBottom: 8, fontSize: '0.95rem' }}>A - Assessment</div>
                        <div style={{ color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap', fontSize: '0.87rem' }}>{soapNote.assessment}</div>
                      </div>
                    )}
                    {soapNote.plan && (
                      <div style={{
                        padding: 14,
                        background: '#fce7f3',
                        borderRadius: 8,
                        border: '1px solid #fbcfe8'
                      }}>
                        <div style={{ fontWeight: 700, color: '#9f1239', marginBottom: 8, fontSize: '0.95rem' }}>P - Plan</div>
                        <div style={{ color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap', fontSize: '0.87rem' }}>{soapNote.plan}</div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ color: '#6b7280', fontStyle: 'italic', textAlign: 'center', padding: 20 }}>
                    SOAP note will appear after analysis
                  </div>
                )}
              </div>
            </div>

            {/* Recommendations Card (Always Visible) */}
            <div style={{
              background: 'white',
              borderRadius: 12,
              padding: 16,
              boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
              height: 'fit-content'
            }}>
              <h2 style={{
                fontSize: '1.1rem',
                fontWeight: 700,
                marginBottom: 12,
                color: '#1f2937',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}>
                Recommendations
              </h2>
              <div style={{
                minHeight: 100,
                padding: 16,
                background: '#f9fafb',
                borderRadius: 8,
                border: '1px solid #e5e7eb'
              }}>
                {recommendations.length > 0 ? (
                  <ol style={{ margin: 0, paddingLeft: 24, color: '#374151' }}>
                    {recommendations.map((step, idx) => (
                      <li key={idx} style={{ marginBottom: 8, lineHeight: 1.6 }}>
                        {step.recommendation}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <div style={{ color: '#6b7280', fontStyle: 'italic', textAlign: 'center', padding: 20 }}>
                    Medical recommendations will appear here after recording analysis
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Additional Medical Analysis Cards - Only PDF Download */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 24 }}>

          {/* Patient-Friendly Summary / PDF Download Card */}
          <div style={{
            background: 'white',
            borderRadius: 16,
            padding: 24,
            boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
          }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 16, color: '#1f2937', display: 'flex', alignItems: 'center', gap: 8 }}>
              SOAP Note PDF
            </h3>
            {soapNote?.pdf_url ? (
              <div style={{
                padding: 20,
                background: '#f0fdf4',
                borderRadius: 8,
                border: '2px solid #10b981',
                textAlign: 'center'
              }}>
                <div style={{ marginBottom: 16, color: '#065f46', fontSize: '1rem' }}>
                  Your SOAP note has been generated successfully!
                </div>
                <a
                  href={soapNote.pdf_url.replace('gs://', 'https://storage.googleapis.com/')}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-block',
                    padding: '12px 32px',
                    background: 'linear-gradient(45deg, #10b981, #059669)',
                    color: 'white',
                    borderRadius: 8,
                    textDecoration: 'none',
                    fontWeight: 600,
                    fontSize: '1rem',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                    transition: 'transform 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  Download PDF
                </a>
                <div style={{ marginTop: 12, fontSize: '0.85rem', color: '#6b7280' }}>
                  Session: {soapNote.pdf_url.split('/').pop()?.replace('.pdf', '')}
                </div>
              </div>
            ) : soapNote?.patient_friendly_summary ? (
              <div style={{
                padding: 20,
                background: '#f0fdf4',
                borderRadius: 8,
                border: '2px solid #10b981',
                color: '#065f46',
                lineHeight: 1.8,
                fontSize: '1rem'
              }}>
                {soapNote.patient_friendly_summary}
              </div>
            ) : (
              <div style={{
                color: '#6b7280',
                fontStyle: 'italic',
                textAlign: 'center',
                padding: 40,
                background: '#f9fafb',
                borderRadius: 8,
                border: '2px dashed #d1d5db'
              }}>
                SOAP note PDF will appear here after analysis
              </div>
            )}
          </div>
        </div>
      </div>

      <style>
        {`
          @keyframes pulse {
            0%, 100% {
              opacity: 1;
            }
            50% {
              opacity: 0.5;
            }
          }

          @keyframes spin {
            0% {
              transform: rotate(0deg);
            }
            100% {
              transform: rotate(360deg);
            }
          }
        `}
      </style>
    </div>
  );
}
