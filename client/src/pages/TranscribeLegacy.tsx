import React from "react";
import { motion } from "framer-motion";
import "../styles/Transcribe.css";

interface DiseaseHighlight {
  disease: string;
  disease_name?: string;
  icd10_code?: string;
  confidence: number;
  severity: "low" | "medium" | "high";
}

interface Report {
  chief_complaint?: string;
  subjective_summary?: string;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  pdf_url?: string;
  patient_friendly_summary?: string;
}

interface Recommendation {
  recommendation: string;
  category: string;
  priority: string;
  rationale: string;
}

type Props = {
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
};

const Icons = {
  microphone: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>,
  stop: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>,
  play: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>,
  activity: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  fileText: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  clipboard: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>,
  checkCircle: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
  download: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  zap: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  wifi: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>,
  wifiOff: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.58 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>,
  loader: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="spin"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>
};

export const TranscribeLegacy: React.FC<Props> = ({
  session, isRecording = false, isLiveTranscribing = false, isConnected = false, busy = false, isAnalyzing = false,
  recordingTime = 0, liveTranscript = "", liveTranscriptHistory = [], diseases = [], soapNote = null, recommendations = [],
  loading = false, onStartSession, onStartRecording, onStopRecording, onGenerateSOAP, onGenerateRecommendations,
}) => {
  const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
    const seconds = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
  };

  return (
    <div className="transcribe-page">
      <div className="transcribe-header">
        <div className="header-title">
          <span className="header-icon">{Icons.microphone}</span>
          <h1>Medical Transcriber</h1>
        </div>
        
        <div className="header-controls">
          {!session ? (
            <motion.button className="btn-start-session" onClick={onStartSession} disabled={loading} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              {loading ? Icons.loader : Icons.play}<span>Start New Session</span>
            </motion.button>
          ) : (
            <>
              <div className="session-info">
                <span className="session-label">Session</span>
                <span className="session-id">{session.session_id}</span>
              </div>
              {!isRecording ? (
                <motion.button className="btn-record" onClick={onStartRecording} disabled={busy} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  {Icons.microphone}<span>Start Recording</span>
                </motion.button>
              ) : (
                <motion.button className="btn-stop" onClick={onStopRecording} disabled={busy} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  {Icons.stop}<span>Stop & Analyze</span>
                </motion.button>
              )}
              <motion.button className="btn-summarize" onClick={() => { if (onGenerateSOAP && onGenerateRecommendations && (liveTranscriptHistory?.length || 0) > 0) { onGenerateSOAP(); onGenerateRecommendations(); } }} disabled={busy || (liveTranscriptHistory?.length || 0) === 0} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                {Icons.zap}<span>Summarize</span>
              </motion.button>
            </>
          )}
          {isRecording && <div className="recording-indicator"><span className="recording-dot"></span><span className="recording-time">{formatTime(recordingTime)}</span></div>}
          {busy && <div className="processing-indicator">{Icons.loader}<span>{isAnalyzing ? 'Analyzing...' : 'Processing...'}</span></div>}
        </div>
      </div>

      <div className="transcribe-grid">
        <div className="transcribe-column-left">
          <motion.div className="panel transcription-panel" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <div className="panel-header">
              <div className="panel-title">{Icons.microphone}<h2>Live Transcription</h2></div>
              <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>{isConnected ? Icons.wifi : Icons.wifiOff}<span>{isConnected ? 'Connected' : 'Disconnected'}</span></div>
            </div>
            <div className="panel-actions">
              <button className="btn-action btn-start" onClick={onStartRecording} disabled={isLiveTranscribing || isAnalyzing || !session}>{Icons.play}Start Live</button>
              <button className="btn-action btn-stop-small" onClick={onStopRecording} disabled={!isLiveTranscribing}>{Icons.stop}Stop</button>
            </div>
            <div className="transcription-content">
              {isLiveTranscribing && <div className="listening-indicator"><span className="pulse-dot"></span><span>Listening...</span></div>}
              {(liveTranscript || (liveTranscriptHistory?.length || 0) > 0) ? (
                <div className="transcript-list">
                  {liveTranscriptHistory?.map((transcript, index) => {
                    const isSpeaker1 = transcript.startsWith('Speaker 1');
                    const isSpeaker2 = transcript.startsWith('Speaker 2');
                    return (
                      <div key={index} className={`transcript-item ${isSpeaker1 ? 'speaker-1' : isSpeaker2 ? 'speaker-2' : 'speaker-unknown'}`}>
                        <div className="speaker-label">{transcript.split(':')[0]}</div>
                        <div className="speaker-text">{transcript.substring(transcript.indexOf(':') + 1).trim()}</div>
                      </div>
                    );
                  })}
                  {liveTranscript && (
                    <div className="transcript-item current">
                      <div className="speaker-label">{liveTranscript.split(':')[0]} (speaking...)</div>
                      <div className="speaker-text">{liveTranscript.substring(liveTranscript.indexOf(':') + 1).trim()}</div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="empty-state"><div className="empty-icon">{Icons.microphone}</div><p>{isLiveTranscribing ? 'Waiting for speech...' : 'Click "Start Live" to begin transcription'}</p></div>
              )}
            </div>
          </motion.div>
        </div>

        <div className="transcribe-column-right">
          <motion.div className={`panel disease-panel ${(diseases?.length || 0) > 0 ? 'has-results' : ''}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <div className="panel-header">
              <div className="panel-title">{Icons.activity}<h2>Disease Detection</h2></div>
              {(diseases?.length || 0) > 0 && <span className="result-badge">{diseases?.length} detected</span>}
            </div>
            <div className="panel-content">
              {(diseases?.length || 0) === 0 ? (
                <div className="empty-state small"><div className="empty-icon">{Icons.activity}</div><p>No conditions detected</p></div>
              ) : (
                <div className="disease-list">
                  {diseases?.map((disease, idx) => (
                    <div key={idx} className={`disease-item severity-${disease.severity}`}>
                      <div className="disease-info">
                        <span className="disease-name">{disease.disease_name || disease.disease}</span>
                        {disease.icd10_code && disease.icd10_code !== 'UNKNOWN' && <span className="icd-code">ICD-10: {disease.icd10_code}</span>}
                      </div>
                      <div className="disease-meta">
                        <span className="confidence">{Math.round(disease.confidence * 100)}%</span>
                        <span className={`severity-badge ${disease.severity}`}>{disease.severity}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>

          <motion.div className="panel soap-panel" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <div className="panel-header"><div className="panel-title">{Icons.clipboard}<h2>Clinical Summary (SOAP)</h2></div></div>
            <div className="panel-content">
              {soapNote?.subjective || soapNote?.objective || soapNote?.assessment || soapNote?.plan ? (
                <div className="soap-sections">
                  {soapNote?.subjective && <div className="soap-item subjective"><h3>S - Subjective</h3><p>{soapNote.subjective}</p></div>}
                  {soapNote?.objective && <div className="soap-item objective"><h3>O - Objective</h3><p>{soapNote.objective}</p></div>}
                  {soapNote?.assessment && <div className="soap-item assessment"><h3>A - Assessment</h3><p>{soapNote.assessment}</p></div>}
                  {soapNote?.plan && <div className="soap-item plan"><h3>P - Plan</h3><p>{soapNote.plan}</p></div>}
                </div>
              ) : (
                <div className="empty-state small"><div className="empty-icon">{Icons.clipboard}</div><p>SOAP note will appear after analysis</p></div>
              )}
            </div>
          </motion.div>

          <motion.div className="panel recommendations-panel" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <div className="panel-header"><div className="panel-title">{Icons.checkCircle}<h2>Recommendations</h2></div></div>
            <div className="panel-content">
              {(recommendations?.length || 0) > 0 ? (
                <ol className="recommendations-list">
                  {recommendations?.map((rec, idx) => <li key={idx} className="recommendation-item"><span className="rec-number">{idx + 1}</span><span className="rec-text">{rec.recommendation}</span></li>)}
                </ol>
              ) : (
                <div className="empty-state small"><div className="empty-icon">{Icons.checkCircle}</div><p>Recommendations will appear after analysis</p></div>
              )}
            </div>
          </motion.div>

          <motion.div className="panel pdf-panel" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <div className="panel-header"><div className="panel-title">{Icons.fileText}<h2>SOAP Note PDF</h2></div></div>
            <div className="panel-content">
              {soapNote?.pdf_url ? (
                <div className="pdf-ready">
                  <div className="pdf-icon">{Icons.checkCircle}</div>
                  <p>Your SOAP note is ready!</p>
                  <a href={soapNote.pdf_url.replace('gs://', 'https://storage.googleapis.com/')} target="_blank" rel="noopener noreferrer" className="btn-download">{Icons.download}<span>Download PDF</span></a>
                </div>
              ) : (
                <div className="empty-state small"><div className="empty-icon">{Icons.fileText}</div><p>PDF will be available after analysis</p></div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};
