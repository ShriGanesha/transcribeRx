#!/bin/bash

set -e

PROJECT_ID=${GCP_PROJECT_ID}
REGION=${REGION:-"us-central1"}
INSTANCE_NAME="medical-transcriber-db"
DATABASE_NAME="medical_transcriber"

echo "Initializing database schema..."

# Get Cloud SQL instance connection name
CONNECTION_NAME=$(gcloud sql instances describe $INSTANCE_NAME \
    --project=$PROJECT_ID \
    --format="value(connectionName)")

# Create schema
cat > /tmp/schema.sql << 'SCHEMA'
-- Patients table
CREATE TABLE IF NOT EXISTS patients (
    patient_id VARCHAR(50) PRIMARY KEY,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    date_of_birth DATE,
    gender VARCHAR(20),
    email VARCHAR(100),
    phone VARCHAR(20),
    chronic_conditions TEXT[],
    medications TEXT[],
    allergies TEXT[],
    past_surgeries TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Doctors table
CREATE TABLE IF NOT EXISTS doctors (
    doctor_id VARCHAR(50) PRIMARY KEY,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    specialty VARCHAR(100),
    license_number VARCHAR(50),
    email VARCHAR(100),
    phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sessions table (reference only, main data in Firestore)
CREATE TABLE IF NOT EXISTS sessions (
    session_id UUID PRIMARY KEY,
    patient_id VARCHAR(50) REFERENCES patients(patient_id),
    doctor_id VARCHAR(50) REFERENCES doctors(doctor_id),
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    status VARCHAR(20),
    duration_seconds INTEGER,
    word_count INTEGER
);

-- Audit log
CREATE TABLE IF NOT EXISTS audit_log (
    log_id SERIAL PRIMARY KEY,
    session_id UUID,
    user_id VARCHAR(50),
    action VARCHAR(100),
    details JSONB,
    ip_address INET,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sessions_patient ON sessions(patient_id);
CREATE INDEX IF NOT EXISTS idx_sessions_doctor ON sessions(doctor_id);
CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_audit_session ON audit_log(session_id);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);

-- Create update trigger for patients
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON patients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
SCHEMA

echo "Database schema created successfully!"
