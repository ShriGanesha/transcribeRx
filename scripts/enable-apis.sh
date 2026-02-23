#!/bin/bash

set -e

PROJECT_ID=${GCP_PROJECT_ID:-"transcriberx-477408"}

echo "Enabling required GCP APIs..."

apis=(
    "run.googleapis.com"
    "speech.googleapis.com"
    "firestore.googleapis.com"
    "cloudbuild.googleapis.com"
    "artifactregistry.googleapis.com"
    "pubsub.googleapis.com"
    "secretmanager.googleapis.com"
    "cloudscheduler.googleapis.com"
    "cloudtrace.googleapis.com"
    "compute.googleapis.com"
    "vpcaccess.googleapis.com"
    "servicenetworking.googleapis.com"
    "sqladmin.googleapis.com"
    "aiplatform.googleapis.com"
    "storage.googleapis.com"
    "monitoring.googleapis.com"
    "logging.googleapis.com"
)

for api in "${apis[@]}"; do
    echo "Enabling $api..."
    gcloud services enable $api --project=$PROJECT_ID
done

echo "All APIs enabled successfully!"
