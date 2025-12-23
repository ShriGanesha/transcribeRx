import React, { useState } from "react";
import "../styles/LoginPage.css";

interface LoginPageProps {
  onLogin: (doctor: any) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const DUMMY_DOCTORS = [
    {
      id: "doc001",
      name: "Dr. Sarah Johnson",
      email: "sarah.johnson@hospital.com",
      password: "password123",
      specialty: "Internal Medicine",
      department: "General Medicine",
      avatar: "SJ"
    },
    {
      id: "doc002",
      name: "Dr. Michael Chen",
      email: "michael.chen@hospital.com",
      password: "password123",
      specialty: "Cardiology",
      department: "Cardiology",
      avatar: "MC"
    },
    {
      id: "doc003",
      name: "Dr. Emily Rodriguez",
      email: "emily.rodriguez@hospital.com",
      password: "password123",
      specialty: "Respiratory Medicine",
      department: "Pulmonology",
      avatar: "ER"
    }
  ];

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    setTimeout(() => {
      const doctor = DUMMY_DOCTORS.find(
        d => d.email === email && d.password === password
      );

      if (doctor) {
        onLogin(doctor);
      } else {
        setError("Invalid email or password. Try demo credentials:");
      }
      setIsLoading(false);
    }, 1000);
  };

  const quickLogin = (doctor: any) => {
    setEmail(doctor.email);
    setPassword(doctor.password);
    setTimeout(() => {
      onLogin(doctor);
    }, 500);
  };

  return (
    <div className="login-container">
      <div className="login-bg">
        <div className="floating-shapes">
          <div className="shape shape-1"></div>
          <div className="shape shape-2"></div>
          <div className="shape shape-3"></div>
        </div>
      </div>

      <div className="login-content">
        <div className="login-card">
          <div className="login-header">
            <div className="logo">
              <svg viewBox="0 0 100 100" className="logo-icon">
                <circle cx="50" cy="30" r="15" fill="currentColor"/>
                <path d="M 25 50 Q 25 65 35 75 L 65 75 Q 75 65 75 50" fill="none" stroke="currentColor" strokeWidth="3"/>
                <line x1="40" y1="55" x2="40" y2="70" stroke="currentColor" strokeWidth="2"/>
                <line x1="60" y1="55" x2="60" y2="70" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </div>
            <h1>transcribeRx</h1>
            <p>AI-Powered Medical Transcription & Diagnosis Assistant</p>
          </div>

          <form onSubmit={handleLogin} className="login-form">
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                id="email"
                type="email"
                placeholder="doctor@hospital.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>

            {error && <div className="error-message">{error}</div>}

            <button 
              type="submit" 
              className="login-button"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="spinner"></span>
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          <div className="divider">or try a demo account</div>

          <div className="demo-accounts">
            {DUMMY_DOCTORS.map((doctor) => (
              <button
                key={doctor.id}
                className="demo-account-btn"
                onClick={() => quickLogin(doctor)}
                disabled={isLoading}
              >
                <div className="avatar">{doctor.avatar}</div>
                <div className="doctor-info">
                  <div className="doctor-name">{doctor.name}</div>
                  <div className="doctor-specialty">{doctor.specialty}</div>
                </div>
              </button>
            ))}
          </div>

          <div className="login-footer">
            <p>Demo credentials: password123</p>
          </div>
        </div>
      </div>
    </div>
  );
};
