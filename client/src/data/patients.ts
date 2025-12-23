export interface TranscriptionSession {
  id: string;
  date: string;
  duration: string;
  status: 'completed' | 'pending-review' | 'reviewed';
  detectedConditions: DetectedCondition[];
  soapNote?: {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
  };
  reviewedBy?: string;
  reviewDate?: string;
  doctorNotes?: string;
}

export interface DetectedCondition {
  name: string;
  icd10Code: string;
  confidence: number;
  severity: 'low' | 'medium' | 'high';
  detectedDate: string;
  source: 'transcription' | 'manual' | 'imported';
}

export interface Patient {
  id: string;
  name: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  avatar: string;
  phone: string;
  email: string;
  bloodType: string;
  allergies: string[];
  knownConditions: DetectedCondition[];
  medications: string[];
  transcriptionSessions: TranscriptionSession[];
  lastTranscriptionDate: string;
  pendingReviews: number;
  clinicalNotes: {
    date: string;
    note: string;
    author: string;
  }[];
  status: 'active' | 'inactive' | 'needs-review';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  condition: string;
  diagnosis: string;
  lastVisit: string;
  nextAppointment?: string;
  vitals: {
    bloodPressure: string;
    heartRate: number;
    temperature: number;
    oxygenSaturation: number;
  };
  notes: string;
  admissionDate?: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  patientAvatar: string;
  date: string;
  time: string;
  duration: number;
  type: 'checkup' | 'follow-up' | 'consultation' | 'emergency' | 'procedure';
  status: 'scheduled' | 'completed' | 'cancelled' | 'in-progress';
  notes?: string;
}

const icdCodes = ['J18.9', 'J45.40', 'U07.1', 'J06.9', 'E11.65', 'I10', 'I50.9', 'G43.909', 'J44.1', 'F41.1', 'N18.3', 'E03.9'];
const severities: ('low' | 'medium' | 'high')[] = ['medium', 'low', 'high', 'low', 'medium', 'medium', 'high', 'low', 'medium', 'low', 'high', 'low'];
const statuses: ('active' | 'inactive' | 'needs-review')[] = ['active', 'needs-review', 'active', 'inactive', 'needs-review', 'active', 'needs-review', 'active', 'inactive', 'active', 'needs-review', 'active'];

