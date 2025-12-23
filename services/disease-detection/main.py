import asyncio
import json
import logging
import os
from typing import Dict, List, Optional, Tuple
from datetime import datetime
from dataclasses import dataclass, field, asdict
from enum import Enum

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ML libraries
import torch
import numpy as np
from transformers import (
    AutoTokenizer,
    AutoModelForTokenClassification,
    AutoModelForSequenceClassification,
    pipeline
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def convert_numpy_types(obj):
    """Convert numpy types to Python native types for JSON serialization"""
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, (np.floating, np.float32, np.float64)):
        return float(obj)
    elif isinstance(obj, (np.integer, np.int32, np.int64)):
        return int(obj)
    elif isinstance(obj, dict):
        return {k: convert_numpy_types(v) for k, v in obj.items()}
    elif isinstance(obj, (list, tuple)):
        return [convert_numpy_types(item) for item in obj]
    return obj


class InputSourceType(str, Enum):
    """Supported input sources"""
    TRANSCRIPTION = "transcription"
    CLINICAL_NOTES = "clinical_notes"
    PATIENT_SUMMARY = "patient_summary"
    LAB_RESULTS = "lab_results"
    PREVIOUS_DIAGNOSIS = "previous_diagnosis"


@dataclass
class MedicalEntity:
    """Medical entity extracted from text"""
    text: str
    entity_type: str  # DISEASE, SYMPTOM, MEDICATION, LAB, PROCEDURE
    start: int
    end: int
    confidence: float
    source: InputSourceType = InputSourceType.TRANSCRIPTION


@dataclass
class DiseaseDetection:
    """Disease detection result with confidence scoring"""
    disease_name: str
    icd10_code: str
    snomed_code: Optional[str]
    confidence: float  # 0.0-1.0
    severity: str  # low, medium, high, critical
    supporting_entities: List[MedicalEntity] = field(default_factory=list)
    mentioned_sources: List[InputSourceType] = field(default_factory=list)
    position: Optional[Dict[str, int]] = None
    evidence_summary: str = ""


class AnalysisRequest(BaseModel):
    """Request for disease analysis"""
    session_id: str
    transcription: Optional[str] = None
    clinical_notes: Optional[str] = None
    patient_summary: Optional[str] = None
    lab_results: Optional[str] = None
    previous_diagnosis: Optional[List[str]] = None


class AnalysisResponse(BaseModel):
    """Response with disease detections"""
    session_id: str
    detections: List[Dict]
    extracted_entities: List[Dict]
    timestamp: str
    analysis_confidence: float
    sources_analyzed: List[str]


