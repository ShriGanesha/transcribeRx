# Terraform Infrastructure for Medical Transcriber

## Prerequisites

1. Install Terraform: `brew install terraform`
2. Install Google Cloud CLI: `brew install google-cloud-sdk`
3. Authenticate: `gcloud auth application-default login`

## Setup

```bash
cd terraform

# Copy and configure variables
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your actual values

# Initialize Terraform
terraform init

# Preview changes
terraform plan

# Apply infrastructure
terraform apply
```

## First-time Setup

Before running Terraform, create the state bucket:

```bash
gcloud storage buckets create gs://transcriberx-terraform-state --location=us-central1
```

Or use local state by removing the `backend "gcs"` block from main.tf.

## Resources Created

- **Cloud Run Services** (4 services)
  - transcription-service
  - disease-detection-service
  - soap-generator-service
  - recommendations-service

- **APIs Enabled**
  - Cloud Run
  - Cloud Build
  - Artifact Registry
  - Vertex AI
  - Speech-to-Text
  - Cloud Storage

- **Storage**
  - GCS bucket for SOAP PDF storage

## Deploy Services

After terraform creates the infrastructure, deploy your service code:

```bash
# Build and push images
cd ../services/transcription
gcloud builds submit --tag gcr.io/transcriberx-477408/transcription-service

cd ../disease-detection
gcloud builds submit --tag gcr.io/transcriberx-477408/disease-detection-service

cd ../soap-generator
gcloud builds submit --tag gcr.io/transcriberx-477408/soap-generator-service

cd ../recommendations
gcloud builds submit --tag gcr.io/transcriberx-477408/recommendations-service
```

## Outputs

After apply, Terraform outputs:
- `service_urls` - URLs for all Cloud Run services
- `soap_pdf_bucket` - GCS bucket URL for PDFs

## Destroy

```bash
terraform destroy
```

## Notes

- Services scale to 0 when not in use (cost-effective)
- All services are publicly accessible (no auth required)
- PDF bucket auto-deletes files after 365 days
