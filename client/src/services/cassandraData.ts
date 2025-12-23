import { Patient, DetectedCondition } from '../data/patients';

const CASSANDRA_API_URL = process.env.REACT_APP_CASSANDRA_API_URL || '';
const CASSANDRA_ENABLED = !!CASSANDRA_API_URL;

export interface CassandraConfig {
  enabled: boolean;
  apiUrl: string;
  keyspace: string;
}

export interface TranscriptionRecord {
  id: string;
  patientId: string;
  doctorId: string;
  sessionId: string;
  transcript: string;
  transcriptHistory: string[];
  diseases: DetectedCondition[];
  soapNote: {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
  } | null;
  recommendations: Array<{
    recommendation: string;
    category: string;
    priority: string;
    rationale: string;
  }>;
  status: 'in-progress' | 'pending-review' | 'reviewed' | 'completed';
  createdAt: string;
  updatedAt: string;
}

export interface ReviewRecord {
  id: string;
  transcriptionId: string;
  patientId: string;
  doctorId: string;
  doctorName: string;
  clinicalNotes: string;
  diagnosis: string;
  treatmentPlan: string;
  status: 'pending' | 'approved' | 'rejected' | 'changes-requested';
  aiSoapNote: TranscriptionRecord['soapNote'];
  aiDiseases: DetectedCondition[];
  aiRecommendations: TranscriptionRecord['recommendations'];
  createdAt: string;
  reviewedAt: string;
}

interface CassandraResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function cassandraRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<CassandraResponse<T>> {
  if (!CASSANDRA_ENABLED) {
    console.log('[Cassandra] Not configured - using local storage fallback');
    return { success: false, error: 'Cassandra not configured' };
  }

