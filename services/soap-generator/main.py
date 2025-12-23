import asyncio
import json
import logging
from typing import Dict, List, Optional
from datetime import datetime
from dataclasses import dataclass
import os

from google.cloud import firestore
import vertexai
from vertexai.preview.generative_models import GenerativeModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class SOAPNote:
    """Structured SOAP note"""
    subjective: str
    objective: str
    assessment: str
    plan: str
    session_id: str
    generated_at: str
    chief_complaint: Optional[str] = None
    history_present_illness: Optional[str] = None
    review_of_systems: Optional[str] = None
    physical_exam: Optional[str] = None
    differential_diagnoses: Optional[List[str]] = None
    primary_diagnosis: Optional[str] = None
    icd10_codes: Optional[List[str]] = None
    medications_prescribed: Optional[List[Dict]] = None
    follow_up: Optional[str] = None


class SOAPGeneratorService:
    """
    SOAP Note Generation using advanced LLMs
    """
    
    def __init__(self):
        self.project_id = os.getenv('GCP_PROJECT_ID', 'transcriberx-477408')
        self.db = firestore.Client()

        # Initialize Vertex AI
        vertexai.init(project=self.project_id, location="us-central1")
        self.model = GenerativeModel("gemini-2.5-pro")
        logger.info("Vertex AI Gemini 2.5 Pro initialized successfully")

        # Load SOAP templates (lightweight)
        self.templates = self._load_templates()
    
    
    def _load_templates(self) -> Dict[str, str]:
        """
        Load specialty-specific SOAP templates
        """
        return {
            'general': """
You are a medical documentation assistant. Generate a structured SOAP note from the following doctor-patient conversation.

Conversation:
{transcript}

Previous Medical History:
{medical_history}

Pattern-Matched Disease Detections (may contain false positives):
{detected_diseases}

Generate a comprehensive SOAP note using EXACTLY this format:

## SUBJECTIVE
[Write detailed subjective findings here including:
- Chief complaint and history of present illness
- Past medical history, current medications, allergies
- Social history and review of systems
- Patient's own description of symptoms]

## OBJECTIVE
[Write objective findings here including:
- Vital signs (or note if not available)
- Physical examination findings
- Relevant test results
- Observable clinical signs]

## ASSESSMENT
[Write assessment here including:
- PRIMARY DIAGNOSIS with **ICD-10:** code on separate line
- Differential diagnoses with rationale
- Clinical reasoning and severity assessment
- Review pattern-matched diseases - confirm relevant ones, remove false positives]

## PLAN
[Write detailed plan here including:
1. **Medications:** List all prescriptions with dosing
2. **Diagnostic Tests:** Any labs or imaging ordered
3. **Patient Education:** Instructions and warnings
4. **Follow-up:** When and why to return
5. **Referrals:** Specialist consultations if needed]

IMPORTANT FORMATTING RULES:
- Start each main section with ## followed by section name (SUBJECTIVE, OBJECTIVE, ASSESSMENT, PLAN)
- Use EXACTLY these section names - no variations
- ICD-10 codes MUST be formatted as: **ICD-10:** G43.0
- Write in paragraph form within each section
- Be thorough, professional, and use medical terminology
- For pattern-matched diseases: confirm real diagnoses, discard false positives
""",
            
            'cardiology': """
Generate a cardiology-focused SOAP note with emphasis on:
- Cardiovascular symptoms (chest pain, dyspnea, palpitations)
- Cardiac risk factors
- Relevant cardiac exam findings
- ECG/cardiac imaging if mentioned
- Cardiovascular medications and interventions
""",
            
            'pediatrics': """
Generate a pediatrics SOAP note with:
- Growth and development assessment
- Vaccination history
- Age-appropriate symptom description
- Parent/guardian concerns
- Developmental milestones
- Anticipatory guidance
""",
            
            'psychiatry': """
Generate a psychiatric SOAP note with:
- Mental status examination
- Psychiatric history and symptoms
- Risk assessment (suicidal/homicidal ideation)
- Current medications and side effects
- Psychotherapy notes
- Safety planning
"""
        }
    
    async def generate_soap_note(
        self,
        session_id: str,
        specialty: str = 'general',
        custom_template: Optional[str] = None
    ) -> SOAPNote:
        """
        Generate SOAP note for a session
        """
        try:
            # Retrieve session data
            session_data = await self._get_session_data(session_id)
            
            # Prepare context
            context = await self._prepare_context(session_data)
            
            # Generate SOAP note using LLM
            soap_content = await self._generate_with_vertex(
                context,
                specialty,
                custom_template
            )
            
            # Parse and structure SOAP note
            structured_soap = self._parse_soap_response(soap_content, session_id)
            
            # Enrich with detected information
            enriched_soap = await self._enrich_soap_note(structured_soap, session_data)
            
            # Save to Firestore
            await self._save_soap_note(session_id, enriched_soap)
            
            # Generate PDF
            await self._generate_pdf(session_id, enriched_soap)
            
            return enriched_soap
            
        except Exception as e:
            logger.error(f"SOAP generation error: {str(e)}")
            raise

    async def generate_soap_note_from_transcript(
        self,
        session_id: str,
        transcript: str,
        detected_diseases: List[Dict],
        specialty: str = 'general',
        custom_template: Optional[str] = None
    ) -> SOAPNote:
        """
        Generate SOAP note directly from transcript (no Firestore dependency)
        """
        try:
            logger.info(f"[SOAP] Generating from transcript for {session_id}")

            # Prepare context without Firestore
            context = {
                'transcript': transcript,
                'entities': [],
                'detections': detected_diseases,
                'medical_history': None,
                'patient_id': None,
                'doctor_id': None
            }

            # Generate SOAP note using LLM
            soap_content = await self._generate_with_vertex(
                context,
                specialty,
                custom_template
            )

            # Parse and structure SOAP note
            structured_soap = self._parse_soap_response(soap_content, session_id)

            # Add ICD-10 codes from detected diseases
            if detected_diseases:
                structured_soap.icd10_codes = [d.get('icd10_code') for d in detected_diseases if d.get('icd10_code')]

            logger.info(f"[SOAP] Generated SOAP note successfully for {session_id}")

            return structured_soap

        except Exception as e:
            logger.error(f"[SOAP] Generation error: {str(e)}", exc_info=True)
            raise

    async def _get_session_data(self, session_id: str) -> Dict:
        """Retrieve session data from Firestore"""
        session_ref = self.db.collection('sessions').document(session_id)
        session_doc = await asyncio.to_thread(session_ref.get)
        
        if not session_doc.exists:
            raise ValueError(f"Session {session_id} not found")
        
        return session_doc.to_dict()
    
    async def _prepare_context(self, session_data: Dict) -> Dict:
        """Prepare context for SOAP generation"""
        # Get full transcript
        transcript_segments = session_data.get('transcript', [])
        full_transcript = self._format_transcript(transcript_segments)
        
        # Get detected entities and diseases
        entities = session_data.get('medical_entities', [])
        detections = session_data.get('disease_detections', [])
        
        # Get patient medical history
        patient_id = session_data.get('patient_id')
        medical_history = await self._get_patient_history(patient_id)
        
        return {
            'transcript': full_transcript,
            'entities': entities,
            'detections': detections,
            'medical_history': medical_history,
            'patient_id': patient_id,
            'doctor_id': session_data.get('doctor_id')
        }
    
    def _format_transcript(self, segments: List[Dict]) -> str:
        """Format transcript for SOAP generation"""
        formatted_lines = []
        
        for segment in segments:
            if segment.get('is_final'):
                text = segment.get('text', '')
                timestamp = segment.get('timestamp', '')
                
                # Try to identify speaker from words
                words = segment.get('words', [])
                if words and 'speaker_tag' in words[0]:
                    # Extract speaker number from tag (e.g., 'SPEAKER_1' -> '1')
                    speaker_tag = words[0]['speaker_tag']
                    speaker_num = speaker_tag.replace('SPEAKER_', '')
                    speaker = f'Speaker {speaker_num}'
                else:
                    speaker = 'Speaker'
                
                formatted_lines.append(f"{speaker}: {text}")
        
        return '\n'.join(formatted_lines)
    
    async def _get_patient_history(self, patient_id: str) -> str:
        """Get patient medical history"""
        try:
            patient_ref = self.db.collection('patients').document(patient_id)
            patient_doc = await asyncio.to_thread(patient_ref.get)
            
            if not patient_doc.exists:
                return "No previous medical history available."
            
            patient_data = patient_doc.to_dict()
            
            history_parts = []
            
            if 'chronic_conditions' in patient_data:
                conditions = ', '.join(patient_data['chronic_conditions'])
                history_parts.append(f"Chronic Conditions: {conditions}")
            
            if 'medications' in patient_data:
                meds = ', '.join(patient_data['medications'])
                history_parts.append(f"Current Medications: {meds}")
            
            if 'allergies' in patient_data:
                allergies = ', '.join(patient_data['allergies'])
                history_parts.append(f"Allergies: {allergies}")
            
            if 'past_surgeries' in patient_data:
                surgeries = ', '.join(patient_data['past_surgeries'])
                history_parts.append(f"Past Surgeries: {surgeries}")
            
            return '\n'.join(history_parts) if history_parts else "No significant medical history."
            
        except Exception as e:
            logger.error(f"Error getting patient history: {str(e)}")
            return "Medical history unavailable."
    
    async def _generate_with_vertex(
        self,
        context: Dict,
        specialty: str,
        custom_template: Optional[str]
    ) -> str:
        """Generate SOAP note using Vertex AI Gemini 2.5 Pro"""
        template = custom_template or self.templates.get(specialty, self.templates['general'])

        # Format detected diseases for the prompt
        detected_diseases_text = ""
        if context.get('detections'):
            detected_diseases_text = "\n".join([
                f"- {d.get('disease_name', 'Unknown')} (ICD-10: {d.get('icd10_code', 'N/A')}, Confidence: {d.get('confidence', 0):.0%}, Severity: {d.get('severity', 'unknown')})"
                for d in context['detections']
            ])
        else:
            detected_diseases_text = "None detected via pattern matching"

        prompt = template.format(
            transcript=context['transcript'],
            medical_history=context.get('medical_history', 'Not available') or 'Not available',
            detected_diseases=detected_diseases_text
        )

        logger.info(f"[SOAP] Sending prompt to Vertex AI Gemini (length: {len(prompt)} chars)")

        # Use Vertex AI Gemini
        response = await asyncio.to_thread(
            self.model.generate_content,
            prompt,
            generation_config={
                "temperature": 0.3,
                "max_output_tokens": 2048,
            }
        )

        result_text = response.text
        logger.info(f"[SOAP] Received response from Gemini (length: {len(result_text)} chars)")
        logger.info(f"[SOAP] Gemini FULL RESPONSE:\n{result_text}")
        return result_text
    
    async def _extract_entities(self, transcript: str) -> Dict:
        """Extract medical entities from transcript"""
        # Placeholder for entity extraction
        return {}
    
    def _parse_soap_response(self, soap_text: str, session_id: str) -> SOAPNote:
        """Parse LLM response into structured SOAP note"""
        logger.info(f"[SOAP] Parsing response text of length {len(soap_text)}")
        
        sections = {
            'subjective': '',
            'objective': '',
            'assessment': '',
            'plan': ''
        }
        
        current_section = None
        lines = soap_text.split('\n')
        
        for line in lines:
            line_stripped = line.strip()
            line_upper = line_stripped.upper()
            
            # Remove markdown headers and formatting
            line_clean = line_stripped.lstrip('#').strip('*').strip()
            line_clean_upper = line_clean.upper()
            
            # Detect section headers (handles ##, **, and plain text)
            if ('SUBJECTIVE' in line_clean_upper or line_clean_upper.startswith('S:') or 
                line_clean_upper.startswith('S -') or line_clean_upper == 'S'):
                current_section = 'subjective'
                # Capture content after colon/dash on same line
                if ':' in line_clean or '-' in line_clean:
                    parts = line_clean.replace(':', ' ').replace('-', ' ').split(maxsplit=1)
                    if len(parts) > 1 and parts[1]:
                        sections[current_section] += parts[1].strip() + '\n'
                continue
            elif ('OBJECTIVE' in line_clean_upper or line_clean_upper.startswith('O:') or 
                  line_clean_upper.startswith('O -') or line_clean_upper == 'O'):
                current_section = 'objective'
                if ':' in line_clean or '-' in line_clean:
                    parts = line_clean.replace(':', ' ').replace('-', ' ').split(maxsplit=1)
                    if len(parts) > 1 and parts[1]:
                        sections[current_section] += parts[1].strip() + '\n'
                continue
            elif ('ASSESSMENT' in line_clean_upper or line_clean_upper.startswith('A:') or 
                  line_clean_upper.startswith('A -') or line_clean_upper == 'A'):
                current_section = 'assessment'
                if ':' in line_clean or '-' in line_clean:
                    parts = line_clean.replace(':', ' ').replace('-', ' ').split(maxsplit=1)
                    if len(parts) > 1 and parts[1]:
                        sections[current_section] += parts[1].strip() + '\n'
                continue
            elif ('PLAN' in line_clean_upper or line_clean_upper.startswith('P:') or 
                  line_clean_upper.startswith('P -') or line_clean_upper == 'P'):
                current_section = 'plan'
                if ':' in line_clean or '-' in line_clean:
                    parts = line_clean.replace(':', ' ').replace('-', ' ').split(maxsplit=1)
                    if len(parts) > 1 and parts[1]:
                        sections[current_section] += parts[1].strip() + '\n'
                continue
            
            # Add content to current section
            if current_section and line_stripped and not line_stripped.startswith('#'):
                sections[current_section] += line + '\n'
        
        logger.info(f"[SOAP] Parsed sections - S:{len(sections['subjective'])} O:{len(sections['objective'])} A:{len(sections['assessment'])} P:{len(sections['plan'])}")
        
        # Extract additional information
        chief_complaint = self._extract_chief_complaint(sections['subjective'])
        diagnoses = self._extract_diagnoses(sections['assessment'])
        
        return SOAPNote(
            subjective=sections['subjective'].strip(),
            objective=sections['objective'].strip(),
            assessment=sections['assessment'].strip(),
            plan=sections['plan'].strip(),
            session_id=session_id,
            generated_at=datetime.utcnow().isoformat(),
            chief_complaint=chief_complaint,
            primary_diagnosis=diagnoses[0] if diagnoses else None,
            differential_diagnoses=diagnoses[1:] if len(diagnoses) > 1 else []
        )
    
    def _extract_chief_complaint(self, subjective: str) -> Optional[str]:
        """Extract chief complaint from subjective section"""
        lines = subjective.split('\n')
        for line in lines:
            if 'chief complaint' in line.lower() or 'cc:' in line.lower():
                return line.split(':', 1)[-1].strip()
        
        # Return first sentence as chief complaint
        if lines:
            return lines[0].strip()
        
        return None
    
    def _extract_diagnoses(self, assessment: str) -> List[str]:
        """Extract diagnoses from assessment section"""
        diagnoses = []
        lines = assessment.split('\n')
        
        for line in lines:
            line = line.strip()
            if line.startswith(('1.', '2.', '3.', '-', '•')):
                diagnosis = line.lstrip('0123456789.-•').strip()
                if diagnosis:
                    diagnoses.append(diagnosis)
        
        return diagnoses
    
    async def _enrich_soap_note(self, soap: SOAPNote, session_data: Dict) -> SOAPNote:
        """Enrich SOAP note with detected information"""
        # Add ICD-10 codes from detections
        detections = session_data.get('disease_detections', [])
        if detections:
            soap.icd10_codes = [d['icd10_code'] for d in detections if d.get('icd10_code')]
            
            if not soap.differential_diagnoses:
                soap.differential_diagnoses = [
                    d['disease_name'] for d in detections[:5]
                ]
        
        return soap
    
    async def _save_soap_note(self, session_id: str, soap: SOAPNote):
        """Save SOAP note to Firestore"""
        session_ref = self.db.collection('sessions').document(session_id)
        
        soap_data = {
            'subjective': soap.subjective,
            'objective': soap.objective,
            'assessment': soap.assessment,
            'plan': soap.plan,
            'chief_complaint': soap.chief_complaint,
            'primary_diagnosis': soap.primary_diagnosis,
            'differential_diagnoses': soap.differential_diagnoses,
            'icd10_codes': soap.icd10_codes,
            'generated_at': soap.generated_at
        }
        
        await asyncio.to_thread(
            session_ref.update,
            {
                'soap_note': soap_data,
                'soap_generated_at': firestore.SERVER_TIMESTAMP
            }
        )
    
    async def _generate_pdf(self, session_id: str, soap: SOAPNote):
        """Generate PDF version of SOAP note"""
        from reportlab.lib.pagesizes import letter
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import inch
        from google.cloud import storage
        import io
        
        # Create PDF buffer
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        styles = getSampleStyleSheet()
        story = []
        
        # Title
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            textColor='#003366'
        )
        story.append(Paragraph("SOAP Note", title_style))
        story.append(Spacer(1, 0.2*inch))
        
        # Session info
        story.append(Paragraph(f"<b>Session ID:</b> {session_id}", styles['Normal']))
        story.append(Paragraph(f"<b>Generated:</b> {soap.generated_at}", styles['Normal']))
        if soap.chief_complaint:
            story.append(Paragraph(f"<b>Chief Complaint:</b> {soap.chief_complaint}", styles['Normal']))
        story.append(Spacer(1, 0.3*inch))
        
        # SOAP sections
        section_style = ParagraphStyle(
            'SectionTitle',
            parent=styles['Heading2'],
            fontSize=16,
            textColor='#003366',
            spaceAfter=12
        )
        
        # Subjective
        story.append(Paragraph("SUBJECTIVE", section_style))
        story.append(Paragraph(soap.subjective.replace('\n', '<br/>'), styles['Normal']))
        story.append(Spacer(1, 0.2*inch))
        
        # Objective
        story.append(Paragraph("OBJECTIVE", section_style))
        story.append(Paragraph(soap.objective.replace('\n', '<br/>'), styles['Normal']))
        story.append(Spacer(1, 0.2*inch))
        
        # Assessment
        story.append(Paragraph("ASSESSMENT", section_style))
        story.append(Paragraph(soap.assessment.replace('\n', '<br/>'), styles['Normal']))
        story.append(Spacer(1, 0.2*inch))
        
        # Plan
        story.append(Paragraph("PLAN", section_style))
        story.append(Paragraph(soap.plan.replace('\n', '<br/>'), styles['Normal']))
        
        # Build PDF
        doc.build(story)
        
        # Upload to Cloud Storage
        storage_client = storage.Client()
        bucket = storage_client.bucket(f"{self.project_id}-soap-notes")
        blob = bucket.blob(f"soap-notes/{session_id}.pdf")
        
        buffer.seek(0)
        await asyncio.to_thread(
            blob.upload_from_file,
            buffer,
            content_type='application/pdf'
        )
        
        # Bucket is already publicly readable via IAM policy
        public_url = f"https://storage.googleapis.com/{bucket.name}/{blob.name}"
        
        logger.info(f"SOAP note PDF saved: gs://{bucket.name}/{blob.name}")
        logger.info(f"Public URL: {public_url}")


