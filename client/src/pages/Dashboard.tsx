import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import "../styles/Dashboard.css";
import { TranscribeLegacy } from "./TranscribeLegacy";
import { PatientDetails } from "../components/PatientDetails";
import { useData } from "../context/DataContext";
import { 
  Patient, 
  mockPatients, 
  generateAppointments, 
  getDashboardStats,
  getPatientsNeedingReview,
  getActivePatients,
  getTodaysPatients
} from "../data/patients";

const DashboardIcons = {
  overview: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  patients: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  transcribe: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>,
  settings: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  totalPatients: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  activeCases: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M9 14l2 2 4-4"/></svg>,
  reviewPending: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  diagnoses: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
  calendar: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  notification: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  notes: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  review: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  checkCircle: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
  search: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  logout: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
};

interface Doctor {
  id: string;
  name: string;
  email: string;
  specialty: string;
  department: string;
  avatar: string;
}

interface DiseaseHighlight {
  disease: string;
  disease_name?: string;
  icd10_code?: string;
  confidence: number;
  severity: 'low' | 'medium' | 'high';
}

interface Report {
  chief_complaint?: string;
  subjective_summary?: string;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  key_symptoms?: string[];
  red_flags?: string[];
  differentials?: Array<{ condition: string; rationale: string }>;
  risk_level?: string;
  recommended_next_steps?: string[];
}

interface Recommendation {
  recommendation: string;
  category: string;
  priority: string;
  rationale: string;
}

interface DashboardProps {
  doctor: Doctor;
  onLogout: () => void;
  session?: any;
  isRecording?: boolean;
  isLiveTranscribing?: boolean;
  isConnected?: boolean;
  isAnalyzing?: boolean;
  busy?: boolean;
  recordingTime?: number;
  liveTranscript?: string;
  liveTranscriptHistory?: string[];
  diseases?: DiseaseHighlight[];
  soapNote?: Report | null;
  recommendations?: Recommendation[];
  loading?: boolean;
  onStartSession?: () => void;
  onStartRecording?: () => void;
  onStopRecording?: () => void;
  onGenerateSOAP?: () => void;
  onGenerateRecommendations?: () => void;
}

type StatCardType = 'total' | 'active' | 'critical' | 'diagnoses' | null;

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" as const } }),
  hover: { y: -8, boxShadow: "0 20px 40px rgba(0, 0, 0, 0.15)", transition: { duration: 0.3 } },
  tap: { scale: 0.98 }
};

const listItemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: (i: number) => ({ opacity: 1, x: 0, transition: { delay: i * 0.05, duration: 0.3, ease: "easeOut" as const } })
};

const slideInPanel = {
  hidden: { x: "100%", opacity: 0 },
  visible: { x: 0, opacity: 1, transition: { type: "spring" as const, damping: 30, stiffness: 300 } },
  exit: { x: "100%", opacity: 0, transition: { duration: 0.2 } }
};