const rawPatients = [
  { id: "p001", name: "John Doe", age: 45, gender: "Male", condition: "Pneumonia", diagnosis: "Community-acquired pneumonia, moderate severity", lastVisit: "2 hours ago", nextAppointment: "2025-01-17", avatar: "JD", phone: "+1 (555) 123-4567", email: "john.doe@email.com", bloodType: "A+", allergies: ["Penicillin", "Sulfa drugs"], medications: ["Azithromycin 500mg", "Acetaminophen PRN"], vitals: { bloodPressure: "128/82", heartRate: 78, temperature: 99.1, oxygenSaturation: 96 }, notes: "Patient responding well to antibiotic treatment.", admissionDate: "2025-01-14", priority: "medium" },
  { id: "p002", name: "Jane Smith", age: 38, gender: "Female", condition: "Asthma", diagnosis: "Moderate persistent asthma, well-controlled", lastVisit: "5 days ago", nextAppointment: "2025-01-20", avatar: "JS", phone: "+1 (555) 234-5678", email: "jane.smith@email.com", bloodType: "O-", allergies: ["Aspirin"], medications: ["Fluticasone inhaler", "Albuterol PRN"], vitals: { bloodPressure: "118/76", heartRate: 72, temperature: 98.4, oxygenSaturation: 98 }, notes: "Asthma well-controlled with current regimen.", priority: "low" },
  { id: "p003", name: "Robert Johnson", age: 62, gender: "Male", condition: "COVID-19", diagnosis: "COVID-19 with hypoxemic respiratory failure", lastVisit: "1 hour ago", avatar: "RJ", phone: "+1 (555) 345-6789", email: "robert.j@email.com", bloodType: "B+", allergies: [], medications: ["Remdesivir", "Dexamethasone", "Supplemental O2"], vitals: { bloodPressure: "142/88", heartRate: 92, temperature: 101.3, oxygenSaturation: 88 }, notes: "Critical condition. Requires close monitoring.", admissionDate: "2025-01-15", priority: "urgent" },
  { id: "p004", name: "Maria Garcia", age: 29, gender: "Female", condition: "Common Cold", diagnosis: "Acute viral upper respiratory infection", lastVisit: "3 days ago", nextAppointment: "2025-01-18", avatar: "MG", phone: "+1 (555) 456-7890", email: "maria.g@email.com", bloodType: "AB+", allergies: ["Latex"], medications: ["OTC decongestant", "Vitamin C supplement"], vitals: { bloodPressure: "112/70", heartRate: 68, temperature: 98.8, oxygenSaturation: 99 }, notes: "Symptoms improving. Continue supportive care.", priority: "low" },
  { id: "p005", name: "William Chen", age: 55, gender: "Male", condition: "Type 2 Diabetes", diagnosis: "Uncontrolled Type 2 Diabetes Mellitus", lastVisit: "Yesterday", nextAppointment: "2025-01-16", avatar: "WC", phone: "+1 (555) 567-8901", email: "w.chen@email.com", bloodType: "A-", allergies: [], medications: ["Metformin 1000mg", "Glipizide 5mg", "Lisinopril 10mg"], vitals: { bloodPressure: "138/85", heartRate: 76, temperature: 98.6, oxygenSaturation: 97 }, notes: "HbA1c elevated at 8.2%. Medication adjustment needed.", priority: "high" },
  { id: "p006", name: "Sarah Williams", age: 42, gender: "Female", condition: "Hypertension", diagnosis: "Essential Hypertension, Stage 2", lastVisit: "1 week ago", nextAppointment: "2025-01-22", avatar: "SW", phone: "+1 (555) 678-9012", email: "sarah.w@email.com", bloodType: "O+", allergies: ["ACE Inhibitors"], medications: ["Amlodipine 10mg", "Losartan 50mg"], vitals: { bloodPressure: "145/92", heartRate: 80, temperature: 98.5, oxygenSaturation: 98 }, notes: "Blood pressure still elevated. May need adjustment.", priority: "medium" },
  { id: "p007", name: "Michael Brown", age: 71, gender: "Male", condition: "Heart Failure", diagnosis: "Congestive Heart Failure, NYHA Class III", lastVisit: "Today", avatar: "MB", phone: "+1 (555) 789-0123", email: "m.brown@email.com", bloodType: "B-", allergies: ["Contrast dye"], medications: ["Furosemide 40mg", "Carvedilol 25mg", "Spironolactone 25mg"], vitals: { bloodPressure: "110/68", heartRate: 88, temperature: 98.2, oxygenSaturation: 91 }, notes: "Increased shortness of breath. Consider diuretic adjustment.", admissionDate: "2025-01-15", priority: "urgent" },
  { id: "p008", name: "Emily Davis", age: 34, gender: "Female", condition: "Migraine", diagnosis: "Chronic Migraine with aura", lastVisit: "4 days ago", nextAppointment: "2025-01-25", avatar: "ED", phone: "+1 (555) 890-1234", email: "emily.d@email.com", bloodType: "A+", allergies: [], medications: ["Sumatriptan 100mg PRN", "Topiramate 50mg"], vitals: { bloodPressure: "115/72", heartRate: 70, temperature: 98.4, oxygenSaturation: 99 }, notes: "Migraine frequency reduced with preventive treatment.", priority: "low" },
  { id: "p009", name: "James Wilson", age: 58, gender: "Male", condition: "COPD", diagnosis: "Chronic Obstructive Pulmonary Disease, GOLD Stage 3", lastVisit: "2 days ago", avatar: "JW", phone: "+1 (555) 901-2345", email: "j.wilson@email.com", bloodType: "O+", allergies: ["Codeine"], medications: ["Tiotropium", "Budesonide/Formoterol", "Prednisone taper"], vitals: { bloodPressure: "132/84", heartRate: 84, temperature: 98.7, oxygenSaturation: 92 }, notes: "Recent exacerbation. Review pulmonary function tests.", priority: "high" },
  { id: "p010", name: "Lisa Anderson", age: 27, gender: "Female", condition: "Anxiety", diagnosis: "Generalized Anxiety Disorder", lastVisit: "1 week ago", nextAppointment: "2025-01-19", avatar: "LA", phone: "+1 (555) 012-3456", email: "lisa.a@email.com", bloodType: "AB-", allergies: [], medications: ["Sertraline 100mg", "Hydroxyzine PRN"], vitals: { bloodPressure: "108/68", heartRate: 74, temperature: 98.3, oxygenSaturation: 99 }, notes: "Symptoms well-controlled. Continue current management.", priority: "low" },
  { id: "p011", name: "David Martinez", age: 48, gender: "Male", condition: "Kidney Disease", diagnosis: "Chronic Kidney Disease, Stage 3b", lastVisit: "Yesterday", avatar: "DM", phone: "+1 (555) 123-4560", email: "d.martinez@email.com", bloodType: "A+", allergies: ["NSAIDs"], medications: ["Losartan 100mg", "Sodium bicarbonate", "Calcitriol"], vitals: { bloodPressure: "148/92", heartRate: 78, temperature: 98.5, oxygenSaturation: 97 }, notes: "GFR declining. Nephrology consultation recommended.", priority: "high" },
  { id: "p012", name: "Jennifer Taylor", age: 33, gender: "Female", condition: "Thyroid Disorder", diagnosis: "Hypothyroidism", lastVisit: "2 weeks ago", nextAppointment: "2025-01-28", avatar: "JT", phone: "+1 (555) 234-5670", email: "j.taylor@email.com", bloodType: "B+", allergies: [], medications: ["Levothyroxine 75mcg"], vitals: { bloodPressure: "118/74", heartRate: 68, temperature: 98.2, oxygenSaturation: 99 }, notes: "TSH levels normalized. Continue current dose.", priority: "low" }
];

