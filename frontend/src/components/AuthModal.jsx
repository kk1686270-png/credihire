import React, { useState, useEffect, useRef } from 'react';
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
  Loader2,
  Key
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { loadGoogleIdentityServices } from '../utils/googleIdentity.js';

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
  const [pendingVerification, setPendingVerification] = useState(null);
  
  // Real Google OAuth Setup state
  const [showGoogleSetup, setShowGoogleSetup] = useState(false);
  const [customClientId, setCustomClientId] = useState('');

  const googleButtonRef = useRef(null);
  const googleHandlerRef = useRef(null);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const { login, signup, loginWithGoogle, showToast } = useAuth();

  googleHandlerRef.current = async (credential) => {
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      await loginWithGoogle(credential);
      resetForm();
      onClose();
    } catch (err) {
      setError(err.message || 'Google authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getEffectiveGoogleClientId = () => {
    return (
      import.meta.env.VITE_GOOGLE_CLIENT_ID ||
      (typeof localStorage !== 'undefined' ? localStorage.getItem('credihire_google_client_id') : '') ||
      ''
    ).trim();
  };

  // Synchronize mode with initialMode whenever modal opens
  useEffect(() => {
    if (isOpen) {
      modeRef.current = initialMode;
      setMode(initialMode);
      setError(null);
      setPendingVerification(null);
      setShowPassword(false);
      setShowGoogleSetup(false);
    }
  }, [isOpen, initialMode]);

  // Load Google Identity Services if a Client ID is configured
  useEffect(() => {
    if (!isOpen || pendingVerification) return undefined;
    let active = true;
    const clientId = getEffectiveGoogleClientId();
    if (!clientId) {
      return undefined;
    }

    loadGoogleIdentityServices()
      .then((google) => {
        if (!active || !googleButtonRef.current) return;
        google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => googleHandlerRef.current?.(response.credential)
        });
        googleButtonRef.current.replaceChildren();
        google.accounts.id.renderButton(googleButtonRef.current, {
          theme: 'outline',
          size: 'large',
          text: modeRef.current === 'signup' ? 'signup_with' : 'signin_with',
          shape: 'rectangular',
          width: 380
        });
      })
      .catch((loadError) => {
        console.warn("Google Identity Services notice:", loadError.message);
      });

    return () => { active = false; };
  }, [isOpen, pendingVerification, mode]);

  if (!isOpen) return null;

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setName('');
    setConfirmPassword('');
    setPendingVerification(null);
    setShowGoogleSetup(false);
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleLaunchGoogleSignIn = async () => {
    setError(null);
    const clientId = getEffectiveGoogleClientId();

    if (!clientId) {
      // Prompt user to provide their Google Cloud OAuth Client ID for live connection
      setShowGoogleSetup(true);
      return;
    }

    try {
      setLoading(true);
      const google = await loadGoogleIdentityServices();
      google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => googleHandlerRef.current?.(response.credential)
      });
      google.accounts.id.prompt();
    } catch (err) {
      setError(err.message || 'Unable to open Google Sign-In. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveClientIdAndLaunch = async (e) => {
    e.preventDefault();
    const cleanId = customClientId.trim();
    if (!cleanId) {
      setError('Please paste a valid Google OAuth Client ID.');
      return;
    }

    try {
      localStorage.setItem('credihire_google_client_id', cleanId);
      setShowGoogleSetup(false);
      setLoading(true);

      const google = await loadGoogleIdentityServices();
      google.accounts.id.initialize({
        client_id: cleanId,
        callback: (response) => googleHandlerRef.current?.(response.credential)
      });
      google.accounts.id.prompt();
    } catch (err) {
      setError(err.message || 'Failed to initialize Google Sign-In with provided Client ID.');
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
        const registration = await signup(name, email, password);
        if (registration && registration.message && registration.message.includes('verification link')) {
          setPendingVerification(registration);
          return;
        }
      }
      resetForm();
      onClose();
    } catch (err) {
      if (err.code === 'ACCOUNT_NOT_FOUND') {
        if (showToast) {
          showToast("No account found. Please create an account.", "warning");
        }
        setMode('signup');
        modeRef.current = 'signup';
        setError("No account found with this email. Please create your account below.");
      } else {
        setError(err.message || "Authentication failed. Please check your credentials.");
      }
    } finally {
      setLoading(false);
    }
  };

  const effectiveClientId = getEffectiveGoogleClientId();

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
        {!pendingVerification && (
          <div className="auth-tabs-row">
            <button
              type="button"
              className={`auth-tab-btn ${mode === 'signin' ? 'active' : ''}`}
              onClick={() => { modeRef.current = 'signin'; setMode('signin'); setError(null); setShowGoogleSetup(false); }}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`auth-tab-btn ${mode === 'signup' ? 'active' : ''}`}
              onClick={() => { modeRef.current = 'signup'; setMode('signup'); setError(null); setShowGoogleSetup(false); }}
            >
              Create Account
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="modal-body-custom pt-3">
          {/* Error Notice */}
          {error && (
            <div className="input-feedback-error mb-3 p-2 rounded" style={{ background: 'rgba(255, 64, 88, 0.1)', border: '1px solid rgba(255, 64, 88, 0.3)' }}>
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          {pendingVerification ? (
            <div className="text-center py-4" role="status">
              <CheckCircle2 size={42} className="text-success mb-3" />
              <h3 className="h5 text-white">Check your email</h3>
              <p className="text-white-50 mb-3">
                We sent a verification link to <strong className="text-white">{pendingVerification.email}</strong>.
                Verify your email before signing in.
              </p>
              <p className="small text-white-50">
                CrediHire user ID: <code>{pendingVerification.user_id}</code>
              </p>
              <button
                type="button"
                className="btn btn-primary mt-2"
                onClick={() => {
                  setPendingVerification(null);
                  setMode('signin');
                  modeRef.current = 'signin';
                  setError(null);
                }}
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <>
              {/* Google Setup Card if user clicked Google but Client ID is needed */}
              {showGoogleSetup && (
                <div className="p-3 mb-3 rounded" style={{ background: 'rgba(66, 133, 244, 0.08)', border: '1px solid rgba(66, 133, 244, 0.35)' }}>
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <div className="d-flex align-items-center gap-2">
                      <GoogleIcon size={18} />
                      <span className="text-white fw-bold" style={{ fontSize: '0.88rem' }}>Connect Google OAuth</span>
                    </div>
                    <button
                      type="button"
                      className="btn btn-sm btn-link text-white-50 p-0 text-decoration-none"
                      onClick={() => setShowGoogleSetup(false)}
                    >
                      Cancel
                    </button>
                  </div>
                  <p className="text-white-50 mb-3" style={{ fontSize: '0.78rem' }}>
                    To open Google's authentic sign-in popup directly from Google servers, please enter your Google OAuth Client ID:
                  </p>
                  <form onSubmit={handleSaveClientIdAndLaunch} className="d-flex flex-column gap-2">
                    <div className="auth-input-wrapper">
                      <Key size={15} className="auth-input-icon" />
                      <input
                        type="text"
                        className="auth-input-field"
                        placeholder="e.g. 123456789-abc.apps.googleusercontent.com"
                        value={customClientId}
                        onChange={(e) => setCustomClientId(e.target.value)}
                        required
                      />
                    </div>
                    <div className="d-flex gap-2 mt-1">
                      <button
                        type="submit"
                        className="btn btn-primary btn-sm flex-grow-1 py-2 fw-semibold"
                        disabled={loading}
                      >
                        {loading ? 'Connecting...' : 'Launch Google Sign-In'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm px-3"
                        onClick={() => setShowGoogleSetup(false)}
                      >
                        Back
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Real Google Sign In / Sign Up Button */}
              {effectiveClientId ? (
                <div className="google-signin-button d-flex justify-content-center mb-3" ref={googleButtonRef} id="btn-google-auth" />
              ) : (
                <button
                  type="button"
                  className="btn-google-auth"
                  onClick={handleLaunchGoogleSignIn}
                  disabled={loading}
                  id="btn-google-auth"
                >
                  <GoogleIcon size={18} />
                  <span>{mode === 'signin' ? 'Sign in with Google' : 'Sign up with Google'}</span>
                </button>
              )}

              {/* Divider: OR Continue with Email */}
              <div className="auth-divider">
                <div className="auth-divider-line" />
                <span className="auth-divider-text">OR CONTINUE WITH EMAIL</span>
                <div className="auth-divider-line" />
              </div>

              {/* Standard Email & Password Form */}
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
                      onClick={() => { modeRef.current = 'signup'; setMode('signup'); setError(null); setShowGoogleSetup(false); }}
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
                      onClick={() => { modeRef.current = 'signin'; setMode('signin'); setError(null); setShowGoogleSetup(false); }}
                    >
                      Sign in here
                    </button>
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
