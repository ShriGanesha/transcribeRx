import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { 
  TranscriptionDataService, 
  ReviewDataService, 
  TranscriptionRecord, 
  ReviewRecord,
  DataServiceStatus 
} from '../services/cassandraData';
import { DetectedCondition } from '../data/patients';

interface SOAPNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

interface Recommendation {
  recommendation: string;
  category: string;
  priority: string;
  rationale: string;
}

interface TranscriptionState {
  sessionId: string | null;
  patientId: string | null;
  transcript: string;
  transcriptHistory: string[];
  diseases: DetectedCondition[];
  soapNote: SOAPNote | null;
  recommendations: Recommendation[];
  status: TranscriptionRecord['status'];
  recordId: string | null;
}

interface ReviewState {
  clinicalNotes: string;
  diagnosis: string;
  treatmentPlan: string;
  submitted: boolean;
  recordId: string | null;
}

interface DataContextType {
  transcription: TranscriptionState;
  review: ReviewState;
  pastTranscriptions: TranscriptionRecord[];
  pastReviews: ReviewRecord[];
  dataMode: 'cassandra' | 'local';
  isLoading: boolean;

  setTranscriptionSession: (sessionId: string, patientId: string) => void;
  updateTranscript: (transcript: string) => void;
  addToTranscriptHistory: (line: string) => void;
  setDiseases: (diseases: DetectedCondition[]) => void;
  setSoapNote: (note: SOAPNote) => void;
  setRecommendations: (recs: Recommendation[]) => void;
  completeTranscription: () => Promise<void>;

  updateReviewNotes: (notes: string) => void;
  updateReviewDiagnosis: (diagnosis: string) => void;
  updateReviewPlan: (plan: string) => void;
  submitReview: (doctorId: string, doctorName: string) => Promise<void>;
  resetReview: () => void;

  loadPastTranscriptions: (patientId?: string) => Promise<void>;
  loadPastReviews: (patientId?: string) => Promise<void>;
  loadTranscriptionById: (id: string) => Promise<TranscriptionRecord | null>;
  loadReviewById: (id: string) => Promise<ReviewRecord | null>;

  resetSession: () => void;
}

const initialTranscription: TranscriptionState = {
  sessionId: null,
  patientId: null,
  transcript: '',
  transcriptHistory: [],
  diseases: [],
  soapNote: null,
  recommendations: [],
  status: 'in-progress',
  recordId: null,
};