  try {
    const response = await fetch(`${CASSANDRA_API_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.message || `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('[Cassandra] Request failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

const LOCAL_STORAGE_KEYS = {
  transcriptions: 'medical_transcriptions',
  reviews: 'medical_reviews',
  patients: 'medical_patients',
};

function getLocalData<T>(key: string): T[] {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function setLocalData<T>(key: string, data: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error('[LocalStorage] Failed to save:', error);
  }
}

export const TranscriptionDataService = {
  getConfig: (): CassandraConfig => ({
    enabled: CASSANDRA_ENABLED,
    apiUrl: CASSANDRA_API_URL,
    keyspace: process.env.REACT_APP_CASSANDRA_KEYSPACE || 'medical_transcriber',
  }),

  save: async (record: Omit<TranscriptionRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<CassandraResponse<TranscriptionRecord>> => {
    const fullRecord: TranscriptionRecord = {
      ...record,
      id: `tr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (CASSANDRA_ENABLED) {
      const result = await cassandraRequest<TranscriptionRecord>('/api/transcriptions', {
        method: 'POST',
        body: JSON.stringify(fullRecord),
      });
      if (result.success) return result;
    }

    const localData = getLocalData<TranscriptionRecord>(LOCAL_STORAGE_KEYS.transcriptions);
    localData.push(fullRecord);
    setLocalData(LOCAL_STORAGE_KEYS.transcriptions, localData);
    return { success: true, data: fullRecord };
  },

  update: async (id: string, updates: Partial<TranscriptionRecord>): Promise<CassandraResponse<TranscriptionRecord>> => {
    const updatedData = { ...updates, updatedAt: new Date().toISOString() };

    if (CASSANDRA_ENABLED) {
      const result = await cassandraRequest<TranscriptionRecord>(`/api/transcriptions/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updatedData),
      });
      if (result.success) return result;
    }

    const localData = getLocalData<TranscriptionRecord>(LOCAL_STORAGE_KEYS.transcriptions);
    const index = localData.findIndex(r => r.id === id);
    if (index === -1) return { success: false, error: 'Record not found' };
    
    localData[index] = { ...localData[index], ...updatedData };
    setLocalData(LOCAL_STORAGE_KEYS.transcriptions, localData);
    return { success: true, data: localData[index] };
  },

  getById: async (id: string): Promise<CassandraResponse<TranscriptionRecord>> => {
    if (CASSANDRA_ENABLED) {
      const result = await cassandraRequest<TranscriptionRecord>(`/api/transcriptions/${id}`);
      if (result.success) return result;
    }

    const localData = getLocalData<TranscriptionRecord>(LOCAL_STORAGE_KEYS.transcriptions);
    const record = localData.find(r => r.id === id);
    return record ? { success: true, data: record } : { success: false, error: 'Not found' };
  },

  getByPatient: async (patientId: string): Promise<CassandraResponse<TranscriptionRecord[]>> => {
    if (CASSANDRA_ENABLED) {
      const result = await cassandraRequest<TranscriptionRecord[]>(`/api/transcriptions/patient/${patientId}`);
      if (result.success) return result;
    }

    const localData = getLocalData<TranscriptionRecord>(LOCAL_STORAGE_KEYS.transcriptions);
    return { success: true, data: localData.filter(r => r.patientId === patientId) };
  },

  getByDoctor: async (doctorId: string): Promise<CassandraResponse<TranscriptionRecord[]>> => {
    if (CASSANDRA_ENABLED) {
      const result = await cassandraRequest<TranscriptionRecord[]>(`/api/transcriptions/doctor/${doctorId}`);
      if (result.success) return result;
    }

    const localData = getLocalData<TranscriptionRecord>(LOCAL_STORAGE_KEYS.transcriptions);
    return { success: true, data: localData.filter(r => r.doctorId === doctorId) };
  },

  getPendingReviews: async (): Promise<CassandraResponse<TranscriptionRecord[]>> => {
    if (CASSANDRA_ENABLED) {
      const result = await cassandraRequest<TranscriptionRecord[]>('/api/transcriptions/pending-review');
      if (result.success) return result;
    }

    const localData = getLocalData<TranscriptionRecord>(LOCAL_STORAGE_KEYS.transcriptions);
    return { success: true, data: localData.filter(r => r.status === 'pending-review') };
  },

  getAll: async (): Promise<CassandraResponse<TranscriptionRecord[]>> => {
    if (CASSANDRA_ENABLED) {
      const result = await cassandraRequest<TranscriptionRecord[]>('/api/transcriptions');
      if (result.success) return result;
    }

    return { success: true, data: getLocalData<TranscriptionRecord>(LOCAL_STORAGE_KEYS.transcriptions) };
  },

  delete: async (id: string): Promise<CassandraResponse<void>> => {
    if (CASSANDRA_ENABLED) {
      const result = await cassandraRequest<void>(`/api/transcriptions/${id}`, { method: 'DELETE' });
      if (result.success) return result;
    }

    const localData = getLocalData<TranscriptionRecord>(LOCAL_STORAGE_KEYS.transcriptions);
    setLocalData(LOCAL_STORAGE_KEYS.transcriptions, localData.filter(r => r.id !== id));
    return { success: true };
  },
};

export const ReviewDataService = {
  save: async (record: Omit<ReviewRecord, 'id' | 'createdAt' | 'reviewedAt'>): Promise<CassandraResponse<ReviewRecord>> => {
    const fullRecord: ReviewRecord = {
      ...record,
      id: `rv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      reviewedAt: new Date().toISOString(),
    };

    if (CASSANDRA_ENABLED) {
      const result = await cassandraRequest<ReviewRecord>('/api/reviews', {
        method: 'POST',
        body: JSON.stringify(fullRecord),
      });
      if (result.success) return result;
    }

    const localData = getLocalData<ReviewRecord>(LOCAL_STORAGE_KEYS.reviews);
    localData.push(fullRecord);
    setLocalData(LOCAL_STORAGE_KEYS.reviews, localData);
    return { success: true, data: fullRecord };
  },

  update: async (id: string, updates: Partial<ReviewRecord>): Promise<CassandraResponse<ReviewRecord>> => {
    const updatedData = { ...updates, reviewedAt: new Date().toISOString() };

    if (CASSANDRA_ENABLED) {
      const result = await cassandraRequest<ReviewRecord>(`/api/reviews/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updatedData),
      });
      if (result.success) return result;
    }

    const localData = getLocalData<ReviewRecord>(LOCAL_STORAGE_KEYS.reviews);
    const index = localData.findIndex(r => r.id === id);
    if (index === -1) return { success: false, error: 'Record not found' };
    
