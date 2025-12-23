# Medical Transcriber Pipeline

AI-powered medical transcription system with real-time disease detection, SOAP note generation, and clinical recommendations.

## Live Services

| Service | URL |
|---------|-----|
| Transcription | https://transcription-service-7748133863.us-central1.run.app |
| Disease Detection | https://disease-detection-service-7748133863.us-central1.run.app |
| SOAP Generator | https://soap-generator-service-7748133863.us-central1.run.app |
| Recommendations | https://recommendations-service-7748133863.us-central1.run.app |

## Architecture

```
┌─────────────────┐     ┌───────────────────────────────────────────────────────┐
│   React Client  │────▶│           Google Cloud Run Services                   │
└─────────────────┘     │                                                       │
                        │  ┌─────────────────────┐  ┌─────────────────────────┐ │
                        │  │ Transcription       │  │ Disease Detection       │ │
                        │  │ (Deepgram/Assembly) │  │ (Vertex AI BioBERT)     │ │
                        │  └─────────────────────┘  └─────────────────────────┘ │
                        │  ┌─────────────────────┐  ┌─────────────────────────┐ │
                        │  │ SOAP Generator      │  │ Recommendations         │ │
                        │  │ (Gemini Pro)        │  │ (Gemini Pro)            │ │
                        │  └─────────────────────┘  └─────────────────────────┘ │
                        └───────────────────────────────────────────────────────┘
```

## Quick Start

### Client Setup

```bash
cd client
npm install
npm start
```

The client is pre-configured to use the deployed Google Cloud Run services.

### Local Development

To run services locally, update `.env`:

```bash
cd client
cp .env.example .env
# Edit URLs to point to localhost if running services locally
```

## API Reference

### Transcription Service

**Base URL:** `https://transcription-service-7748133863.us-central1.run.app`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/v1/sessions` | POST | Create transcription session |
| `/v1/sessions/{id}` | GET | Get session details |
| `/v1/transcribe` | POST | Transcribe audio file |

### Disease Detection Service

**Base URL:** `https://disease-detection-service-7748133863.us-central1.run.app`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/detect` | POST | Detect diseases from text |
| `/detect-batch` | POST | Batch disease detection |

**Request:**
```json
{
  "text": "Patient reports chest pain and shortness of breath",
  "session_id": "optional-session-id"
}
```

**Response:**
```json
{
  "diseases": [
    {
      "disease": "chest_pain",
      "disease_name": "Chest Pain",
      "icd10_code": "R07.9",
      "confidence": 0.92,
      "severity": "high"
    }
  ]
}
```

### SOAP Generator Service

**Base URL:** `https://soap-generator-service-7748133863.us-central1.run.app`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/generate` | POST | Generate SOAP note |
| `/generate-pdf` | POST | Generate SOAP note with PDF |

**Request:**
```json
{
  "transcript": "Full conversation transcript...",
  "patient_id": "P-001",
  "detected_diseases": []
}
```

### Recommendations Service

**Base URL:** `https://recommendations-service-7748133863.us-central1.run.app`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/recommend` | POST | Get clinical recommendations |

## Environment Variables

### Client (.env)

```
REACT_APP_TRANSCRIPTION_URL=https://transcription-service-7748133863.us-central1.run.app
REACT_APP_DISEASE_DETECTION_URL=https://disease-detection-service-7748133863.us-central1.run.app
REACT_APP_SOAP_GENERATOR_URL=https://soap-generator-service-7748133863.us-central1.run.app
REACT_APP_RECOMMENDATIONS_URL=https://recommendations-service-7748133863.us-central1.run.app
```

### Services (Google Cloud Run)

```
GOOGLE_CLOUD_PROJECT=transcriberx-477408
DEEPGRAM_API_KEY=<configured-in-cloud-run>
VERTEX_AI_LOCATION=us-central1
```

### Cassandra API Endpoints (Optional)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/transcriptions` | POST | Save transcription |
| `/api/transcriptions/{id}` | GET | Get transcription |
| `/api/transcriptions/{id}` | PUT | Update transcription |
| `/api/transcriptions/patient/{id}` | GET | Get by patient |
| `/api/transcriptions/pending-review` | GET | Get pending reviews |
| `/api/reviews` | POST | Save review |
| `/api/reviews/{id}` | GET | Get review |
| `/api/reviews/{id}` | PUT | Update review |
| `/api/reviews/patient/{id}` | GET | Get reviews by patient |
| `/health` | GET | Health check |



## Project Structure

```
medical-transcriber-pipeline/
├── client/                    # React frontend
│   ├── src/
│   │   ├── App.tsx           # Main app with transcription logic
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx # Main dashboard
│   │   │   ├── LoginPage.tsx # Authentication
│   │   │   └── TranscribeLegacy.tsx
│   │   ├── components/
│   │   │   └── PatientDetails.tsx
│   │   ├── data/
│   │   │   └── patients.ts   # Types and mock data
│   │   ├── services/
│   │   │   └── api.ts        # API service layer
│   │   └── styles/
│   └── public/
├── services/
│   ├── transcription/        # Audio transcription (Deepgram)
│   ├── disease-detection/    # AI disease detection (Vertex AI BioBERT)
│   ├── soap-generator/       # SOAP note generation (Gemini Pro)
│   └── recommendations/      # Clinical recommendations (Gemini Pro)
├── scripts/                  # Deployment scripts
└── terraform/               # Infrastructure as code
```


## Features

- **Real-time Transcription** - Live audio-to-text with speaker diarization
- **Disease Detection** - AI-powered condition identification with ICD-10 codes
- **SOAP Notes** - Automatic clinical documentation generation
- **Recommendations** - Evidence-based clinical suggestions
- **PDF Export** - Download SOAP notes as PDF
- **Patient Management** - Dashboard for managing patients and sessions

## Tech Stack

- **Frontend:** React 18, TypeScript, Framer Motion
- **Backend:** Python FastAPI
- **AI/ML:** Google Vertex AI, BioBERT, Gemini Pro
- **Transcription:** Deepgram
- **Infrastructure:** Google Cloud Run, Terraform

## Deploy to Google Cloud

### Prerequisites

```bash
# Install Google Cloud CLI
brew install google-cloud-sdk

# Authenticate
gcloud auth login
gcloud config set project transcriberx-477408
gcloud config set run/region us-central1
```

### Deploy Services

```bash
# Deploy Transcription Service
cd services/transcription
gcloud run deploy transcription-service \
  --source . \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --set-env-vars "DEEPGRAM_API_KEY=key"

# Deploy Disease Detection Service
cd ../disease-detection
gcloud run deploy disease-detection-service \
  --source . \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2

# Deploy SOAP Generator Service
cd ../soap-generator
gcloud run deploy soap-generator-service \
  --source . \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1

# Deploy Recommendations Service
cd ../recommendations
gcloud run deploy recommendations-service \
  --source . \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1
```

### Deploy Client

```bash
cd client
npm run build

# Option 1: Deploy to Cloud Run
gcloud run deploy medical-transcriber-client \
  --source . \
  --allow-unauthenticated \
  --memory 512Mi

# Option 2: Deploy to Firebase Hosting
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```

### Deploy All (Script)

```bash
./scripts/deploy-all.sh
```

### Update Existing Services

```bash
# Redeploy a specific service after code changes
gcloud run deploy <service-name> --source .

# View deployed services
gcloud run services list

# View logs
gcloud run services logs read <service-name>

# Delete a service
gcloud run services delete <service-name>
```
