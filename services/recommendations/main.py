import asyncio
import json
import logging
from typing import Dict, List, Optional, Set
from datetime import datetime
from dataclasses import dataclass
import os

from google.cloud import firestore
import httpx
import vertexai
from vertexai.preview.generative_models import GenerativeModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class ClinicalRecommendation:
    """Clinical recommendation with evidence"""
    category: str  # LAB_TEST, MEDICATION, IMAGING, REFERRAL, LIFESTYLE, FOLLOW_UP
    recommendation: str
    rationale: str
    evidence_level: str  # A, B, C (strength of evidence)
    priority: str  # HIGH, MEDIUM, LOW
    contraindications: List[str]
    alternatives: List[str]


@dataclass
class DrugInteraction:
    """Drug-drug interaction"""
    drug1: str
    drug2: str
    severity: str  # MAJOR, MODERATE, MINOR
    description: str
    management: str


class ClinicalRecommendationService:
    """
    Generates evidence-based clinical recommendations
    """
    
    def __init__(self):
        self.project_id = os.getenv('GCP_PROJECT_ID', 'transcriberx-477408')
        self.db = firestore.Client()

        # Initialize Vertex AI Gemini
        vertexai.init(project=self.project_id, location="us-central1")
        self.model = GenerativeModel("gemini-2.5-pro")
        logger.info("Vertex AI Gemini 2.5 Pro initialized for recommendations")
        
        # Load clinical guidelines database (lightweight)
        self.guidelines = self._load_clinical_guidelines()
        self.drug_interactions_db = self._load_drug_interactions()
        self.lab_recommendations = self._load_lab_recommendations()
    
    
    def _load_clinical_guidelines(self) -> Dict:
        """
        Load clinical practice guidelines
        In production, integrate with:
        - UpToDate
        - Clinical Practice Guidelines (CPG)
        - National Guidelines Clearinghouse
        - NICE guidelines
        """
        return {
            'E11.9': {  # Type 2 Diabetes
                'guidelines': [
                    {
                        'recommendation': 'HbA1c testing every 3-6 months',
                        'category': 'LAB_TEST',
                        'evidence_level': 'A',
                        'source': 'ADA Standards of Medical Care 2024'
                    },
                    {
                        'recommendation': 'Metformin as first-line therapy',
                        'category': 'MEDICATION',
                        'evidence_level': 'A',
                        'source': 'ADA/EASD Consensus Report'
                    },
                    {
                        'recommendation': 'Annual comprehensive foot examination',
                        'category': 'SCREENING',
                        'evidence_level': 'B',
                        'source': 'ADA Standards'
                    },
                    {
                        'recommendation': 'Target HbA1c <7% for most adults',
                        'category': 'TARGET',
                        'evidence_level': 'A',
                        'source': 'ADA Standards'
                    }
                ],
                'lifestyle_modifications': [
                    'Medical nutrition therapy',
                    'Physical activity (150 min/week)',
                    'Weight management',
                    'Smoking cessation'
                ],
                'monitoring': [
                    'HbA1c every 3-6 months',
                    'Annual lipid panel',
                    'Annual microalbuminuria',
                    'Annual dilated eye exam'
                ]
            },
            'I10': {  # Hypertension
                'guidelines': [
                    {
                        'recommendation': 'Target BP <130/80 mmHg',
                        'category': 'TARGET',
                        'evidence_level': 'A',
                        'source': 'ACC/AHA 2017'
                    },
                    {
                        'recommendation': 'Lifestyle modifications for all',
                        'category': 'LIFESTYLE',
                        'evidence_level': 'A',
                        'source': 'JNC 8'
                    },
                    {
                        'recommendation': 'ACE inhibitor or ARB as first-line',
                        'category': 'MEDICATION',
                        'evidence_level': 'A',
                        'source': 'ACC/AHA Guidelines'
                    }
                ],
                'lifestyle_modifications': [
                    'DASH diet',
                    'Sodium restriction (<2g/day)',
                    'Regular aerobic exercise',
                    'Weight loss if overweight',
                    'Limit alcohol'
                ],
                'monitoring': [
                    'BP checks every 3-6 months',
                    'Annual renal function',
                    'Annual electrolytes',
                    'Cardiovascular risk assessment'
                ]
            },
            'J45.9': {  # Asthma
                'guidelines': [
                    {
                        'recommendation': 'Inhaled corticosteroids as controller',
                        'category': 'MEDICATION',
                        'evidence_level': 'A',
                        'source': 'GINA Guidelines 2024'
                    },
                    {
                        'recommendation': 'Short-acting beta-agonist for rescue',
                        'category': 'MEDICATION',
                        'evidence_level': 'A',
                        'source': 'GINA Guidelines'
                    },
                    {
                        'recommendation': 'Spirometry at diagnosis and periodically',
                        'category': 'LAB_TEST',
                        'evidence_level': 'B',
                        'source': 'NHLBI Guidelines'
                    }
                ],
                'lifestyle_modifications': [
                    'Identify and avoid triggers',
                    'Smoking cessation',
                    'Influenza vaccination'
                ],
                'monitoring': [
                    'Asthma Control Test quarterly',
                    'Spirometry annually',
                    'Peak flow monitoring'
                ]
            }
        }
    
    def _load_drug_interactions(self) -> Dict:
        """
        Load drug-drug interactions database
        In production, integrate with:
        - Lexicomp
        - Micromedex
        - DrugBank
        - FDA Drug Interactions database
        """
        return {
            ('warfarin', 'aspirin'): {
                'severity': 'MAJOR',
                'description': 'Increased risk of bleeding',
                'management': 'Monitor INR closely, consider dose adjustment'
            },
            ('metformin', 'contrast dye'): {
                'severity': 'MAJOR',
                'description': 'Risk of lactic acidosis with contrast',
                'management': 'Hold metformin 48 hours before and after contrast'
            },
            ('lisinopril', 'potassium'): {
                'severity': 'MODERATE',
                'description': 'Risk of hyperkalemia',
                'management': 'Monitor potassium levels regularly'
            },
            ('simvastatin', 'amlodipine'): {
                'severity': 'MODERATE',
                'description': 'Increased risk of myopathy',
                'management': 'Limit simvastatin dose to 20mg'
            },
            ('warfarin', 'amiodarone'): {
                'severity': 'MAJOR',
                'description': 'Significantly increased INR',
                'management': 'Reduce warfarin dose by 30-50%, monitor INR closely'
            }
        }
    
    def _load_lab_recommendations(self) -> Dict:
        """Load laboratory test recommendations by condition"""
        return {
            'chest pain': [
                'Troponin (serial)',
                'ECG',
                'Complete blood count',
                'Basic metabolic panel',
                'Lipid panel',
                'D-dimer (if PE suspected)'
            ],
            'shortness of breath': [
                'Chest X-ray',
                'BNP or NT-proBNP',
                'Arterial blood gas',
                'D-dimer',
                'Pulmonary function tests'
            ],
            'fatigue': [
                'Complete blood count',
                'Thyroid function tests',
                'Basic metabolic panel',
                'Vitamin B12 and folate',
                'Iron studies',
                'Fasting glucose'
            ],
            'fever': [
                'Complete blood count',
                'Blood cultures',
                'Urinalysis and culture',
                'Chest X-ray',
                'Inflammatory markers (CRP, ESR)'
            ]
        }
    
    async def generate_recommendations(
        self,
        session_id: str
    ) -> List[ClinicalRecommendation]:
        """
        Generate comprehensive clinical recommendations
        """
        try:
            # Get session data
            session_data = await self._get_session_data(session_id)
            
            # Extract relevant information
            diagnoses = session_data.get('disease_detections', [])
            medications = self._extract_medications(session_data)
            symptoms = self._extract_symptoms(session_data)
            soap_note = session_data.get('soap_note', {})
            
            # Generate recommendations
            recommendations = []
            
            # 1. Guideline-based recommendations
            guideline_recs = await self._get_guideline_recommendations(diagnoses)
            recommendations.extend(guideline_recs)
            
            # 2. Lab test recommendations
            lab_recs = await self._get_lab_recommendations(symptoms, diagnoses)
            recommendations.extend(lab_recs)
            
            # 3. Medication recommendations
            med_recs = await self._get_medication_recommendations(diagnoses, medications)
            recommendations.extend(med_recs)
            
            # 4. Check drug interactions
            interactions = await self._check_drug_interactions(medications)
            if interactions:
                interaction_recs = self._create_interaction_recommendations(interactions)
                recommendations.extend(interaction_recs)
            
            # 5. Lifestyle recommendations
            lifestyle_recs = await self._get_lifestyle_recommendations(diagnoses)
            recommendations.extend(lifestyle_recs)
            
            # 6. Follow-up recommendations
            followup_recs = await self._get_followup_recommendations(diagnoses)
            recommendations.extend(followup_recs)
            
            # 7. AI-enhanced recommendations using Claude
            ai_recs = await self._generate_ai_recommendations(
                session_data,
                recommendations
            )
            recommendations.extend(ai_recs)
            
            # Deduplicate and prioritize
            final_recommendations = self._prioritize_recommendations(recommendations)
            
            # Save recommendations
            await self._save_recommendations(session_id, final_recommendations)
            
            return final_recommendations
            
        except Exception as e:
            logger.error(f"Recommendation generation error: {str(e)}")
            raise

    async def generate_recommendations_from_data(
        self,
        session_id: str,
        transcript: str,
        detected_diseases: List[Dict],
        soap_note: Optional[Dict] = None
    ) -> List[ClinicalRecommendation]:
        """
        Generate recommendations directly from data (no Firestore dependency)
        """
        try:
            logger.info(f"[Recommendations] Processing {len(detected_diseases)} diseases from transcript")

            # Extract medications and symptoms from transcript
            medications = self._extract_medications_from_text(transcript)
            symptoms = self._extract_symptoms_from_text(transcript)

            # Generate recommendations
            recommendations = []

            # 1. Guideline-based recommendations
            if detected_diseases:
                guideline_recs = await self._get_guideline_recommendations(detected_diseases)
                recommendations.extend(guideline_recs)

            # 2. Lab test recommendations
            if symptoms or detected_diseases:
                lab_recs = await self._get_lab_recommendations(symptoms, detected_diseases)
                recommendations.extend(lab_recs)

            # 3. Medication recommendations
            if detected_diseases:
                med_recs = await self._get_medication_recommendations(detected_diseases, medications)
                recommendations.extend(med_recs)

            # 4. Check drug interactions
            if medications:
                interactions = await self._check_drug_interactions(medications)
                if interactions:
                    interaction_recs = self._create_interaction_recommendations(interactions)
                    recommendations.extend(interaction_recs)

            # 5. Lifestyle recommendations
            if detected_diseases:
                lifestyle_recs = await self._get_lifestyle_recommendations(detected_diseases)
                recommendations.extend(lifestyle_recs)

            # 6. Follow-up recommendations
            if detected_diseases:
                followup_recs = await self._get_followup_recommendations(detected_diseases)
                recommendations.extend(followup_recs)

            # Deduplicate and prioritize
            final_recommendations = self._prioritize_recommendations(recommendations)

            logger.info(f"[Recommendations] Generated {len(final_recommendations)} final recommendations")

            return final_recommendations

        except Exception as e:
            logger.error(f"[Recommendations] Generation error: {str(e)}", exc_info=True)
            raise

    def _extract_medications_from_text(self, text: str) -> List[str]:
        """Extract medications mentioned in transcript"""
        medications = []
        text_lower = text.lower()

        # Common medication patterns
        med_keywords = ['taking', 'prescribed', 'medication', 'drug', 'tablet', 'pill', 'mg']

        # Simple extraction (could be improved with NER)
        if any(keyword in text_lower for keyword in med_keywords):
            # This is a simplified version - in production would use NER
            pass

        return medications

    def _extract_symptoms_from_text(self, text: str) -> List[str]:
        """Extract symptoms from transcript"""
        symptoms = []
        text_lower = text.lower()

        # Common symptoms
        symptom_keywords = [
            'pain', 'ache', 'fever', 'cough', 'nausea', 'vomiting', 'diarrhea',
            'headache', 'dizziness', 'fatigue', 'weakness', 'shortness of breath',
            'chest pain', 'abdominal pain'
        ]

        for symptom in symptom_keywords:
            if symptom in text_lower:
                symptoms.append(symptom)

        return symptoms

    async def _get_session_data(self, session_id: str) -> Dict:
        """Get session data from Firestore"""
        session_ref = self.db.collection('sessions').document(session_id)
        session_doc = await asyncio.to_thread(session_ref.get)
        
        if not session_doc.exists:
            raise ValueError(f"Session {session_id} not found")
        
        return session_doc.to_dict()
    
    def _extract_medications(self, session_data: Dict) -> List[str]:
        """Extract medications from session"""
        medications = set()
        
        # From medical entities
        entities = session_data.get('medical_entities', [])
        for entity in entities:
            if entity.get('type') == 'MEDICATION':
                medications.add(entity['text'].lower())
        
        # From patient history
        patient_id = session_data.get('patient_id')
        if patient_id:
            # Would fetch from patient record in production
            pass
        
        return list(medications)
    
    def _extract_symptoms(self, session_data: Dict) -> List[str]:
        """Extract symptoms from session"""
        symptoms = set()
        
        entities = session_data.get('medical_entities', [])
        for entity in entities:
            if entity.get('type') == 'SYMPTOM':
                symptoms.add(entity['text'].lower())
        
        return list(symptoms)
    
    async def _get_guideline_recommendations(
        self,
        diagnoses: List[Dict]
    ) -> List[ClinicalRecommendation]:
        """Get recommendations based on clinical guidelines"""
        recommendations = []
        
        for diagnosis in diagnoses:
            icd10 = diagnosis.get('icd10_code')
            
            if icd10 in self.guidelines:
                guideline = self.guidelines[icd10]
                
                for rec in guideline.get('guidelines', []):
                    recommendation = ClinicalRecommendation(
                        category=rec['category'],
                        recommendation=rec['recommendation'],
                        rationale=f"Based on {rec['source']}",
                        evidence_level=rec['evidence_level'],
                        priority='HIGH' if rec['evidence_level'] == 'A' else 'MEDIUM',
                        contraindications=[],
                        alternatives=[]
                    )
                    recommendations.append(recommendation)
        
        return recommendations
    
    async def _get_lab_recommendations(
        self,
        symptoms: List[str],
        diagnoses: List[Dict]
    ) -> List[ClinicalRecommendation]:
        """Recommend appropriate laboratory tests"""
        recommendations = []
        recommended_labs = set()
        
        # Based on symptoms
        for symptom in symptoms:
            symptom_lower = symptom.lower()
            for key, labs in self.lab_recommendations.items():
                if key in symptom_lower or symptom_lower in key:
                    recommended_labs.update(labs)
        
        # Based on diagnoses
        for diagnosis in diagnoses:
            icd10 = diagnosis.get('icd10_code')
            if icd10 in self.guidelines:
                monitoring = self.guidelines[icd10].get('monitoring', [])
                recommended_labs.update(monitoring)
        
        for lab in recommended_labs:
            recommendation = ClinicalRecommendation(
                category='LAB_TEST',
                recommendation=f"Order {lab}",
                rationale="Appropriate workup based on presentation",
                evidence_level='B',
                priority='MEDIUM',
                contraindications=[],
                alternatives=[]
            )
            recommendations.append(recommendation)
        
        return recommendations
    
    async def _get_medication_recommendations(
        self,
        diagnoses: List[Dict],
        current_medications: List[str]
    ) -> List[ClinicalRecommendation]:
        """Recommend medications based on guidelines"""
        recommendations = []
        
        for diagnosis in diagnoses:
            icd10 = diagnosis.get('icd10_code')
            
            if icd10 in self.guidelines:
                guideline = self.guidelines[icd10]
                
                # Extract medication guidelines
                med_guidelines = [
                    g for g in guideline.get('guidelines', [])
                    if g['category'] == 'MEDICATION'
                ]
                
                for med_guide in med_guidelines:
                    recommendation = ClinicalRecommendation(
                        category='MEDICATION',
                        recommendation=med_guide['recommendation'],
                        rationale=f"First-line therapy per {med_guide['source']}",
                        evidence_level=med_guide['evidence_level'],
                        priority='HIGH',
                        contraindications=[],
                        alternatives=[]
                    )
                    recommendations.append(recommendation)
        
        return recommendations
    
    async def _check_drug_interactions(
        self,
        medications: List[str]
    ) -> List[DrugInteraction]:
        """Check for drug-drug interactions"""
        interactions = []
        
        # Check all pairs
        for i, med1 in enumerate(medications):
            for med2 in medications[i+1:]:
                # Normalize medication names
                med1_norm = med1.lower().strip()
                med2_norm = med2.lower().strip()
                
                # Check both orderings
                key1 = (med1_norm, med2_norm)
                key2 = (med2_norm, med1_norm)
                
                interaction_data = (
                    self.drug_interactions_db.get(key1) or
                    self.drug_interactions_db.get(key2)
                )
                
                if interaction_data:
                    interaction = DrugInteraction(
                        drug1=med1,
                        drug2=med2,
                        severity=interaction_data['severity'],
                        description=interaction_data['description'],
                        management=interaction_data['management']
                    )
                    interactions.append(interaction)
        
        return interactions
    
    def _create_interaction_recommendations(
        self,
        interactions: List[DrugInteraction]
    ) -> List[ClinicalRecommendation]:
        """Create recommendations for drug interactions"""
        recommendations = []
        
        for interaction in interactions:
            priority = 'HIGH' if interaction.severity == 'MAJOR' else 'MEDIUM'
            
            recommendation = ClinicalRecommendation(
                category='DRUG_INTERACTION',
                recommendation=f"Monitor interaction between {interaction.drug1} and {interaction.drug2}",
                rationale=f"{interaction.description}. {interaction.management}",
                evidence_level='A',
                priority=priority,
                contraindications=[],
                alternatives=[]
            )
            recommendations.append(recommendation)
        
        return recommendations
    
    async def _get_lifestyle_recommendations(
        self,
        diagnoses: List[Dict]
    ) -> List[ClinicalRecommendation]:
        """Generate lifestyle modification recommendations"""
        recommendations = []
        lifestyle_mods = set()
        
        for diagnosis in diagnoses:
            icd10 = diagnosis.get('icd10_code')
            
            if icd10 in self.guidelines:
                mods = self.guidelines[icd10].get('lifestyle_modifications', [])
                lifestyle_mods.update(mods)
        
        for mod in lifestyle_mods:
            recommendation = ClinicalRecommendation(
                category='LIFESTYLE',
                recommendation=mod,
                rationale="Evidence-based lifestyle modification",
                evidence_level='A',
                priority='MEDIUM',
                contraindications=[],
                alternatives=[]
            )
            recommendations.append(recommendation)
        
        return recommendations
    
    async def _get_followup_recommendations(
        self,
        diagnoses: List[Dict]
    ) -> List[ClinicalRecommendation]:
        """Generate follow-up recommendations"""
        recommendations = []
        
        # Default follow-up
        default_followup = ClinicalRecommendation(
            category='FOLLOW_UP',
            recommendation="Schedule follow-up visit in 2-4 weeks",
            rationale="Monitor treatment response and adjust therapy",
            evidence_level='C',
            priority='MEDIUM',
            contraindications=[],
            alternatives=[]
        )
        recommendations.append(default_followup)
        
        return recommendations
    
    async def _generate_ai_recommendations(
        self,
        session_data: Dict,
        existing_recommendations: List[ClinicalRecommendation]
    ) -> List[ClinicalRecommendation]:
        """Generate AI-enhanced recommendations using Claude"""
        
        # Prepare context
        soap_note = session_data.get('soap_note', {})
        diagnoses = session_data.get('disease_detections', [])
        
        prompt = f"""You are a clinical decision support system. Based on the following patient information, 
provide additional evidence-based recommendations that might not be covered by standard guidelines.

SOAP Note:
Assessment: {soap_note.get('assessment', '')}
Plan: {soap_note.get('plan', '')}

Detected Diagnoses:
{json.dumps(diagnoses, indent=2)}

Existing Recommendations:
{json.dumps([{'category': r.category, 'recommendation': r.recommendation} for r in existing_recommendations], indent=2)}

Provide 3-5 additional specific, actionable recommendations with rationale. Consider:
1. Comorbidity management
2. Preventive care
3. Patient education needs
4. Coordination of care
5. Social determinants of health

Format each as:
CATEGORY: [LAB_TEST|IMAGING|REFERRAL|PATIENT_EDUCATION|PREVENTIVE]
RECOMMENDATION: [specific recommendation]
RATIONALE: [evidence-based rationale]
PRIORITY: [HIGH|MEDIUM|LOW]"""
        
        try:
            response = await asyncio.to_thread(
                self.model.generate_content,
                prompt,
                generation_config={
                    "temperature": 0.3,
                    "max_output_tokens": 2048,
                }
            )
            
            # Parse AI response
            ai_recs = self._parse_ai_recommendations(response.text)
            return ai_recs
            
        except Exception as e:
            logger.error(f"AI recommendation generation failed: {str(e)}")
            return []
    
    def _parse_ai_recommendations(self, response: str) -> List[ClinicalRecommendation]:
        """Parse AI-generated recommendations"""
        recommendations = []
        lines = response.split('\n')
        
        current_rec = {}
        for line in lines:
            line = line.strip()
            
            if line.startswith('CATEGORY:'):
                if current_rec:
                    recommendations.append(self._create_recommendation_from_dict(current_rec))
                current_rec = {'category': line.split(':', 1)[1].strip()}
            elif line.startswith('RECOMMENDATION:'):
                current_rec['recommendation'] = line.split(':', 1)[1].strip()
            elif line.startswith('RATIONALE:'):
                current_rec['rationale'] = line.split(':', 1)[1].strip()
            elif line.startswith('PRIORITY:'):
                current_rec['priority'] = line.split(':', 1)[1].strip()
        
        if current_rec:
            recommendations.append(self._create_recommendation_from_dict(current_rec))
        
        return recommendations
    
    def _create_recommendation_from_dict(self, data: Dict) -> ClinicalRecommendation:
        """Create ClinicalRecommendation from dictionary"""
        return ClinicalRecommendation(
            category=data.get('category', 'OTHER'),
            recommendation=data.get('recommendation', ''),
            rationale=data.get('rationale', ''),
            evidence_level='C',  # AI recommendations default to C
            priority=data.get('priority', 'MEDIUM'),
            contraindications=[],
            alternatives=[]
        )
    
    def _prioritize_recommendations(
        self,
        recommendations: List[ClinicalRecommendation]
    ) -> List[ClinicalRecommendation]:
        """Prioritize and deduplicate recommendations"""
        # Remove duplicates
        unique_recs = {}
        for rec in recommendations:
            key = (rec.category, rec.recommendation.lower())
            if key not in unique_recs or rec.priority == 'HIGH':
                unique_recs[key] = rec
        
        # Sort by priority
        priority_order = {'HIGH': 0, 'MEDIUM': 1, 'LOW': 2}
        sorted_recs = sorted(
            unique_recs.values(),
            key=lambda x: priority_order.get(x.priority, 3)
        )
        
        return sorted_recs
    
    async def _save_recommendations(
        self,
        session_id: str,
        recommendations: List[ClinicalRecommendation]
    ):
        """Save recommendations to Firestore"""
        session_ref = self.db.collection('sessions').document(session_id)
        
        recs_data = [
            {
                'category': r.category,
                'recommendation': r.recommendation,
                'rationale': r.rationale,
                'evidence_level': r.evidence_level,
                'priority': r.priority,
                'contraindications': r.contraindications,
                'alternatives': r.alternatives
            }
            for r in recommendations
        ]
        
        await asyncio.to_thread(
            session_ref.update,
            {
                'clinical_recommendations': recs_data,
                'recommendations_generated_at': firestore.SERVER_TIMESTAMP
            }
        )