    localData[index] = { ...localData[index], ...updatedData };
    setLocalData(LOCAL_STORAGE_KEYS.reviews, localData);
    return { success: true, data: localData[index] };
  },

  getById: async (id: string): Promise<CassandraResponse<ReviewRecord>> => {
    if (CASSANDRA_ENABLED) {
      const result = await cassandraRequest<ReviewRecord>(`/api/reviews/${id}`);
      if (result.success) return result;
    }

    const localData = getLocalData<ReviewRecord>(LOCAL_STORAGE_KEYS.reviews);
    const record = localData.find(r => r.id === id);
    return record ? { success: true, data: record } : { success: false, error: 'Not found' };
  },

  getByTranscription: async (transcriptionId: string): Promise<CassandraResponse<ReviewRecord[]>> => {
    if (CASSANDRA_ENABLED) {
      const result = await cassandraRequest<ReviewRecord[]>(`/api/reviews/transcription/${transcriptionId}`);
      if (result.success) return result;
    }

    const localData = getLocalData<ReviewRecord>(LOCAL_STORAGE_KEYS.reviews);
    return { success: true, data: localData.filter(r => r.transcriptionId === transcriptionId) };
  },

  getByPatient: async (patientId: string): Promise<CassandraResponse<ReviewRecord[]>> => {
    if (CASSANDRA_ENABLED) {
      const result = await cassandraRequest<ReviewRecord[]>(`/api/reviews/patient/${patientId}`);
      if (result.success) return result;
    }

    const localData = getLocalData<ReviewRecord>(LOCAL_STORAGE_KEYS.reviews);
    return { success: true, data: localData.filter(r => r.patientId === patientId) };
  },

  getByDoctor: async (doctorId: string): Promise<CassandraResponse<ReviewRecord[]>> => {
    if (CASSANDRA_ENABLED) {
      const result = await cassandraRequest<ReviewRecord[]>(`/api/reviews/doctor/${doctorId}`);
      if (result.success) return result;
    }

    const localData = getLocalData<ReviewRecord>(LOCAL_STORAGE_KEYS.reviews);
    return { success: true, data: localData.filter(r => r.doctorId === doctorId) };
  },

  getPending: async (): Promise<CassandraResponse<ReviewRecord[]>> => {
    if (CASSANDRA_ENABLED) {
      const result = await cassandraRequest<ReviewRecord[]>('/api/reviews/pending');
      if (result.success) return result;
    }

    const localData = getLocalData<ReviewRecord>(LOCAL_STORAGE_KEYS.reviews);
    return { success: true, data: localData.filter(r => r.status === 'pending') };
  },

  getAll: async (): Promise<CassandraResponse<ReviewRecord[]>> => {
    if (CASSANDRA_ENABLED) {
      const result = await cassandraRequest<ReviewRecord[]>('/api/reviews');
      if (result.success) return result;
    }

    return { success: true, data: getLocalData<ReviewRecord>(LOCAL_STORAGE_KEYS.reviews) };
  },

  delete: async (id: string): Promise<CassandraResponse<void>> => {
    if (CASSANDRA_ENABLED) {
      const result = await cassandraRequest<void>(`/api/reviews/${id}`, { method: 'DELETE' });
      if (result.success) return result;
    }

    const localData = getLocalData<ReviewRecord>(LOCAL_STORAGE_KEYS.reviews);
    setLocalData(LOCAL_STORAGE_KEYS.reviews, localData.filter(r => r.id !== id));
    return { success: true };
  },
};

export const PatientDataService = {
  save: async (patient: Patient): Promise<CassandraResponse<Patient>> => {
    if (CASSANDRA_ENABLED) {
      const result = await cassandraRequest<Patient>('/api/patients', {
        method: 'POST',
        body: JSON.stringify(patient),
      });
      if (result.success) return result;
    }

    const localData = getLocalData<Patient>(LOCAL_STORAGE_KEYS.patients);
    const index = localData.findIndex(p => p.id === patient.id);
    if (index >= 0) {
      localData[index] = patient;
    } else {
      localData.push(patient);
    }
    setLocalData(LOCAL_STORAGE_KEYS.patients, localData);
    return { success: true, data: patient };
  },

  getById: async (id: string): Promise<CassandraResponse<Patient>> => {
    if (CASSANDRA_ENABLED) {
      const result = await cassandraRequest<Patient>(`/api/patients/${id}`);
      if (result.success) return result;
    }

    const localData = getLocalData<Patient>(LOCAL_STORAGE_KEYS.patients);
    const patient = localData.find(p => p.id === id);
    return patient ? { success: true, data: patient } : { success: false, error: 'Not found' };
  },

  getAll: async (): Promise<CassandraResponse<Patient[]>> => {
    if (CASSANDRA_ENABLED) {
      const result = await cassandraRequest<Patient[]>('/api/patients');
      if (result.success) return result;
    }

    return { success: true, data: getLocalData<Patient>(LOCAL_STORAGE_KEYS.patients) };
  },
};

export const DataServiceStatus = {
  check: async (): Promise<{ cassandra: boolean; localStorage: boolean }> => {
    let cassandraOk = false;
    
    if (CASSANDRA_ENABLED) {
      try {
        const response = await fetch(`${CASSANDRA_API_URL}/health`);
        cassandraOk = response.ok;
      } catch {
        cassandraOk = false;
      }
    }

    return {
      cassandra: cassandraOk,
      localStorage: true,
    };
  },

  getMode: (): 'cassandra' | 'local' => CASSANDRA_ENABLED ? 'cassandra' : 'local',
};
