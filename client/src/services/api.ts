import { Patient, TranscriptionSession, DetectedCondition, Appointment } from '../data/patients';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface ReviewSubmission {
  sessionId: string;
  patientId: string;
  reviewedBy: string;
  doctorNotes: string;
  approvedConditions: string[];
  modifiedDiagnosis?: string;
  treatmentPlan?: string;
}

interface TranscriptionRequest {
  patientId: string;
  audioData?: Blob;
  transcript?: string;
}

interface SOAPNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
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
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

export const PatientAPI = {
  getAll: (params?: { page?: number; limit?: number; status?: string; search?: string }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.status) query.set('status', params.status);
    if (params?.search) query.set('search', params.search);
    return apiRequest<PaginatedResponse<Patient>>(`/api/patients?${query}`);
  },

  getById: (id: string) => {
    return apiRequest<Patient>(`/api/patients/${id}`);
  },

  create: (patient: Omit<Patient, 'id'>) => {
    return apiRequest<Patient>('/api/patients', {
      method: 'POST',
      body: JSON.stringify(patient),
    });
  },

  update: (id: string, patient: Partial<Patient>) => {
    return apiRequest<Patient>(`/api/patients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(patient),
    });
  },

  delete: (id: string) => {
    return apiRequest<void>(`/api/patients/${id}`, {
      method: 'DELETE',
    });
  },

  getByStatus: (status: 'active' | 'inactive' | 'needs-review') => {
    return apiRequest<Patient[]>(`/api/patients/status/${status}`);
  },

  getPendingReviews: () => {
    return apiRequest<Patient[]>('/api/patients/pending-reviews');
  },
};

export const TranscriptionAPI = {
  getSessions: (patientId: string) => {
    return apiRequest<TranscriptionSession[]>(`/api/patients/${patientId}/sessions`);
  },

  getSession: (patientId: string, sessionId: string) => {
    return apiRequest<TranscriptionSession>(`/api/patients/${patientId}/sessions/${sessionId}`);
  },

  createSession: (patientId: string, data: TranscriptionRequest) => {
    return apiRequest<TranscriptionSession>(`/api/patients/${patientId}/sessions`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateSession: (patientId: string, sessionId: string, data: Partial<TranscriptionSession>) => {
    return apiRequest<TranscriptionSession>(`/api/patients/${patientId}/sessions/${sessionId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  deleteSession: (patientId: string, sessionId: string) => {
    return apiRequest<void>(`/api/patients/${patientId}/sessions/${sessionId}`, {
      method: 'DELETE',
    });
  },

  transcribeAudio: (audioBlob: Blob, patientId?: string) => {
    const formData = new FormData();
    formData.append('audio', audioBlob);
    if (patientId) formData.append('patientId', patientId);
    
    return fetch(`${API_BASE_URL}/api/transcribe`, {
      method: 'POST',
      body: formData,
    }).then(res => res.json());
  },

  generateSOAP: (transcript: string, patientContext?: Partial<Patient>) => {
    return apiRequest<SOAPNote>('/api/soap/generate', {
      method: 'POST',
      body: JSON.stringify({ transcript, patientContext }),
    });
  },

  detectDiseases: (transcript: string) => {
    return apiRequest<DetectedCondition[]>('/api/diseases/detect', {
      method: 'POST',
      body: JSON.stringify({ transcript }),
    });
  },
};

export const ReviewAPI = {
  getPending: () => {
    return apiRequest<TranscriptionSession[]>('/api/reviews/pending');
  },

  getByPatient: (patientId: string) => {
    return apiRequest<TranscriptionSession[]>(`/api/reviews/patient/${patientId}`);
  },

  submit: (review: ReviewSubmission) => {
    return apiRequest<TranscriptionSession>('/api/reviews/submit', {
      method: 'POST',
      body: JSON.stringify(review),
    });
  },

  approve: (sessionId: string, reviewedBy: string, notes?: string) => {
    return apiRequest<TranscriptionSession>(`/api/reviews/${sessionId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ reviewedBy, notes }),
    });
  },

  reject: (sessionId: string, reviewedBy: string, reason: string) => {
    return apiRequest<TranscriptionSession>(`/api/reviews/${sessionId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reviewedBy, reason }),
    });
  },

  requestChanges: (sessionId: string, reviewedBy: string, changes: string) => {
    return apiRequest<TranscriptionSession>(`/api/reviews/${sessionId}/request-changes`, {
      method: 'POST',
      body: JSON.stringify({ reviewedBy, changes }),
    });
  },
};

export const AppointmentAPI = {
  getAll: (params?: { startDate?: string; endDate?: string; patientId?: string }) => {
    const query = new URLSearchParams();
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);
    if (params?.patientId) query.set('patientId', params.patientId);
    return apiRequest<Appointment[]>(`/api/appointments?${query}`);
  },

  getById: (id: string) => {
    return apiRequest<Appointment>(`/api/appointments/${id}`);
  },

  create: (appointment: Omit<Appointment, 'id'>) => {
    return apiRequest<Appointment>('/api/appointments', {
      method: 'POST',
      body: JSON.stringify(appointment),
    });
  },

  update: (id: string, appointment: Partial<Appointment>) => {
    return apiRequest<Appointment>(`/api/appointments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(appointment),
    });
  },

  delete: (id: string) => {
    return apiRequest<void>(`/api/appointments/${id}`, {
      method: 'DELETE',
    });
  },

  getByDate: (date: string) => {
    return apiRequest<Appointment[]>(`/api/appointments/date/${date}`);
  },
};

export const StatsAPI = {
  getDashboard: () => {
    return apiRequest<{
      totalPatients: number;
      activeCases: number;
      pendingReviews: number;
      todaysDiagnoses: number;
      recentActivity: Array<{
        patientId: string;
        patientName: string;
        action: string;
        timestamp: string;
      }>;
    }>('/api/stats/dashboard');
  },

  getPatientStats: (patientId: string) => {
    return apiRequest<{
      totalSessions: number;
      pendingReviews: number;
      completedReviews: number;
      conditionsDetected: number;
    }>(`/api/stats/patient/${patientId}`);
  },
};

export const AuthAPI = {
  login: (email: string, password: string) => {
    return apiRequest<{ token: string; user: { id: string; name: string; role: string } }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  logout: () => {
    return apiRequest<void>('/api/auth/logout', { method: 'POST' });
  },

  getCurrentUser: () => {
    return apiRequest<{ id: string; name: string; email: string; role: string }>('/api/auth/me');
  },

  refreshToken: () => {
    return apiRequest<{ token: string }>('/api/auth/refresh', { method: 'POST' });
  },
};

export { API_BASE_URL };