# FastAPI application
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Clinical Recommendation Service")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

recommendation_service = ClinicalRecommendationService()


class DiseaseInfo(BaseModel):
    disease_name: str
    icd10_code: str
    confidence: float
    severity: Optional[str] = None


class RecommendationRequest(BaseModel):
    session_id: str
    transcript: str
    detected_diseases: Optional[List[DiseaseInfo]] = []
    soap_note: Optional[Dict] = None


class RecommendationResponse(BaseModel):
    session_id: str
    recommendations: List[Dict]
    generated_at: str


@app.post("/v1/recommendations/generate", response_model=RecommendationResponse)
async def generate_recommendations(request: RecommendationRequest):
    """Generate clinical recommendations"""
    logger.info(f"[Recommendations] Generating for session {request.session_id}, transcript length: {len(request.transcript)}, diseases: {len(request.detected_diseases)}")

    # Generate recommendations directly from data
    recommendations = await recommendation_service.generate_recommendations_from_data(
        session_id=request.session_id,
        transcript=request.transcript,
        detected_diseases=[d.dict() for d in request.detected_diseases],
        soap_note=request.soap_note
    )

    logger.info(f"[Recommendations] Generated {len(recommendations)} recommendations for {request.session_id}")

    return RecommendationResponse(
        session_id=request.session_id,
        recommendations=[
            {
                'category': r.category,
                'recommendation': r.recommendation,
                'rationale': r.rationale,
                'evidence_level': r.evidence_level,
                'priority': r.priority
            }
            for r in recommendations
        ],
        generated_at=datetime.utcnow().isoformat()
    )


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "recommendations"}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8080"))
    uvicorn.run(app, host="0.0.0.0", port=port)