# FastAPI application
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="SOAP Note Generation Service")

# Configure CORS
# Note: allow_credentials=True cannot be used with allow_origins=["*"]
# For development, we'll use False to support any origin
frontend_origins_env = os.getenv("FRONTEND_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").strip()
allowed_origins = [o.strip() for o in frontend_origins_env.split(",") if o.strip()]

# If FRONTEND_ORIGINS env var is set to "*", allow all origins without credentials
if allowed_origins == ["*"]:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    # If specific origins are provided, use them
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

soap_service = SOAPGeneratorService()


class DiseaseInfo(BaseModel):
    disease_name: str
    icd10_code: str
    confidence: float
    severity: Optional[str] = None


class SOAPRequest(BaseModel):
    session_id: str
    transcript: str  # Direct transcript instead of querying Firestore
    detected_diseases: Optional[List[DiseaseInfo]] = []
    specialty: Optional[str] = 'general'
    custom_template: Optional[str] = None


class SOAPResponse(BaseModel):
    session_id: str
    subjective: str
    objective: str
    assessment: str
    plan: str
    chief_complaint: Optional[str]
    icd10_codes: Optional[List[str]]
    pdf_url: str


@app.post("/v1/soap/generate", response_model=SOAPResponse)
async def generate_soap(request: SOAPRequest):
    """Generate SOAP note for session"""
    logger.info(f"[SOAP] Generating for session {request.session_id}, transcript length: {len(request.transcript)}, diseases: {len(request.detected_diseases)}")

    # Generate SOAP note directly from transcript
    soap_note = await soap_service.generate_soap_note_from_transcript(
        session_id=request.session_id,
        transcript=request.transcript,
        detected_diseases=[d.dict() for d in request.detected_diseases],
        specialty=request.specialty,
        custom_template=request.custom_template
    )

    # Generate PDF
    await soap_service._generate_pdf(request.session_id, soap_note)

    pdf_url = f"gs://{soap_service.project_id}-soap-notes/soap-notes/{request.session_id}.pdf"

    logger.info(f"[SOAP] Generated SOAP note for {request.session_id}")

    return SOAPResponse(
        session_id=soap_note.session_id,
        subjective=soap_note.subjective,
        objective=soap_note.objective,
        assessment=soap_note.assessment,
        plan=soap_note.plan,
        chief_complaint=soap_note.chief_complaint,
        icd10_codes=soap_note.icd10_codes,
        pdf_url=pdf_url
    )


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "soap-generation"}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8080"))
    uvicorn.run(app, host="0.0.0.0", port=port)
