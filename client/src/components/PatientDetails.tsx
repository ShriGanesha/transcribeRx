import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Patient } from '../data/patients';
import '../styles/PatientDetails.css';

interface PatientDetailsProps {
  patient: Patient;
  onClose: () => void;
  onStartTranscription: () => void;
  onGoToReview?: () => void;
}

const Icons = {
  close: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  warning: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  activity: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  pill: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.5 20.5L3.5 13.5C2.12 12.12 2.12 9.88 3.5 8.5 4.88 7.12 7.12 7.12 8.5 8.5L15.5 15.5C16.88 16.88 16.88 19.12 15.5 20.5 14.12 21.88 11.88 21.88 10.5 20.5z"/><line x1="12" y1="9" x2="15" y2="6"/><path d="M15.5 3.5L20.5 8.5C21.88 9.88 21.88 12.12 20.5 13.5"/></svg>,
  fileText: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  mic: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>,
  clock: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  checkCircle: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
  alertCircle: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  user: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  phone: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
  mail: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
  droplet: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>,
  review: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
};

export const PatientDetails: React.FC<PatientDetailsProps> = ({ patient, onClose, onStartTranscription, onGoToReview }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'needs-review': return '#f59e0b';
      case 'active': return '#3b82f6';
      case 'inactive': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const getPriorityBadge = (priority: string) => {
    const colors: Record<string, { bg: string; text: string }> = {
      urgent: { bg: '#fef2f2', text: '#dc2626' },
      high: { bg: '#fff7ed', text: '#ea580c' },
      medium: { bg: '#fffbeb', text: '#d97706' },
      low: { bg: '#f0fdf4', text: '#16a34a' }
    };
    const color = colors[priority] || colors.low;
    return <span className="priority-badge" style={{ background: color.bg, color: color.text }}>{priority.toUpperCase()}</span>;
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return '#dc2626';
      case 'medium': return '#f59e0b';
      case 'low': return '#22c55e';
      default: return '#6b7280';
    }
  };

  return (
    <AnimatePresence>
      <motion.div className="patient-details-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
        <motion.div className="patient-details-panel" initial={{ x: '100%', opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: '100%', opacity: 0 }} transition={{ type: 'spring', damping: 30, stiffness: 300 }} onClick={(e) => e.stopPropagation()}>
          <div className="pd-header">
            <motion.button className="pd-close-btn" onClick={onClose} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>{Icons.close}</motion.button>
            <div className="pd-patient-main">
              <motion.div className="pd-avatar" style={{ borderColor: getStatusColor(patient.status) }} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: 'spring' }}>{patient.avatar}</motion.div>
              <div className="pd-patient-info">
                <h1>{patient.name}</h1>
                <div className="pd-meta">
                  <span>{patient.age} years • {patient.gender}</span>
                  <span className="pd-id">ID: {patient.id.toUpperCase()}</span>
                </div>
                <div className="pd-badges">
                  <span className="status-badge" style={{ background: getStatusColor(patient.status), color: 'white' }}>{patient.status.replace('-', ' ').toUpperCase()}</span>
                  {getPriorityBadge(patient.priority)}
                </div>
              </div>
            </div>
          </div>

          <div className="pd-body">
            <motion.section className={`pd-section allergies-section ${patient.allergies.length > 0 ? 'has-allergies' : ''}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <h2><span className="section-icon warning">{Icons.warning}</span>Allergies</h2>
              {patient.allergies.length > 0 ? (
                <div className="allergies-list">
                  {patient.allergies.map((allergy, idx) => (
                    <motion.div key={idx} className="allergy-tag" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 + idx * 0.05 }}>{Icons.warning}<span>{allergy}</span></motion.div>
                  ))}
                </div>
              ) : <p className="no-data">No known allergies</p>}
            </motion.section>

            <motion.section className="pd-section conditions-section" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <h2><span className="section-icon">{Icons.activity}</span>Detected Conditions</h2>
              {patient.knownConditions && patient.knownConditions.length > 0 ? (
                <div className="conditions-list">
                  {patient.knownConditions.map((condition, idx) => (
                    <motion.div key={idx} className="condition-card" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + idx * 0.05 }}>
                      <div className="condition-header">
                        <span className="condition-name">{condition.name}</span>
                        <span className="severity-badge" style={{ background: getSeverityColor(condition.severity) + '20', color: getSeverityColor(condition.severity) }}>{condition.severity.toUpperCase()}</span>
                      </div>
                      <div className="condition-details">
                        <span className="icd-code">ICD-10: {condition.icd10Code}</span>
                        <span className="confidence">Confidence: {Math.round(condition.confidence * 100)}%</span>
                      </div>
                      <div className="condition-meta">
                        <span className="detected-date">{Icons.clock} Detected: {condition.detectedDate}</span>
                        <span className="source-badge">{condition.source}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : <p className="no-data">No conditions detected yet</p>}
            </motion.section>

            <motion.section className="pd-section notes-section" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <h2><span className="section-icon">{Icons.fileText}</span>Clinical Notes History</h2>
              {patient.clinicalNotes && patient.clinicalNotes.length > 0 ? (
                <div className="notes-list">
                  {patient.clinicalNotes.map((note, idx) => (
                    <motion.div key={idx} className="note-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + idx * 0.05 }}>
                      <div className="note-header">
                        <span className="note-date">{Icons.clock} {note.date}</span>
                        <span className="note-author">{Icons.user} {note.author}</span>
                      </div>
                      <p className="note-content">{note.note}</p>
                    </motion.div>
                  ))}
                </div>
              ) : <p className="no-data">No clinical notes available</p>}
            </motion.section>

            <motion.section className="pd-section sessions-section" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
              <h2><span className="section-icon">{Icons.mic}</span>Transcription Sessions</h2>
              {patient.transcriptionSessions && patient.transcriptionSessions.length > 0 ? (
                <div className="sessions-list">
                  {patient.transcriptionSessions.map((session, idx) => (
                    <motion.div key={session.id} className={`session-card ${session.status}`} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 + idx * 0.05 }}>
                      <div className="session-header">
                        <span className="session-date">{session.date}</span>
                        <span className={`session-status ${session.status}`}>{session.status === 'pending-review' ? Icons.alertCircle : Icons.checkCircle}{session.status.replace('-', ' ')}</span>
                      </div>
                      <div className="session-details">
                        <span className="session-duration">Duration: {session.duration}</span>
                        <span className="session-conditions">{session.detectedConditions.length} condition(s) detected</span>
                      </div>
                      {session.status === 'pending-review' && onGoToReview && (
                        <motion.button className="session-review-btn" onClick={onGoToReview} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>{Icons.review}Review Now</motion.button>
                      )}
                      {session.status === 'reviewed' && session.reviewedBy && (
                        <div className="session-review-info">Reviewed by {session.reviewedBy} on {session.reviewDate}</div>
                      )}
                    </motion.div>
                  ))}
                </div>
              ) : <p className="no-data">No transcription sessions yet</p>}
            </motion.section>

            <motion.section className="pd-section medications-section" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <h2><span className="section-icon">{Icons.pill}</span>Current Medications</h2>
              {patient.medications.length > 0 ? (
                <div className="medications-list">
                  {patient.medications.map((med, idx) => (
                    <motion.div key={idx} className="medication-item" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + idx * 0.03 }}>{Icons.pill}<span>{med}</span></motion.div>
                  ))}
                </div>
              ) : <p className="no-data">No medications recorded</p>}
            </motion.section>

            <motion.section className="pd-section contact-section" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
              <h2><span className="section-icon">{Icons.user}</span>Patient Info</h2>
              <div className="contact-grid">
                <div className="contact-item">{Icons.phone}<span>{patient.phone}</span></div>
                <div className="contact-item">{Icons.mail}<span>{patient.email}</span></div>
                <div className="contact-item">{Icons.droplet}<span>Blood Type: {patient.bloodType}</span></div>
              </div>
            </motion.section>
          </div>

          <div className="pd-footer">
            <motion.button className="pd-action-btn secondary" onClick={onClose} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>Close</motion.button>
            <motion.button className="pd-action-btn primary" onClick={onStartTranscription} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>{Icons.mic}Start Transcription</motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
