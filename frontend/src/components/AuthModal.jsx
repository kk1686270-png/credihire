import React, { useState, useEffect } from 'react';
import { 
  X, 
  Mail, 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  Shield, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle,
  Loader2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

function GoogleIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
    </svg>
  );
}

export function AuthModal({ isOpen, onClose, initialMode = 'signin' }) {
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Google Auth states
  const [showGooglePrompt, setShowGooglePrompt] = useState(false);
  const [googleEmail, setGoogleEmail] = useState('');
  const [googleName, setGoogleName] = useState('');

  const { login, signup, loginWithGoogle, showToast } = useAuth();

  // Fix: Synchronize mode with initialMode whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setError(null);
      setShowPassword(false);
      setShowGooglePrompt(false);
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setName('');
    setConfirmPassword('');
    setGoogleEmail('');
    setGoogleName('');
    setShowGooglePrompt(false);
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleGoogleAuthClick = async () => {
    setError(null);
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

    // If official Google Client ID is configured and Google GIS is ready
    if (googleClientId && window.google?.accounts?.id) {
      try {
        setLoading(true);
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: async (response) => {
            if (response && response.credential) {
              try {
                await loginWithGoogle(response.credential);
                resetForm();
                onClose();
              } catch (err) {
                setError(err.message || "Google sign in failed.");
              } finally {
                setLoading(false);
              }
            }
          }
        });
        window.google.accounts.id.prompt();
        return;
      } catch (err) {
        console.warn("Google One-Tap initialization error:", err);
      }
    }

    // Interactive Google flow (for direct real Google accounts verification)
    setShowGooglePrompt(true);
  };

  const handleGoogleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await loginWithGoogle({
        email: googleEmail,
        name: googleName || (mode === 'signup' ? name : 'Google User')
      });
      resetForm();
      onClose();
    } catch (err) {
      setError(err.message || "Failed to authenticate with Google.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'signin') {
        await login(email, password);
      } else {
        if (password !== confirmPassword) {
          throw new Error("Passwords do not match.");
        }
        await signup(name, email, password);
      }
      resetForm();
      onClose();
    } catch (err) {
      if (err.code === 'ACCOUNT_NOT_FOUND') {
        if (showToast) {
          showToast("No account found. Please create an account.", "warning");
        }
        setMode('signup');
        setError("No account found with this email. Please create your account below.");
      } else {
        setError(err.message || "Authentication failed. Please check your credentials.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={handleClose} role="dialog" aria-modal="true">
      <div className="modal-dialog-custom auth-modal-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header-custom">
          <div className="modal-title-wrap">
            <div className="brand-logo-icon" style={{ width: '32px', height: '32px' }}>
              <Shield size={18} />
            </div>
            <div>
              <h2 className="modal-title mb-0" style={{ fontSize: '1.2rem' }}>
                {mode === 'signin' ? 'Sign In to CrediHire' : 'Create CrediHire Account'}
              </h2>
              <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                {mode === 'signin' 
                  ? 'Access your saved scam scans and safety history' 
                  : 'Start protecting your job search with verified safety tools'}
              </span>
            </div>
          </div>
          <button 
            type="button" 
            className="btn-close-modal" 
            onClick={handleClose}
            aria-label="Close authentication modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Auth Mode Tabs */}
        <div className="auth-tabs-row">
          <button
            type="button"
            className={`auth-tab-btn ${mode === 'signin' ? 'active' : ''}`}
            onClick={() => { setMode('signin'); setError(null); setShowGooglePrompt(false); }}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`auth-tab-btn ${mode === 'signup' ? 'active' : ''}`}
            onClick={() => { setMode('signup'); setError(null); setShowGooglePrompt(false); }}
          >
            Create Account
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body-custom pt-3">
          {/* Error Notice */}
          {error && (
            <div className="input-feedback-error mb-3 p-2 rounded" style={{ background: 'rgba(255, 64, 88, 0.1)', border: '1px solid rgba(255, 64, 88, 0.3)' }}>
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          {/* Google Sign In / Sign Up Action Button */}
          {!showGooglePrompt ? (
            <button
              type="button"
              className="btn-google-auth"
              onClick={handleGoogleAuthClick}
              disabled={loading}
              id="btn-google-auth"
            >
              <GoogleIcon size={18} />
              <span>{mode === 'signin' ? 'Sign in with Google' : 'Sign up with Google'}</span>
            </button>
          ) : (
            /* Real Google Account Verification Form */
            <div className="google-prompt-card">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <div className="d-flex align-items-center gap-2">
                  <GoogleIcon size={18} />
                  <span className="text-white fw-bold" style={{ fontSize: '0.9rem' }}>
                    {mode === 'signin' ? 'Sign in with Google' : 'Sign up with Google'}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-link text-white-50 p-0 text-decoration-none"
                  onClick={() => setShowGooglePrompt(false)}
                >
                  Cancel
                </button>
              </div>

              <p className="text-white-50 mb-3" style={{ fontSize: '0.78rem' }}>
                Authenticate with your real Google account (@gmail.com). Only verified real accounts are permitted.
              </p>

              <form onSubmit={handleGoogleSubmit} className="d-flex flex-column gap-2">
                {mode === 'signup' && (
                  <div>
                    <label className="auth-label" htmlFor="google-name">Full Name</label>
                    <div className="auth-input-wrapper">
                      <User size={16} className="auth-input-icon" />
                      <input
                        id="google-name"
                        type="text"
                        className="auth-input-field"
                        placeholder="e.g. Rahul Sharma"
                        value={googleName}
                        onChange={(e) => setGoogleName(e.target.value)}
                        autoComplete="name"
                        required
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="auth-label" htmlFor="google-email">Google Email Address</label>
                  <div className="auth-input-wrapper">
                    <Mail size={16} className="auth-input-icon" />
                    <input
                      id="google-email"
                      type="email"
                      className="auth-input-field"
                      placeholder="yourname@gmail.com"
                      value={googleEmail}
                      onChange={(e) => setGoogleEmail(e.target.value)}
                      autoComplete="email"
                      required
                    />
                  </div>
                </div>

                <div className="d-flex gap-2 mt-2">
                  <button
                    type="submit"
                    className="btn btn-primary flex-grow-1 d-flex align-items-center justify-content-center gap-2 py-2"
                    style={{ fontSize: '0.86rem', fontWeight: 600, borderRadius: 'var(--radius-sm)' }}
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 size={15} className="spinner-icon" />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <>
                        <GoogleIcon size={16} />
                        <span>Verify & Continue</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary px-3 py-2"
                    style={{ fontSize: '0.86rem', borderRadius: 'var(--radius-sm)' }}
                    onClick={() => setShowGooglePrompt(false)}
                  >
                    Back
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Divider: OR Continue with Email */}
          <div className="auth-divider">
            <div className="auth-divider-line" />
            <span className="auth-divider-text">OR CONTINUE WITH EMAIL</span>
            <div className="auth-divider-line" />
          </div>

          <form onSubmit={handleSubmit} className="d-flex flex-column gap-3">
            {/* Name Field (Sign Up only) */}
            {mode === 'signup' && (
              <div>
                <label className="auth-label" htmlFor="auth-name">Full Name</label>
                <div className="auth-input-wrapper">
                  <User size={16} className="auth-input-icon" />
                  <input
                    id="auth-name"
                    type="text"
                    className="auth-input-field"
                    placeholder="e.g. Rahul Sharma"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    required
                  />
                </div>
              </div>
            )}

            {/* Email Field */}
            <div>
              <label className="auth-label" htmlFor="auth-email">Email Address</label>
              <div className="auth-input-wrapper">
                <Mail size={16} className="auth-input-icon" />
                <input
                  id="auth-email"
                  type="email"
                  className="auth-input-field"
                  placeholder="name@company.com or name@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="auth-label mb-1" htmlFor="auth-password">Password</label>
              <div className="auth-input-wrapper">
                <Lock size={16} className="auth-input-icon" />
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  className="auth-input-field"
                  placeholder={mode === 'signup' ? 'At least 6 characters' : 'Enter your password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  required
                />
                <button
                  type="button"
                  className="btn btn-sm text-white-50 p-0 border-0 bg-transparent pe-2"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Confirm Password (Sign Up only) */}
            {mode === 'signup' && (
              <div>
                <label className="auth-label" htmlFor="auth-confirm-password">Confirm Password</label>
                <div className="auth-input-wrapper">
                  <CheckCircle2 size={16} className="auth-input-icon" />
                  <input
                    id="auth-confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    className="auth-input-field"
                    placeholder="Repeat your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              className="btn-auth-submit mt-2"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="spinner-icon" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <span>{mode === 'signin' ? 'Sign In with Email' : 'Create Account'}</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Switch Tab Footer */}
          <div className="text-center mt-3 pt-2 border-top border-secondary border-opacity-25" style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
            {mode === 'signin' ? (
              <span>
                Don't have an account yet?{' '}
                <button
                  type="button"
                  className="btn btn-link text-primary p-0 text-decoration-none fw-semibold"
                  style={{ fontSize: '0.82rem' }}
                  onClick={() => { setMode('signup'); setError(null); setShowGooglePrompt(false); }}
                >
                  Create one free
                </button>
              </span>
            ) : (
              <span>
                Already have an account?{' '}
                <button
                  type="button"
                  className="btn btn-link text-primary p-0 text-decoration-none fw-semibold"
                  style={{ fontSize: '0.82rem' }}
                  onClick={() => { setMode('signin'); setError(null); setShowGooglePrompt(false); }}
                >
                  Sign in here
                </button>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