const initialReview: ReviewState = {
  clinicalNotes: '',
  diagnosis: '',
  treatmentPlan: '',
  submitted: false,
  recordId: null,
};

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode; doctorId: string }> = ({ children, doctorId }) => {
  const [transcription, setTranscription] = useState<TranscriptionState>(initialTranscription);
  const [review, setReview] = useState<ReviewState>(initialReview);
  const [pastTranscriptions, setPastTranscriptions] = useState<TranscriptionRecord[]>([]);
  const [pastReviews, setPastReviews] = useState<ReviewRecord[]>([]);
  const [dataMode, setDataMode] = useState<'cassandra' | 'local'>('local');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const checkStatus = async () => {
      const mode = DataServiceStatus.getMode();
      setDataMode(mode);
    };
    checkStatus();
  }, []);

  const setTranscriptionSession = useCallback((sessionId: string, patientId: string) => {
    setTranscription(prev => ({
      ...prev,
      sessionId,
      patientId,
      status: 'in-progress',
    }));
  }, []);

  const updateTranscript = useCallback((transcript: string) => {
    setTranscription(prev => ({ ...prev, transcript }));
  }, []);

  const addToTranscriptHistory = useCallback((line: string) => {
    setTranscription(prev => ({
      ...prev,
      transcriptHistory: [...prev.transcriptHistory, line],
    }));
  }, []);

  const setDiseases = useCallback((diseases: DetectedCondition[]) => {
    setTranscription(prev => ({ ...prev, diseases }));
  }, []);

  const setSoapNote = useCallback((note: SOAPNote) => {
    setTranscription(prev => ({ ...prev, soapNote: note }));
  }, []);

  const setRecommendations = useCallback((recs: Recommendation[]) => {
    setTranscription(prev => ({ ...prev, recommendations: recs }));
  }, []);

  const completeTranscription = useCallback(async () => {
    if (!transcription.sessionId || !transcription.patientId) return;

    setIsLoading(true);
    try {
      const result = await TranscriptionDataService.save({
        patientId: transcription.patientId,
        doctorId,
        sessionId: transcription.sessionId,
        transcript: transcription.transcript,
        transcriptHistory: transcription.transcriptHistory,
        diseases: transcription.diseases,
        soapNote: transcription.soapNote,
        recommendations: transcription.recommendations,
        status: 'pending-review',
      });

      if (result.success && result.data) {
        setTranscription(prev => ({
          ...prev,
          status: 'pending-review',
          recordId: result.data!.id,
        }));
      }
    } finally {
      setIsLoading(false);
    }
  }, [transcription, doctorId]);

  const updateReviewNotes = useCallback((notes: string) => {
    setReview(prev => ({ ...prev, clinicalNotes: notes }));
  }, []);

  const updateReviewDiagnosis = useCallback((diagnosis: string) => {
    setReview(prev => ({ ...prev, diagnosis }));
  }, []);

  const updateReviewPlan = useCallback((plan: string) => {
    setReview(prev => ({ ...prev, treatmentPlan: plan }));
  }, []);

  const submitReview = useCallback(async (doctorId: string, doctorName: string) => {
    if (!transcription.recordId && !transcription.sessionId) return;

    setIsLoading(true);
    try {
      const result = await ReviewDataService.save({
        transcriptionId: transcription.recordId || transcription.sessionId || '',
        patientId: transcription.patientId || '',
        doctorId,
        doctorName,
        clinicalNotes: review.clinicalNotes,
        diagnosis: review.diagnosis,
        treatmentPlan: review.treatmentPlan,
        status: 'approved',
        aiSoapNote: transcription.soapNote,
        aiDiseases: transcription.diseases,
        aiRecommendations: transcription.recommendations,
      });

      if (result.success && result.data) {
        setReview(prev => ({
          ...prev,
          submitted: true,
          recordId: result.data!.id,
        }));

        if (transcription.recordId) {
          await TranscriptionDataService.update(transcription.recordId, { status: 'reviewed' });
          setTranscription(prev => ({ ...prev, status: 'reviewed' }));
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [transcription, review]);

  const resetReview = useCallback(() => {
    setReview(initialReview);
  }, []);

  const loadPastTranscriptions = useCallback(async (patientId?: string) => {
    setIsLoading(true);
    try {
      const result = patientId
        ? await TranscriptionDataService.getByPatient(patientId)
        : await TranscriptionDataService.getByDoctor(doctorId);
      
      if (result.success && result.data) {
        setPastTranscriptions(result.data);
      }
    } finally {
      setIsLoading(false);
    }
  }, [doctorId]);

  const loadPastReviews = useCallback(async (patientId?: string) => {
    setIsLoading(true);
    try {
      const result = patientId
        ? await ReviewDataService.getByPatient(patientId)
        : await ReviewDataService.getByDoctor(doctorId);
      
      if (result.success && result.data) {
        setPastReviews(result.data);
      }
    } finally {
      setIsLoading(false);
    }
  }, [doctorId]);

  const loadTranscriptionById = useCallback(async (id: string): Promise<TranscriptionRecord | null> => {
    const result = await TranscriptionDataService.getById(id);
    return result.success ? result.data || null : null;
  }, []);

  const loadReviewById = useCallback(async (id: string): Promise<ReviewRecord | null> => {
    const result = await ReviewDataService.getById(id);
    return result.success ? result.data || null : null;
  }, []);

  const resetSession = useCallback(() => {
    setTranscription(initialTranscription);
    setReview(initialReview);
  }, []);

  const value: DataContextType = {
    transcription,
    review,
    pastTranscriptions,
    pastReviews,
    dataMode,
    isLoading,
    setTranscriptionSession,
    updateTranscript,
    addToTranscriptHistory,
    setDiseases,
    setSoapNote,
    setRecommendations,
    completeTranscription,
    updateReviewNotes,
    updateReviewDiagnosis,
    updateReviewPlan,
    submitReview,
    resetReview,
    loadPastTranscriptions,
    loadPastReviews,
    loadTranscriptionById,
    loadReviewById,
    resetSession,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = (): DataContextType => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};

export type { TranscriptionState, ReviewState, SOAPNote, Recommendation };