export const mockPatients: Patient[] = rawPatients.map((p, i) => ({
  ...p,
  gender: p.gender as 'Male' | 'Female' | 'Other',
  priority: p.priority as 'low' | 'medium' | 'high' | 'urgent',
  status: statuses[i],
  knownConditions: [{
    name: p.condition,
    icd10Code: icdCodes[i],
    confidence: 0.85 + Math.random() * 0.15,
    severity: severities[i],
    detectedDate: p.lastVisit,
    source: 'transcription' as const
  }],
  transcriptionSessions: [{
    id: `ts-${p.id}-001`,
    date: p.lastVisit.includes('hour') ? new Date().toISOString().split('T')[0] : '2024-12-20',
    duration: `${Math.floor(Math.random() * 15) + 5}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`,
    status: (i % 3 === 1 ? 'pending-review' : 'completed') as 'completed' | 'pending-review' | 'reviewed',
    detectedConditions: [{
      name: p.condition,
      icd10Code: icdCodes[i],
      confidence: 0.85 + Math.random() * 0.15,
      severity: severities[i],
      detectedDate: p.lastVisit,
      source: 'transcription' as const
    }],
    soapNote: {
      subjective: `Patient presents with ${p.condition.toLowerCase()} symptoms.`,
      objective: `Vital signs stable. ${p.notes}`,
      assessment: p.diagnosis,
      plan: `Continue current treatment. ${p.medications.join(', ')}.`
    }
  }],
  lastTranscriptionDate: p.lastVisit,
  pendingReviews: i % 3 === 1 ? 1 : 0,
  clinicalNotes: [
    { date: p.lastVisit, note: p.notes, author: 'Dr. Sarah Wilson' },
    { date: '2 weeks ago', note: `Initial assessment for ${p.condition}. ${p.diagnosis}`, author: 'Dr. Sarah Wilson' }
  ]
}));

export const generateAppointments = (patients: Patient[]): Record<string, Appointment[]> => {
  const appointments: Record<string, Appointment[]> = {};
  const today = new Date();
  
  for (let i = -5; i < 30; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    const dateKey = date.toISOString().split('T')[0];
    const numAppointments = Math.floor(Math.random() * 4) + 1;
    const shuffledPatients = [...patients].sort(() => Math.random() - 0.5);
    const dayAppointments: Appointment[] = [];
    
    for (let j = 0; j < numAppointments && j < shuffledPatients.length; j++) {
      const patient = shuffledPatients[j];
      const hour = 8 + j * 2;
      dayAppointments.push({
        id: `apt-${dateKey}-${j}`,
        patientId: patient.id,
        patientName: patient.name,
        patientAvatar: patient.avatar,
        date: dateKey,
        time: `${String(hour).padStart(2, '0')}:00`,
        duration: 30,
        type: j === 0 ? 'consultation' : j === 1 ? 'follow-up' : 'checkup',
        status: i < 0 ? 'completed' : 'scheduled',
        notes: patient.notes
      });
    }
    
    if (dayAppointments.length > 0) {
      appointments[dateKey] = dayAppointments;
    }
  }
  
  return appointments;
};

export const getDashboardStats = (patients: Patient[]) => ({
  totalPatients: patients.length,
  totalSessions: patients.reduce((sum, p) => sum + (p.transcriptionSessions?.length || 0), 0),
  activeCases: patients.filter(p => p.status === 'active' || p.status === 'needs-review').length,
  needsReview: patients.filter(p => p.status === 'needs-review' || (p.pendingReviews && p.pendingReviews > 0)).length,
  todaysDiagnoses: patients.filter(p => p.lastTranscriptionDate?.includes('hour') || p.lastTranscriptionDate === 'Today').length,
  pendingReviews: patients.reduce((sum, p) => sum + (p.pendingReviews || 0), 0)
});

export const getPatientsByStatus = (patients: Patient[], status: Patient['status']) => 
  patients.filter(p => p.status === status);

export const getCriticalPatients = (patients: Patient[]) => 
  patients.filter(p => p.priority === 'urgent' || p.priority === 'high');

export const getPatientsNeedingReview = (patients: Patient[]) => 
  patients.filter(p => p.status === 'needs-review' || (p.pendingReviews && p.pendingReviews > 0));

export const getActivePatients = (patients: Patient[]) => 
  patients.filter(p => p.status === 'active' || p.status === 'needs-review');

export const getTodaysPatients = (patients: Patient[]) => 
  patients.filter(p => p.lastTranscriptionDate?.includes('hour') || p.lastTranscriptionDate === 'Today' || p.lastVisit?.includes('hour') || p.lastVisit === 'Today');

export const getAllDetectedConditions = (patients: Patient[]) => 
  patients.flatMap(p => p.knownConditions || []);

export const getRecentSessions = (patients: Patient[], limit = 5) => 
  patients.flatMap(p => (p.transcriptionSessions || []).map(s => ({ ...s, patientId: p.id, patientName: p.name, patientAvatar: p.avatar }))).slice(0, limit);
