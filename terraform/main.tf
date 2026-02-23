terraform {
  required_version = ">= 1.0"
  
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }

  backend "gcs" {
    bucket = "transcriberx-terraform-state"
    prefix = "terraform/state"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

variable "project_id" {
  description = "GCP Project ID"
  type        = string
  default     = "transcriberx-477408"
}

variable "region" {
  description = "GCP Region"
  type        = string
  default     = "us-central1"
}

# Secrets from Secret Manager
data "google_secret_manager_secret_version" "deepgram" {
  secret = "deepgram-api-key"
  project = var.project_id
}

data "google_secret_manager_secret_version" "assemblyai" {
  secret = "assemblyai-api-key"
  project = var.project_id
}

locals {
  services = {
    transcription = {
      name   = "transcription-service"
      memory = "1Gi"
      cpu    = "1"
      env = {
        DEEPGRAM_API_KEY = data.google_secret_manager_secret_version.deepgram.secret_data
        ASSEMBLYAI_API_KEY = data.google_secret_manager_secret_version.assemblyai.secret_data
        TRANSCRIPTION_PROVIDER = "deepgram"
      }
    }
    disease_detection = {
      name   = "disease-detection-service"
      memory = "2Gi"
      cpu    = "2"
      env    = {}
    }
    soap_generator = {
      name   = "soap-generator-service"
      memory = "1Gi"
      cpu    = "1"
      env    = {}
    }
    recommendations = {
      name   = "recommendations-service"
      memory = "1Gi"
      cpu    = "1"
      env    = {}
    }
  }
}

resource "google_project_service" "apis" {
  for_each = toset([
    "run.googleapis.com",
    "cloudbuild.googleapis.com",
    "artifactregistry.googleapis.com",
    "aiplatform.googleapis.com",
    "speech.googleapis.com",
    "storage.googleapis.com"
  ])
  
  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

resource "google_cloud_run_v2_service" "services" {
  for_each = local.services

  name     = each.value.name
  location = var.region
  
  template {
    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/medical-transcriber/${each.value.name}:latest"
      
      resources {
        limits = {
          memory = each.value.memory
          cpu    = each.value.cpu
        }
      }

      dynamic "env" {
        for_each = each.value.env
        content {
          name  = env.key
          value = env.value
        }
      }

      env {
        name  = "GOOGLE_CLOUD_PROJECT"
        value = var.project_id
      }

      env {
        name  = "VERTEX_AI_LOCATION"
        value = var.region
      }
    }

    scaling {
      min_instance_count = 0
      max_instance_count = 10
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  depends_on = [google_project_service.apis]
}

resource "google_cloud_run_v2_service_iam_member" "public_access" {
  for_each = local.services

  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.services[each.key].name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_storage_bucket" "soap_pdfs" {
  name          = "${var.project_id}-soap-pdfs"
  location      = var.region
  force_destroy = false

  uniform_bucket_level_access = true

  lifecycle_rule {
    condition {
      age = 365
    }
    action {
      type = "Delete"
    }
  }
}

resource "google_storage_bucket_iam_member" "soap_pdfs_public" {
  bucket = google_storage_bucket.soap_pdfs.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}

output "service_urls" {
  description = "URLs of deployed Cloud Run services"
  value = {
    for key, service in google_cloud_run_v2_service.services :
    key => service.uri
  }
}

output "soap_pdf_bucket" {
  description = "GCS bucket for SOAP PDF storage"
  value       = google_storage_bucket.soap_pdfs.url
}