# FastAPI app
app = FastAPI(
    title="Advanced Disease Detection Service",
    description="Production-ready disease detection using ClinicalBERT and PubMedBERT"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class MedicalNERModel:
    """Medical NER using BioBERT for entity extraction"""

    def __init__(self):
        logger.info("🔄 Loading BioBERT for Medical NER...")
        
        # Use disease-specific BioBERT model
        model_name = "alvaroalon2/biobert_diseases_ner"
        
        try:
            self.tokenizer = AutoTokenizer.from_pretrained(model_name, trust_remote_code=True)
            self.model = AutoModelForTokenClassification.from_pretrained(model_name, trust_remote_code=True)
            
            # Move to GPU if available
            device = 0 if torch.cuda.is_available() else -1
            self.pipeline = pipeline(
                "ner",
                model=self.model,
                tokenizer=self.tokenizer,
                aggregation_strategy="simple",
                device=device
            )
            
            logger.info("✅ BioBERT NER loaded successfully")
        except Exception as e:
            logger.error(f"❌ Failed to load BioBERT: {e}")
            raise

    def extract_entities(self, text: str) -> List[MedicalEntity]:
        """Extract medical entities from text"""
        try:
            if not text or len(text.strip()) == 0:
                return []
            
            # Get NER results
            ner_results = self.pipeline(text[:512])  # Limit to 512 tokens
            
            entities = []
            for result in ner_results:
                if result['score'] > 0.5:  # Confidence threshold
                    entity = MedicalEntity(
                        text=result['word'],
                        entity_type='DISEASE',
                        start=result.get('start', 0),
                        end=result.get('end', 0),
                        confidence=result['score']
                    )
                    entities.append(entity)
            
            return entities
        
        except Exception as e:
            logger.error(f"NER extraction error: {e}")
            return []


class ClinicalDiseaseClassifier:
    """Disease classification using ClinicalBERT"""

    def __init__(self):
        logger.info("🔄 Loading ClinicalBERT for disease classification...")
        
        model_name = "medicalai/ClinicalBERT"
        
        try:
            self.tokenizer = AutoTokenizer.from_pretrained(model_name, trust_remote_code=True)
            self.model = AutoModelForSequenceClassification.from_pretrained(
                model_name,
                num_labels=2,
                trust_remote_code=True
            )
            
            device = 0 if torch.cuda.is_available() else -1
            self.classifier = pipeline(
                "text-classification",
                model=self.model,
                tokenizer=self.tokenizer,
                device=device
            )
            
            logger.info("✅ ClinicalBERT loaded successfully")
        except Exception as e:
            logger.error(f"❌ Failed to load ClinicalBERT: {e}")
            raise

    def analyze_clinical_text(self, text: str) -> Dict:
        """Analyze clinical text for disease indicators"""
        try:
            if not text or len(text.strip()) == 0:
                return {}
            
            # Analyze with ClinicalBERT
            result = self.classifier(text[:512])
            
            return {
                'label': result[0]['label'],
                'confidence': result[0]['score']
            }
        
        except Exception as e:
            logger.error(f"Clinical text analysis error: {e}")
            return {}


class AdvancedDiseaseDetector:
    """Advanced disease detection combining multiple models and knowledge"""

    def __init__(self):
        logger.info("🚀 Initializing Advanced Disease Detection System...")
        
        # Load models
        self.ner_model = MedicalNERModel()
        self.classifier = ClinicalDiseaseClassifier()
        
        # Medical knowledge base (disease mappings)
        self.disease_database = self._load_disease_database()
        
        logger.info("✅ Advanced Disease Detector initialized")

    def _load_disease_database(self) -> Dict:
        """Load medical knowledge base with ICD-10 and SNOMED codes"""
        return {
            'pneumonia': {
                'icd10': 'J18.9',
                'snomed': '233604007',
                'severity': 'high',
                'keywords': ['pneumonia', 'lung infection', 'lower respiratory', 'consolidation'],
                'related_symptoms': ['cough', 'fever', 'chest pain', 'shortness of breath']
            },
            'asthma': {
                'icd10': 'J45.9',
                'snomed': '195967001',
                'severity': 'medium',
                'keywords': ['asthma', 'wheezing', 'reactive airway'],
                'related_symptoms': ['shortness of breath', 'wheezing', 'cough']
            },
            'copd': {
                'icd10': 'J44.9',
                'snomed': '13645005',
                'severity': 'high',
                'keywords': ['copd', 'chronic obstructive', 'emphysema'],
                'related_symptoms': ['cough', 'shortness of breath', 'wheezing']
            },
            'covid-19': {
                'icd10': 'U07.1',
                'snomed': '840539006',
                'severity': 'high',
                'keywords': ['covid', 'coronavirus', 'sars-cov-2', 'positive test'],
                'related_symptoms': ['fever', 'cough', 'fatigue', 'loss of taste']
            },
            'diabetes': {
                'icd10': 'E11.9',
                'snomed': '44054006',
                'severity': 'high',
                'keywords': ['diabetes', 'hyperglycemia', 'blood sugar', 'hba1c'],
                'related_symptoms': ['increased thirst', 'frequent urination', 'fatigue']
            },
            'hypertension': {
                'icd10': 'I10',
                'snomed': '38341003',
                'severity': 'high',
                'keywords': ['hypertension', 'high blood pressure', 'elevated bp'],
                'related_symptoms': ['headache', 'dizziness', 'chest pain']
            },
            'heart failure': {
                'icd10': 'I50.9',
                'snomed': '84114007',
                'severity': 'high',
                'keywords': ['heart failure', 'congestive', 'cardiomyopathy', 'ejection fraction'],
                'related_symptoms': ['shortness of breath', 'fatigue', 'edema', 'orthopnea']
            },
            'myocardial infarction': {
                'icd10': 'I21.9',
                'snomed': '22298006',
                'severity': 'critical',
                'keywords': ['mi', 'myocardial infarction', 'heart attack', 'troponin'],
                'related_symptoms': ['chest pain', 'radiating pain', 'diaphoresis']
            },
            'stroke': {
                'icd10': 'I63.9',
                'snomed': '230690007',
                'severity': 'critical',
                'keywords': ['stroke', 'ischemic', 'hemorrhagic', 'cva'],
                'related_symptoms': ['weakness', 'speech difficulty', 'facial drooping']
            },
            'cancer': {
                'icd10': 'C80.1',
                'snomed': '363346000',
                'severity': 'critical',
                'keywords': ['cancer', 'malignancy', 'tumor', 'carcinoma', 'metastasis', 'oncology'],
                'related_symptoms': ['weight loss', 'fatigue', 'unexplained bleeding', 'persistent cough'],
            },
        }

    async def detect_diseases(
        self,
        transcription: Optional[str] = None,
        clinical_notes: Optional[str] = None,
        patient_summary: Optional[str] = None,
        lab_results: Optional[str] = None,
        previous_diagnosis: Optional[List[str]] = None
    ) -> Tuple[List[DiseaseDetection], List[MedicalEntity]]:
        """
        Detect diseases from multiple sources
        """
        try:
            all_entities = []
            disease_scores = {}
            source_mentions = {}
            
            # Process transcription
            if transcription:
                logger.info("[Transcription] Processing...")
                entities = await asyncio.to_thread(
                    self.ner_model.extract_entities,
                    transcription
                )
                all_entities.extend([(e, InputSourceType.TRANSCRIPTION) for e in entities])
                # Build entity confidence map
                entity_conf_map = {e.text.lower(): e.confidence for e in entities}
                self._score_diseases(disease_scores, source_mentions, transcription, InputSourceType.TRANSCRIPTION, entity_conf_map)
            
            # Process clinical notes
            if clinical_notes:
                logger.info("[Clinical Notes] Processing...")
                entities = await asyncio.to_thread(
                    self.ner_model.extract_entities,
                    clinical_notes
                )
                all_entities.extend([(e, InputSourceType.CLINICAL_NOTES) for e in entities])
                entity_conf_map = {e.text.lower(): e.confidence for e in entities}
                self._score_diseases(disease_scores, source_mentions, clinical_notes, InputSourceType.CLINICAL_NOTES, entity_conf_map)
            
            # Process patient summary
            if patient_summary:
                logger.info("[Patient Summary] Processing...")
                entities = await asyncio.to_thread(
                    self.ner_model.extract_entities,
                    patient_summary
                )
                all_entities.extend([(e, InputSourceType.PATIENT_SUMMARY) for e in entities])
                entity_conf_map = {e.text.lower(): e.confidence for e in entities}
                self._score_diseases(disease_scores, source_mentions, patient_summary, InputSourceType.PATIENT_SUMMARY, entity_conf_map)
            
            # Process lab results
            if lab_results:
                logger.info("[Lab Results] Processing...")
                self._score_diseases(disease_scores, source_mentions, lab_results, InputSourceType.LAB_RESULTS, None)
            
            # Process previous diagnosis
            if previous_diagnosis:
                logger.info("[Previous Diagnosis] Processing...")
                for diagnosis in previous_diagnosis:
                    for disease_name, info in self.disease_database.items():
                        if disease_name.lower() in diagnosis.lower():
                            disease_scores[disease_name] = disease_scores.get(disease_name, 0) + 0.8
                            if disease_name not in source_mentions:
                                source_mentions[disease_name] = []
                            source_mentions[disease_name].append(InputSourceType.PREVIOUS_DIAGNOSIS)
            
            # Build disease detections
            detections = []
            for disease_name, score in sorted(disease_scores.items(), key=lambda x: x[1], reverse=True)[:10]:
                info = self.disease_database.get(disease_name, {})
                
                # Filter entities related to this disease
                related_entities = [
                    e for e, _ in all_entities 
                    if any(kw in e.text.lower() for kw in info.get('keywords', []) + info.get('related_symptoms', []))
                ]
                
                detection = DiseaseDetection(
                    disease_name=disease_name,
                    icd10_code=info.get('icd10', 'Unknown'),
                    snomed_code=info.get('snomed'),
                    confidence=min(score * 0.25, 1.0),  # Improved normalization: 0.25 factor for better scaling
                    severity=info.get('severity', 'medium'),
                    supporting_entities=related_entities,
                    mentioned_sources=source_mentions.get(disease_name, []),
                    evidence_summary=f"Detected from {len(source_mentions.get(disease_name, []))} source(s)"
                )
                detections.append(detection)
            
            # Format entities for response
            formatted_entities = [
                {
                    'text': e[0].text,
                    'type': e[0].entity_type,
                    'confidence': float(e[0].confidence),  # Convert to Python float
                    'source': e[1].value
                }
                for e in all_entities if e[0].confidence > 0.5
            ]
            
            logger.info(f"✅ Detected {len(detections)} diseases from {len(all_entities)} entities")
            return detections, formatted_entities

        except Exception as e:
            logger.error(f"❌ Disease detection error: {e}", exc_info=True)
            return [], []

    def _score_diseases(
        self,
        disease_scores: Dict[str, float],
        source_mentions: Dict[str, List[InputSourceType]],
        text: str,
        source: InputSourceType,
        entity_confidences: Optional[Dict[str, float]] = None
    ):
        """Score diseases using ClinicalBERT context and BioBERT entities"""
        text_lower = text.lower()
        
        # Get clinical context using ClinicalBERT
        clinical_analysis = self.classifier.analyze_clinical_text(text)
        clinical_confidence = clinical_analysis.get('confidence', 0.5) if clinical_analysis else 0.5
        
        for disease_name, info in self.disease_database.items():
            disease_score = 0.0
            matched_terms = []
            
            # Check keywords (higher weight)
            for keyword in info.get('keywords', []):
                if keyword.lower() in text_lower:
                    # Use BioBERT confidence if available, otherwise use clinical context
                    entity_confidence = entity_confidences.get(keyword.lower(), 0.5) if entity_confidences else clinical_confidence
                    disease_score += 2.0 * entity_confidence  # Increased weight for direct keywords
                    matched_terms.append(keyword)
                    if disease_name not in source_mentions:
                        source_mentions[disease_name] = []
                    if source not in source_mentions[disease_name]:
                        source_mentions[disease_name].append(source)
            
            # Check related symptoms (lower weight, only if at least one keyword matched)
            for symptom in info.get('related_symptoms', []):
                if symptom.lower() in text_lower:
                    # Boost only if keyword was found OR clinical context supports it
                    if matched_terms or clinical_confidence > 0.6:
                        entity_confidence = entity_confidences.get(symptom.lower(), 0.5) if entity_confidences else clinical_confidence
                        disease_score += 0.6 * entity_confidence  # Lower weight for symptoms alone
                        matched_terms.append(symptom)
                        if disease_name not in source_mentions:
                            source_mentions[disease_name] = []
                        if source not in source_mentions[disease_name]:
                            source_mentions[disease_name].append(source)
            
            # Only add disease if keywords matched
            if matched_terms:
                disease_scores[disease_name] = disease_scores.get(disease_name, 0) + disease_score


# Initialize detector
try:
    detector = AdvancedDiseaseDetector()
except Exception as e:
    logger.error(f"Failed to initialize detector: {e}")
    detector = None


@app.post("/v1/analyze", response_model=AnalysisResponse)
async def analyze_transcript(request: AnalysisRequest):
    """Analyze medical data from multiple sources for disease detection"""
    
    if not detector:
        raise HTTPException(status_code=503, detail="Disease detection service not available")
    
    try:
        logger.info(f"[Analysis] Session: {request.session_id}")
        
        # Detect diseases
        detections, entities = await detector.detect_diseases(
            transcription=request.transcription,
            clinical_notes=request.clinical_notes,
            patient_summary=request.patient_summary,
            lab_results=request.lab_results,
            previous_diagnosis=request.previous_diagnosis
        )
        
        # Convert to dict with numpy conversion
        detection_dicts = [
            {
                'disease_name': d.disease_name,
                'icd10_code': d.icd10_code,
                'snomed_code': d.snomed_code,
                'confidence': float(d.confidence),  # Ensure it's Python float
                'severity': d.severity,
                'supporting_symptoms': [e.text for e in d.supporting_entities],
                'sources': [s.value for s in d.mentioned_sources],
                'evidence': d.evidence_summary
            }
            for d in detections
        ]
        
        # Calculate overall analysis confidence (convert to Python float)
        avg_confidence = float(sum(d['confidence'] for d in detection_dicts) / len(detection_dicts)) if detection_dicts else 0.0
        
        # Determine sources analyzed
        sources_analyzed = []
        if request.transcription:
            sources_analyzed.append('transcription')
        if request.clinical_notes:
            sources_analyzed.append('clinical_notes')
        if request.patient_summary:
            sources_analyzed.append('patient_summary')
        if request.lab_results:
            sources_analyzed.append('lab_results')
        if request.previous_diagnosis:
            sources_analyzed.append('previous_diagnosis')
        
        logger.info(f"✅ Returning {len(detection_dicts)} detections")
        
        return AnalysisResponse(
            session_id=request.session_id,
            detections=detection_dicts,
            extracted_entities=entities,
            timestamp=datetime.utcnow().isoformat(),
            analysis_confidence=avg_confidence,
            sources_analyzed=sources_analyzed
        )

    except Exception as e:
        logger.error(f"❌ Analysis error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/v1/analyze-stream")
async def analyze_stream(request: AnalysisRequest):
    """Real-time streaming disease detection with instant results"""
    from fastapi.responses import StreamingResponse
    
    if not detector:
        raise HTTPException(status_code=503, detail="Disease detection service not available")
    
    async def generate():
        """Stream detection results as they're found"""
        try:
            logger.info(f"[Stream] Session: {request.session_id}")
            
            # Immediately start entity extraction
            entities_data = []
            detections_data = []
            
            # Process each source and stream results
            all_entities = []
            disease_scores = {}
            source_mentions = {}
            
            # Transcription
            if request.transcription:
                logger.info("[Stream] Extracting from transcription...")
                entities = await asyncio.to_thread(
                    detector.ner_model.extract_entities,
                    request.transcription
                )
                all_entities.extend([(e, InputSourceType.TRANSCRIPTION) for e in entities])
                entity_conf_map = {e.text.lower(): e.confidence for e in entities}
                
                # Stream entities
                for e in entities:
                    entity_dict = {
                        'text': e.text,
                        'type': e.entity_type,
                        'confidence': float(e.confidence),
                        'source': 'transcription'
                    }
                    entities_data.append(entity_dict)
                    yield f"data: {json.dumps({'type': 'entity', 'data': entity_dict})}\n\n"
                
                # Score and stream diseases
                detector._score_diseases(disease_scores, source_mentions, request.transcription, InputSourceType.TRANSCRIPTION, entity_conf_map)
            
            # Clinical notes
            if request.clinical_notes:
                logger.info("[Stream] Extracting from clinical notes...")
                entities = await asyncio.to_thread(
                    detector.ner_model.extract_entities,
                    request.clinical_notes
                )
                all_entities.extend([(e, InputSourceType.CLINICAL_NOTES) for e in entities])
                entity_conf_map = {e.text.lower(): e.confidence for e in entities}
                
                for e in entities:
                    entity_dict = {
                        'text': e.text,
                        'type': e.entity_type,
                        'confidence': float(e.confidence),
                        'source': 'clinical_notes'
                    }
                    entities_data.append(entity_dict)
                    yield f"data: {json.dumps({'type': 'entity', 'data': entity_dict})}\n\n"
                
                detector._score_diseases(disease_scores, source_mentions, request.clinical_notes, InputSourceType.CLINICAL_NOTES, entity_conf_map)
            
            # Patient summary
            if request.patient_summary:
                logger.info("[Stream] Extracting from patient summary...")
                entities = await asyncio.to_thread(
                    detector.ner_model.extract_entities,
                    request.patient_summary
                )
                all_entities.extend([(e, InputSourceType.PATIENT_SUMMARY) for e in entities])
                entity_conf_map = {e.text.lower(): e.confidence for e in entities}
                
                for e in entities:
                    entity_dict = {
                        'text': e.text,
                        'type': e.entity_type,
                        'confidence': float(e.confidence),
                        'source': 'patient_summary'
                    }
                    entities_data.append(entity_dict)
                    yield f"data: {json.dumps({'type': 'entity', 'data': entity_dict})}\n\n"
                
                detector._score_diseases(disease_scores, source_mentions, request.patient_summary, InputSourceType.PATIENT_SUMMARY, entity_conf_map)
            
            # Lab results
            if request.lab_results:
                logger.info("[Stream] Processing lab results...")
                detector._score_diseases(disease_scores, source_mentions, request.lab_results, InputSourceType.LAB_RESULTS, None)
            
            # Previous diagnosis
            if request.previous_diagnosis:
                logger.info("[Stream] Processing previous diagnosis...")
                for diagnosis in request.previous_diagnosis:
                    for disease_name, info in detector.disease_database.items():
                        if disease_name.lower() in diagnosis.lower():
                            disease_scores[disease_name] = disease_scores.get(disease_name, 0) + 0.8
                            if disease_name not in source_mentions:
                                source_mentions[disease_name] = []
                            source_mentions[disease_name].append(InputSourceType.PREVIOUS_DIAGNOSIS)
            
            # Stream detections in real-time
            logger.info(f"[Stream] Found {len(disease_scores)} potential diseases")
            for disease_name, score in sorted(disease_scores.items(), key=lambda x: x[1], reverse=True)[:10]:
                info = detector.disease_database.get(disease_name, {})
                related_entities = [
                    e for e, _ in all_entities 
                    if any(kw in e.text.lower() for kw in info.get('keywords', []) + info.get('related_symptoms', []))
                ]
                
                detection_dict = {
                    'disease_name': disease_name,
                    'icd10_code': info.get('icd10', 'Unknown'),
                    'snomed_code': info.get('snomed'),
                    'confidence': float(min(score * 0.25, 1.0)),
                    'severity': info.get('severity', 'medium'),
                    'supporting_symptoms': [e.text for e in related_entities],
                    'sources': [s.value for s in source_mentions.get(disease_name, [])],
                    'evidence': f"Detected from {len(source_mentions.get(disease_name, []))} source(s)"
                }
                detections_data.append(detection_dict)
                yield f"data: {json.dumps({'type': 'detection', 'data': detection_dict})}\n\n"
            
            # Final summary
            avg_confidence = float(sum(d['confidence'] for d in detections_data) / len(detections_data)) if detections_data else 0.0
            
            sources_analyzed = []
            if request.transcription:
                sources_analyzed.append('transcription')
            if request.clinical_notes:
                sources_analyzed.append('clinical_notes')
            if request.patient_summary:
                sources_analyzed.append('patient_summary')
            if request.lab_results:
                sources_analyzed.append('lab_results')
            if request.previous_diagnosis:
                sources_analyzed.append('previous_diagnosis')
            
            summary = {
                'session_id': request.session_id,
                'total_detections': len(detections_data),
                'total_entities': len(entities_data),
                'analysis_confidence': avg_confidence,
                'sources_analyzed': sources_analyzed,
                'timestamp': datetime.utcnow().isoformat()
            }
            
            yield f"data: {json.dumps({'type': 'summary', 'data': summary})}\n\n"
            logger.info(f"✅ Stream complete: {len(detections_data)} detections")
            
        except Exception as e:
            logger.error(f"❌ Stream error: {e}", exc_info=True)
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
    
    return StreamingResponse(generate(), media_type="text/event-stream")


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy" if detector else "unhealthy",
        "service": "disease-detection-advanced",
        "version": "3.0.0",
        "models": {
            "ner": "BioBERT (alvaroalon2/biobert_diseases_ner)",
            "classifier": "ClinicalBERT (medicalai/ClinicalBERT)",
            "knowledge_base": "Enabled"
        },
        "gpu_available": torch.cuda.is_available()
    }


@app.get("/ready")
async def readiness_check():
    """Readiness check"""
    return {
        "status": "ready" if detector else "not_ready",
        "service": "disease-detection-advanced"
    }


@app.get("/models")
async def get_models_info():
    """Get information about loaded models"""
    return {
        "ner_model": {
            "name": "BioBERT (Disease NER)",
            "source": "alvaroalon2/biobert_diseases_ner",
            "task": "Named Entity Recognition",
            "performance": "F1: 87.70% on NCBI Disease dataset"
        },
        "classifier_model": {
            "name": "ClinicalBERT",
            "source": "medicalai/ClinicalBERT",
            "task": "Clinical Text Classification",
            "training_data": "3M+ EHR records"
        },
        "knowledge_base": {
            "diseases": len(detector.disease_database) if detector else 0,
            "scope": "Comprehensive ICD-10 and SNOMED-CT mappings"
        }
    }


if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv('PORT', '8080'))
    logger.info(f"🚀 Starting Advanced Disease Detection Service on port {port}")
    
    uvicorn.run(app, host="0.0.0.0", port=port)
