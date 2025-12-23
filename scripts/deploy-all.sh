#!/bin/bash

# Medical Transcriber Pipeline Deployment Script
# Deploys all services to Google Cloud Platform

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID=${GCP_PROJECT_ID:-"transcriberx-477408"}
REGION=${REGION:-"us-central1"}

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Medical Transcriber Pipeline Deployment${NC}"
echo -e "${GREEN}========================================${NC}"

# Check if PROJECT_ID is set
if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}Error: GCP_PROJECT_ID environment variable not set${NC}"
    echo "Please set it using: export GCP_PROJECT_ID=your-project-id"
    exit 1
fi

echo -e "${YELLOW}Project ID: $PROJECT_ID${NC}"
echo -e "${YELLOW}Region: $REGION${NC}"

# Set gcloud project
echo -e "\n${GREEN}Setting gcloud project...${NC}"
gcloud config set project $PROJECT_ID

# Enable required APIs
echo -e "\n${GREEN}Enabling required APIs...${NC}"
./scripts/enable-apis.sh

# Build and push Docker images
echo -e "\n${GREEN}Building and pushing Docker images...${NC}"

SERVICES=("transcription" "disease-detection" "soap-generator" "recommendations")

for service in "${SERVICES[@]}"; do
    echo -e "\n${YELLOW}Building $service service...${NC}"
    
    cd services/$service
    
    # Build Docker image for AMD64 (Cloud Run requirement)
    docker build --platform linux/amd64 -t ${REGION}-docker.pkg.dev/${PROJECT_ID}/medical-transcriber/${service}:latest .
    
    # Push to Artifact Registry
    docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/medical-transcriber/${service}:latest
    
    cd ../..
    
    echo -e "${GREEN}✓ $service service built and pushed${NC}"
done

# Deploy infrastructure with Terraform
echo -e "\n${GREEN}Deploying infrastructure with Terraform...${NC}"
cd terraform

terraform init

terraform plan \
    -var="project_id=${PROJECT_ID}" \
    -var="region=${REGION}" \
    -out=tfplan

terraform apply tfplan

cd ..

echo -e "${GREEN}✓ Infrastructure deployed${NC}"

# Wait for services to be ready
echo -e "\n${YELLOW}Waiting for services to be ready...${NC}"
sleep 30

# Get service URLs
echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"

echo -e "\n${YELLOW}Service URLs:${NC}"

for service in "${SERVICES[@]}"; do
    SERVICE_NAME="${service}-service"
    URL=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format='value(status.url)' 2>/dev/null || echo "Not deployed")
    echo -e "${GREEN}$service:${NC} $URL"
done

# Create secrets if they don't exist
echo -e "\n${YELLOW}Setting up secrets...${NC}"

# Check if OpenAI API key secret exists
if ! gcloud secrets describe openai-api-key &>/dev/null; then
    echo -e "${YELLOW}Please enter your OpenAI API key:${NC}"
    read -s OPENAI_KEY
    echo -n $OPENAI_KEY | gcloud secrets create openai-api-key --data-file=-
    echo -e "${GREEN}✓ OpenAI API key secret created${NC}"
else
    echo -e "${GREEN}✓ OpenAI API key secret already exists${NC}"
fi

# Generate and store database password
if ! gcloud secrets describe db-password &>/dev/null; then
    DB_PASSWORD=$(openssl rand -base64 32)
    echo -n $DB_PASSWORD | gcloud secrets create db-password --data-file=-
    echo -e "${GREEN}✓ Database password secret created${NC}"
else
    echo -e "${GREEN}✓ Database password secret already exists${NC}"
fi

# Initialize database
echo -e "\n${YELLOW}Initializing database...${NC}"
./scripts/init-database.sh

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment successful!${NC}"
echo -e "${GREEN}========================================${NC}"

echo -e "\n${YELLOW}Next steps:${NC}"
echo "1. Configure authentication in API Gateway"
echo "2. Set up monitoring alerts"
echo "3. Configure backup policies"
echo "4. Run integration tests: ./scripts/run-integration-tests.sh"
echo "5. Access the API documentation at: <service-url>/docs"

echo -e "\n${YELLOW}To test the deployment:${NC}"
echo "curl \$(gcloud run services describe transcription-service --region=$REGION --format='value(status.url)')/health"