export const Dashboard: React.FC<DashboardProps> = ({ 
  doctor, onLogout, session, isRecording = false, isLiveTranscribing = false, isConnected = false,
  isAnalyzing = false, busy = false, recordingTime = 0, liveTranscript = '', liveTranscriptHistory = [],
  diseases = [], soapNote = null, recommendations = [], loading = false,
  onStartSession, onStartRecording, onStopRecording, onGenerateSOAP, onGenerateRecommendations
}) => {
  const dataContext = useData();
  const [activeTab, setActiveTab] = useState("overview");
  const [patients] = useState<Patient[]>(mockPatients);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [activeStatCard, setActiveStatCard] = useState<StatCardType>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showPatientDetails, setShowPatientDetails] = useState(false);
  const [transcribeSubTab, setTranscribeSubTab] = useState<'transcriber' | 'review'>('transcriber');

  useEffect(() => {
    if (session?.session_id && selectedPatient?.id) {
      dataContext.setTranscriptionSession(session.session_id, selectedPatient.id);
    }
  }, [session, selectedPatient, dataContext]);

  useEffect(() => {
    if (diseases.length > 0) {
      const convertedDiseases = diseases.map(d => ({
        name: d.disease_name || d.disease,
        icd10Code: d.icd10_code || '',
        confidence: d.confidence,
        severity: d.severity,
        detectedDate: new Date().toISOString(),
        source: 'transcription' as const
      }));
      dataContext.setDiseases(convertedDiseases);
    }
  }, [diseases, dataContext]);

  useEffect(() => {
    if (soapNote) {
      dataContext.setSoapNote({
        subjective: soapNote.subjective || soapNote.subjective_summary || '',
        objective: soapNote.objective || '',
        assessment: soapNote.assessment || '',
        plan: soapNote.plan || ''
      });
    }
  }, [soapNote, dataContext]);

  useEffect(() => {
    if (recommendations.length > 0) {
      dataContext.setRecommendations(recommendations);
    }
  }, [recommendations, dataContext]);

  useEffect(() => {
    if (liveTranscript) {
      dataContext.updateTranscript(liveTranscript);
    }
  }, [liveTranscript, dataContext]);

  useEffect(() => {
    if (liveTranscriptHistory.length > 0) {
      const lastLine = liveTranscriptHistory[liveTranscriptHistory.length - 1];
      if (lastLine && !dataContext.transcription.transcriptHistory.includes(lastLine)) {
        dataContext.addToTranscriptHistory(lastLine);
      }
    }
  }, [liveTranscriptHistory, dataContext]);

  const handleReviewSubmit = async () => {
    await dataContext.submitReview(doctor.id, doctor.name);
  };

  const appointments = useMemo(() => generateAppointments(patients), [patients]);
  const stats = useMemo(() => getDashboardStats(patients), [patients]);

  const patientsForDate = useMemo(() => {
    if (!selectedDate || !appointments[selectedDate]) return [];
    return appointments[selectedDate].map(apt => patients.find(p => p.id === apt.patientId)!).filter(Boolean);
  }, [selectedDate, appointments, patients]);

  const statCardPatients = useMemo(() => {
    switch (activeStatCard) {
      case 'total': return patients;
      case 'active': return getActivePatients(patients);
      case 'critical': return getPatientsNeedingReview(patients);
      case 'diagnoses': return getTodaysPatients(patients);
      default: return [];
    }
  }, [activeStatCard, patients]);

  const filteredPatients = useMemo(() => {
    let result = [...patients];
    if (searchQuery) {
      result = result.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.condition.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.id.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    if (statusFilter !== "all") {
      result = result.filter(p => p.status === statusFilter);
    }
    return result;
  }, [patients, searchQuery, statusFilter]);

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { class: string; label: string }> = {
      active: { class: "badge-stable", label: "Active" },
      inactive: { class: "badge-inactive", label: "Inactive" },
      "needs-review": { class: "badge-review", label: "Needs Review" }
    };
    const config = statusConfig[status] || { class: "", label: status };
    return <span className={`badge ${config.class}`}>{config.label}</span>;
  };

  const getPriorityIndicator = (priority: string) => {
    const colors: Record<string, string> = { urgent: "#dc2626", high: "#ea580c", medium: "#d97706", low: "#16a34a" };
    return <span className="priority-dot" style={{ background: colors[priority] || colors.low }} title={`${priority} priority`} />;
  };

  const getDaysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const getFirstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  const formatDateKey = (year: number, month: number, day: number) => `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const handleDateClick = (day: number) => {
    const dateKey = formatDateKey(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    setSelectedDate(dateKey);
    setActiveStatCard(null);
  };

  const handleStatCardClick = (type: StatCardType) => {
    setActiveStatCard(activeStatCard === type ? null : type);
    setSelectedDate(null);
  };

  const handlePatientClick = (patient: Patient) => {
    setSelectedPatient(patient);
    setShowPatientDetails(true);
  };

  const handleClosePatientDetails = () => {
    setShowPatientDetails(false);
    setTimeout(() => setSelectedPatient(null), 300);
  };

  const handleStartTranscription = () => {
    setShowPatientDetails(false);
    setActiveTab("transcribe");
  };

  const getStatCardTitle = (type: StatCardType) => {
    switch (type) {
      case 'total': return 'All Patients';
      case 'active': return 'Active Cases';
      case 'critical': return 'Review Pending';
      case 'diagnoses': return "Today's Diagnoses";
      default: return '';
    }
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentMonth);
    const firstDay = getFirstDayOfMonth(currentMonth);
    const days = [];
    const today = new Date();
    const todayStr = formatDateKey(today.getFullYear(), today.getMonth(), today.getDate());

    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = formatDateKey(currentMonth.getFullYear(), currentMonth.getMonth(), day);
      const dayAppointments = appointments[dateKey] || [];
      const hasAppointments = dayAppointments.length > 0;
      const isToday = dateKey === todayStr;
      const hasNeedsReview = dayAppointments.some(apt => patients.find(p => p.id === apt.patientId)?.status === 'needs-review');

      days.push(
        <motion.div
          key={day}
          className={`calendar-day ${hasAppointments ? "has-appointments" : ""} ${selectedDate === dateKey ? "selected" : ""} ${isToday ? "today" : ""} ${hasNeedsReview ? "has-critical" : ""}`}
          onClick={() => handleDateClick(day)}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          <div className="day-number">{day}</div>
          {hasAppointments && (
            <div className="appointment-indicator">
              <span className="apt-count">{dayAppointments.length}</span>
            </div>
          )}
        </motion.div>
      );
    }

    return days;
  };

  const StatCard: React.FC<{
    title: string;
    value: number | string;
    icon: React.ReactNode;
    change: string;
    changeType: 'positive' | 'negative' | 'neutral';
    type: StatCardType;
    index: number;
  }> = ({ title, value, icon, change, changeType, type, index }) => (
    <motion.div
      className={`stat-card ${activeStatCard === type ? 'active' : ''}`}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileHover="hover"
      whileTap="tap"
      custom={index}
      onClick={() => handleStatCardClick(type)}
      layoutId={`stat-${type}`}
    >
      <div className="stat-card-inner">
        <div className="stat-icon-wrapper">{icon}</div>
        <div className="stat-content">
          <span className="stat-label">{title}</span>
          <motion.span className="stat-value" key={value} initial={{ scale: 1.2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.3 }}>{value}</motion.span>
          <span className={`stat-change ${changeType}`}>{change}</span>
        </div>
      </div>
      {activeStatCard === type && <div className="stat-card-indicator"></div>}
    </motion.div>
  );

  const PatientListItem: React.FC<{ patient: Patient; index: number }> = ({ patient, index }) => (
    <motion.div
      className={`patient-list-item ${patient.status}`}
      variants={listItemVariants}
      initial="hidden"
      animate="visible"
      custom={index}
      whileHover={{ x: 6, backgroundColor: "rgba(15, 76, 117, 0.05)" }}
      onClick={() => handlePatientClick(patient)}
    >
      <div className="patient-list-avatar">
        {patient.avatar}
        {getPriorityIndicator(patient.priority)}
      </div>
      <div className="patient-list-info">
        <span className="patient-list-name">{patient.name}</span>
        <span className="patient-list-condition">{patient.condition}</span>
      </div>
      <div className="patient-list-meta">
        {getStatusBadge(patient.status)}
        <span className="patient-list-time">{patient.lastVisit}</span>
      </div>
    </motion.div>
  );

  return (
    <div className="dashboard">
      <motion.aside className="dashboard-sidebar" initial={{ x: -280 }} animate={{ x: 0 }} transition={{ type: "spring", damping: 30, stiffness: 200 }}>
        <div className="sidebar-header">
          <motion.div className="doctor-avatar-large" whileHover={{ scale: 1.05 }} transition={{ type: "spring", stiffness: 400 }}>{doctor.avatar}</motion.div>
          <h3>{doctor.name}</h3>
          <p className="doctor-specialty">{doctor.specialty}</p>
          <div className="doctor-status"><span className="status-dot online"></span><span>Available</span></div>
        </div>

        <nav className="sidebar-nav">
          {[
            { id: "overview", icon: DashboardIcons.overview, label: "Overview" },
            { id: "patients", icon: DashboardIcons.patients, label: "Patients" },
            { id: "settings", icon: DashboardIcons.settings, label: "Settings" }
          ].map((item, index) => (
            <motion.button
              key={item.id}
              className={`nav-item ${activeTab === item.id ? "active" : ""}`}
              onClick={() => setActiveTab(item.id)}
              whileHover={{ x: 5 }}
              whileTap={{ scale: 0.98 }}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
              {item.id === "patients" && <span className="nav-badge">{patients.length}</span>}
            </motion.button>
          ))}
        </nav>

        <motion.button className="logout-btn" onClick={onLogout} whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
          {DashboardIcons.logout}
          Logout
        </motion.button>
      </motion.aside>

      <main className="dashboard-main">
        {activeTab !== "transcribe" && (
          <motion.header className="dashboard-header" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="header-left">
              <h1>
                {activeTab === "overview" && "Dashboard Overview"}
                {activeTab === "patients" && "Patient Management"}
                {activeTab === "settings" && "Settings"}
              </h1>
              <p className="header-subtitle">Welcome back, Dr. {doctor.name.split(' ')[1]}</p>
            </div>
            <div className="header-right">
              <div className="date-time">
                <span className="current-date">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                <span className="current-time">{new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <motion.button className="notification-btn" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                {DashboardIcons.notification}
                <span className="notification-badge">3</span>
              </motion.button>
            </div>
          </motion.header>
        )}

        {activeTab === "overview" && (
          <div className="tab-content overview-tab">
            <div className="overview-layout">
              <div className="overview-main">
                <div className="stats-grid">
                  <StatCard title="Total Patients" value={stats.totalPatients} icon={<span className="stat-icon-wrapper">{DashboardIcons.totalPatients}</span>} change="↑ 12% this month" changeType="positive" type="total" index={0} />
                  <StatCard title="Active Cases" value={stats.activeCases} icon={<span className="stat-icon-wrapper">{DashboardIcons.activeCases}</span>} change={stats.needsReview > 0 ? `${stats.needsReview} need review` : "All reviewed"} changeType={stats.needsReview > 0 ? "neutral" : "positive"} type="active" index={1} />
                  <StatCard title="Review Pending" value={stats.needsReview} icon={<span className="stat-icon-wrapper">{DashboardIcons.reviewPending}</span>} change={stats.needsReview > 0 ? "Awaiting review" : "All reviewed"} changeType={stats.needsReview > 0 ? "neutral" : "positive"} type="critical" index={2} />
                  <StatCard title="Diagnoses Today" value={stats.todaysDiagnoses} icon={<span className="stat-icon-wrapper">{DashboardIcons.diagnoses}</span>} change="↑ 5% above avg" changeType="positive" type="diagnoses" index={3} />
                </div>

                <motion.div className="calendar-section" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                  <div className="section-header">
                    <h2><span className="section-icon">{DashboardIcons.calendar}</span> Appointment Calendar</h2>
                    <p className="section-subtitle">Click on a date to view scheduled patients</p>
                  </div>
                  <div className="calendar-card">
                    <div className="calendar-header">
                      <motion.button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>◀</motion.button>
                      <h3>{currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h3>
                      <motion.button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>▶</motion.button>
                    </div>
                    <div className="calendar-weekdays">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <div key={day}>{day}</div>)}</div>
                    <div className="calendar-grid">{renderCalendar()}</div>
                    <div className="calendar-legend">
                      <span className="legend-item"><span className="dot today-dot"></span> Today</span>
                      <span className="legend-item"><span className="dot apt-dot"></span> Has appointments</span>
                      <span className="legend-item"><span className="dot critical-dot"></span> Has critical</span>
                    </div>
                  </div>
                </motion.div>
              </div>

              <AnimatePresence mode="wait">
                {(activeStatCard || selectedDate) && (
                  <motion.div className="side-panel" variants={slideInPanel} initial="hidden" animate="visible" exit="exit">
                    <div className="side-panel-header">
                      <h3>{activeStatCard ? getStatCardTitle(activeStatCard) : selectedDate ? new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) : ''}</h3>
                      <motion.button className="close-panel-btn" onClick={() => { setActiveStatCard(null); setSelectedDate(null); }} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>✕</motion.button>
                    </div>
                    <div className="side-panel-content">
                      {(activeStatCard ? statCardPatients : patientsForDate).length > 0 ? (
                        (activeStatCard ? statCardPatients : patientsForDate).map((patient, index) => <PatientListItem key={patient.id} patient={patient} index={index} />)
                      ) : (
                        <div className="empty-state"><span className="empty-icon">📭</span><p>No patients found</p></div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}

        {activeTab === "patients" && (
          <motion.div className="tab-content patients-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="patients-toolbar">
              <div className="search-box">
                <span className="search-icon">{DashboardIcons.search}</span>
                <input type="text" placeholder="Search patients by name, condition, or ID..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                {searchQuery && <motion.button className="clear-search" onClick={() => setSearchQuery("")} whileHover={{ scale: 1.1 }}>✕</motion.button>}
              </div>
              <div className="filter-buttons">
                {['all', 'needs-review', 'active', 'inactive'].map(status => (
                  <motion.button key={status} className={`filter-btn ${statusFilter === status ? 'active' : ''}`} onClick={() => setStatusFilter(status)} whileHover={{ y: -2 }} whileTap={{ scale: 0.95 }}>
                    {status === 'all' ? 'All' : status === 'needs-review' ? 'Needs Review' : status.charAt(0).toUpperCase() + status.slice(1)}
                  </motion.button>
                ))}
              </div>
              <motion.button className="add-patient-btn" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}><span>+</span> Add Patient</motion.button>
            </div>

            <div className="patients-count">Showing <strong>{filteredPatients.length}</strong> of <strong>{patients.length}</strong> patients</div>

            <div className="patients-list">
              <div className="patients-list-header">
                <div className="list-col col-patient">Patient</div>
                <div className="list-col col-condition">Condition</div>
                <div className="list-col col-status">Status</div>
                <div className="list-col col-vitals">Vitals</div>
                <div className="list-col col-sessions">Sessions</div>
                <div className="list-col col-last">Last Visit</div>
                <div className="list-col col-actions">Actions</div>
              </div>

              <div className="patients-list-body">
                <AnimatePresence>
                  {filteredPatients.map((patient, index) => (
                    <motion.div
                      key={patient.id}
                      className={`patient-row ${patient.status}`}
                      onClick={() => handlePatientClick(patient)}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ delay: index * 0.03 }}
                      whileHover={{ backgroundColor: "#f8fafc" }}
                      layout
                    >
                      <div className="list-col col-patient">
                        <div className="patient-info">
                          <div className="patient-avatar-sm">{patient.avatar}{getPriorityIndicator(patient.priority)}</div>
                          <div className="patient-details">
                            <span className="patient-name">{patient.name}</span>
                            <span className="patient-meta-sm">{patient.age}y • {patient.gender} • ID: {patient.id}</span>
                          </div>
                        </div>
                      </div>
                      <div className="list-col col-condition">
                        <span className="condition-text">{patient.condition}</span>
                        {patient.allergies && patient.allergies.length > 0 && <span className="allergy-badge" title={patient.allergies.join(', ')}>⚠ Allergies</span>}
                      </div>
                      <div className="list-col col-status">{getStatusBadge(patient.status)}</div>
                      <div className="list-col col-vitals">
                        <div className="vitals-compact">
                          <span>BP: {patient.vitals.bloodPressure}</span>
                          <span>HR: {patient.vitals.heartRate}</span>
                          <span>O₂: {patient.vitals.oxygenSaturation}%</span>
                        </div>
                      </div>
                      <div className="list-col col-sessions">
                        <div className="sessions-info">
                          <span className="session-count">{patient.transcriptionSessions?.length || 0}</span>
                          {patient.pendingReviews && patient.pendingReviews > 0 && <span className="pending-badge">{patient.pendingReviews} pending</span>}
                        </div>
                      </div>
                      <div className="list-col col-last"><span className="last-visit-date">{patient.lastVisit}</span></div>
                      <div className="list-col col-actions">
                        <motion.button className="action-btn view-btn" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={(e) => { e.stopPropagation(); handlePatientClick(patient); }}>View</motion.button>
                        <motion.button className="action-btn transcribe-btn" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={(e) => { e.stopPropagation(); setSelectedPatient(patient); setActiveTab('transcribe'); setTranscribeSubTab('transcriber'); }}>Transcribe</motion.button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>

            {filteredPatients.length === 0 && (
              <motion.div className="no-results" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <span className="no-results-icon">{DashboardIcons.search}</span>
                <h3>No patients found</h3>
                <p>Try adjusting your search or filter criteria</p>
                <motion.button className="clear-filters-btn" onClick={() => { setSearchQuery(""); setStatusFilter("all"); }} whileHover={{ scale: 1.02 }}>Clear all filters</motion.button>
              </motion.div>
            )}
          </motion.div>
        )}

        {activeTab === "transcribe" && (
          <div className="tab-content transcribe-tab">
            <div className="transcribe-sub-tabs">
              <motion.button className={`sub-tab-btn ${transcribeSubTab === 'transcriber' ? 'active' : ''}`} onClick={() => setTranscribeSubTab('transcriber')} whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
                <span>{DashboardIcons.transcribe}</span>Medical Transcriber
              </motion.button>
              <motion.button className={`sub-tab-btn ${transcribeSubTab === 'review' ? 'active' : ''}`} onClick={() => setTranscribeSubTab('review')} whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
                <span>{DashboardIcons.review}</span>Doctor's Review{(soapNote || dataContext.transcription.soapNote) && !dataContext.review.submitted && <span className="review-badge">1</span>}
              </motion.button>
            </div>

            <AnimatePresence mode="wait">
              {transcribeSubTab === 'transcriber' && (
                <motion.div key="transcriber" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }}>
                  <TranscribeLegacy session={session} isRecording={isRecording} isLiveTranscribing={isLiveTranscribing} isConnected={isConnected} isAnalyzing={isAnalyzing} busy={busy} recordingTime={recordingTime} liveTranscript={liveTranscript} liveTranscriptHistory={liveTranscriptHistory} diseases={diseases} soapNote={soapNote} recommendations={recommendations} loading={loading} onStartSession={onStartSession} onStartRecording={onStartRecording} onStopRecording={onStopRecording} onGenerateSOAP={onGenerateSOAP} onGenerateRecommendations={onGenerateRecommendations} />
                </motion.div>
              )}

              {transcribeSubTab === 'review' && (
                <motion.div key="review" className="review-section" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                  <div className="review-container">
                    <div className="review-summary-panel">
                      <div className="review-panel-header">
                        <h2>{DashboardIcons.notes} AI-Generated Summary</h2>
                        <span className="ai-badge">Auto-generated</span>
                      </div>
                      
                      {soapNote ? (
                        <div className="soap-preview">
                          {soapNote.subjective && <div className="soap-section subjective"><h3>S - Subjective</h3><p>{soapNote.subjective}</p></div>}
                          {soapNote.objective && <div className="soap-section objective"><h3>O - Objective</h3><p>{soapNote.objective}</p></div>}
                          {soapNote.assessment && <div className="soap-section assessment"><h3>A - Assessment</h3><p>{soapNote.assessment}</p></div>}
                          {soapNote.plan && <div className="soap-section plan"><h3>P - Plan</h3><p>{soapNote.plan}</p></div>}
                        </div>
                      ) : (
                        <div className="no-summary">
                          <span className="no-summary-icon">{DashboardIcons.notes}</span>
                          <p>No summary available yet.</p>
                          <p className="hint">Complete a transcription session first to generate an AI summary.</p>
                        </div>
                      )}
                    </div>

                    <div className="review-form-panel">
                      <div className="review-panel-header">
                        <h2><span className="review-header-icon">{DashboardIcons.review}</span> Doctor's Review</h2>
                        {dataContext.review.submitted && <span className="submitted-badge">{DashboardIcons.checkCircle} Submitted</span>}
                        <span className="data-mode-badge">{dataContext.dataMode === 'cassandra' ? 'Cassandra' : 'Local'}</span>
                      </div>

                      {dataContext.review.submitted ? (
                        <motion.div className="review-submitted" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                          <span className="success-icon">{DashboardIcons.checkCircle}</span>
                          <h3>Review Submitted Successfully!</h3>
                          <p>Your review has been saved{dataContext.dataMode === 'cassandra' ? ' to Cassandra database' : ' locally'}.</p>
                          <motion.button className="new-review-btn" onClick={() => { dataContext.resetReview(); dataContext.resetSession(); }} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>Start New Review</motion.button>
                        </motion.div>
                      ) : (
                        <form className="review-form" onSubmit={(e) => { e.preventDefault(); handleReviewSubmit(); }}>
                          <div className="form-group">
                            <label><span className="label-icon">{DashboardIcons.notes}</span> Clinical Notes & Observations</label>
                            <textarea value={dataContext.review.clinicalNotes} onChange={(e) => dataContext.updateReviewNotes(e.target.value)} placeholder="Add your clinical observations, corrections to the AI summary, or additional notes..." rows={4} />
                          </div>
                          <div className="form-group">
                            <label><span className="label-icon">{DashboardIcons.diagnoses}</span> Final Diagnosis</label>
                            <textarea value={dataContext.review.diagnosis} onChange={(e) => dataContext.updateReviewDiagnosis(e.target.value)} placeholder="Enter your confirmed diagnosis or modify the AI-suggested assessment..." rows={3} />
                          </div>
                          <div className="form-group">
                            <label><span className="label-icon">{DashboardIcons.review}</span> Treatment Plan & Follow-up</label>
                            <textarea value={dataContext.review.treatmentPlan} onChange={(e) => dataContext.updateReviewPlan(e.target.value)} placeholder="Specify the treatment plan, medications, and follow-up schedule..." rows={4} />
                          </div>
                          <div className="form-actions">
                            <motion.button type="button" className="btn-secondary" onClick={() => dataContext.resetReview()} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>Clear Form</motion.button>
                            <motion.button type="submit" className="btn-primary" disabled={dataContext.isLoading || (!dataContext.review.clinicalNotes && !dataContext.review.diagnosis && !dataContext.review.treatmentPlan)} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}><span>✓</span>{dataContext.isLoading ? 'Saving...' : 'Submit Review'}</motion.button>
                          </div>
                        </form>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {activeTab === "settings" && (
          <motion.div className="tab-content settings-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="settings-section">
              <motion.div className="settings-group" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <h3>{DashboardIcons.patients} Account Settings</h3>
                <div className="setting-item"><label>Email</label><input type="email" value={doctor.email} disabled /></div>
                <div className="setting-item"><label>Specialty</label><input type="text" value={doctor.specialty} disabled /></div>
                <div className="setting-item"><label>Department</label><input type="text" value={doctor.department} disabled /></div>
              </motion.div>

              <motion.div className="settings-group" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <h3>{DashboardIcons.notification} Notification Preferences</h3>
                <div className="toggle-item"><label>Email Notifications</label><input type="checkbox" defaultChecked /></div>
                <div className="toggle-item"><label>SMS Alerts for Critical Cases</label><input type="checkbox" defaultChecked /></div>
                <div className="toggle-item"><label>Daily Report Summary</label><input type="checkbox" /></div>
              </motion.div>

              <motion.div className="settings-group" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <h3>{DashboardIcons.settings} Privacy & Security</h3>
                <div className="settings-buttons">
                  <motion.button className="btn btn-secondary" whileHover={{ y: -2 }}>Change Password</motion.button>
                  <motion.button className="btn btn-secondary" whileHover={{ y: -2 }}>Two-Factor Authentication</motion.button>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </main>

      <AnimatePresence>
        {showPatientDetails && selectedPatient && (
          <PatientDetails
            patient={selectedPatient}
            onClose={handleClosePatientDetails}
            onStartTranscription={handleStartTranscription}
            onGoToReview={() => { setShowPatientDetails(false); setActiveTab('transcribe'); setTranscribeSubTab('review'); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
