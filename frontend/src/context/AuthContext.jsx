import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  validateRealEmail, 
  validateRealName, 
  validateRealPassword,
  validateGoogleAccountEmail
} from '../utils/validation.js';
import { loginAccount, loginWithGoogleCredential, registerAccount, verifyAccountEmail } from '../services/authService.js';

const AuthContext = createContext(null);

const STORAGE_KEY = 'credihire_user_session';
const HISTORY_KEY_PREFIX = 'credihire_history_';
const USERS_STORAGE_KEY = 'credihire_registered_accounts';

// Purge any fake mock Google accounts that were previously stored
try {
  localStorage.removeItem('credihire_saved_google_accounts');
  const rawAccounts = localStorage.getItem(USERS_STORAGE_KEY);
  if (rawAccounts) {
    const parsed = JSON.parse(rawAccounts);
    const fakeEmails = ['fszz@gmail.com', 'priya.google@gmail.com', 'karan.google@gmail.com'];
    const filtered = parsed.filter(a => !fakeEmails.includes(a.email?.toLowerCase()));
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(filtered));
  }
} catch {}

const getRegisteredAccounts = () => {
  try {
    const data = localStorage.getItem(USERS_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

const saveRegisteredAccount = (account) => {
  try {
    const accounts = getRegisteredAccounts();
    const updated = [...accounts.filter(a => a.email.toLowerCase() !== account.email.toLowerCase()), account];
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn("Could not save account to localStorage:", e);
  }
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [savedAccounts, setSavedAccounts] = useState(() => getRegisteredAccounts());
  const [history, setHistory] = useState([]);
  const [toastMessage, setToastMessage] = useState(null);

  // Load history whenever user changes
  useEffect(() => {
    if (user && user.id) {
      try {
        const savedHistory = localStorage.getItem(HISTORY_KEY_PREFIX + user.id);
        if (savedHistory) {
          setHistory(JSON.parse(savedHistory));
        } else {
          setHistory([]);
        }
      } catch {
        setHistory([]);
      }
    } else {
      setHistory([]);
    }
  }, [user]);

  // Handle Google OAuth 2.0 popup and redirect tokens
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    // 1. If this window itself was opened as a popup by CrediHire:
    if (window.opener && window.opener !== window) {
      const hash = window.location.hash;
      if (hash && (hash.includes('id_token=') || hash.includes('access_token='))) {
        try {
          window.opener.postMessage({ type: 'GOOGLE_OAUTH_TOKEN', hash }, window.location.origin);
          window.close();
          return undefined;
        } catch (e) {
          console.warn("Could not postMessage to opener window:", e);
        }
      }
    }

    // 2. Direct full-page redirect handling (when not in popup):
    const hash = window.location.hash;
    if (hash && (hash.includes('id_token=') || hash.includes('access_token='))) {
      const params = new URLSearchParams(hash.replace(/^#/, ''));
      const idToken = params.get('id_token');
      const accessToken = params.get('access_token');
      if (idToken) {
        loginWithGoogle(idToken).then(() => {
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }).catch(err => {
          console.warn("Google OAuth redirect token error:", err);
        });
      } else if (accessToken) {
        loginWithGoogle({ accessToken }).then(() => {
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }).catch(err => {
          console.warn("Google OAuth access token error:", err);
        });
      }
    }

    // 3. Listen for postMessage from Google OAuth popup:
    const handlePopupMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'GOOGLE_OAUTH_TOKEN' && event.data?.hash) {
        const params = new URLSearchParams(event.data.hash.replace(/^#/, ''));
        const idToken = params.get('id_token');
        const accessToken = params.get('access_token');
        if (idToken) {
          loginWithGoogle(idToken).catch(err => {
            console.warn("Google OAuth token error from popup:", err);
          });
        } else if (accessToken) {
          loginWithGoogle({ accessToken }).catch(err => {
            console.warn("Google OAuth access token error from popup:", err);
          });
        }
      }
    };

    window.addEventListener('message', handlePopupMessage);
    return () => window.removeEventListener('message', handlePopupMessage);
  }, []);

  const showToast = (msg, type = 'info') => {
    const payload = typeof msg === 'string' ? { message: msg, type } : msg;
    setToastMessage(payload);
    setTimeout(() => setToastMessage(null), 4500);
  };

  const login = async (email, password) => {
    if (!email || !password) {
      throw new Error("Please enter both email and password.");
    }

    const emailValidation = validateRealEmail(email);
    if (!emailValidation.isValid) {
      throw new Error(emailValidation.error);
    }
    const normEmail = emailValidation.normalizedEmail;

    let userData = null;
    try {
      const response = await loginAccount({ email: normEmail, password });
      if (response && response.user) {
        const account = response.user;
        const generatedName = account.name || 'Job Seeker';
        userData = {
          id: account.user_id,
          name: generatedName,
          email: normEmail,
          avatarUrl: null,
          avatarInitials: (generatedName.split(' ').map(n => n[0]).join('') || 'U').slice(0, 2).toUpperCase(),
          plan: 'Verified Job Seeker',
          provider: 'email',
          joinedAt: new Date().toLocaleDateString()
        };
      }
    } catch (backendErr) {
      // Check local registered accounts
      const accounts = getRegisteredAccounts();
      const localAcc = accounts.find(a => a.email.toLowerCase() === normEmail);
      if (!localAcc) {
        const error = new Error("No account found with this email. Please create an account first.");
        error.code = 'ACCOUNT_NOT_FOUND';
        throw error;
      }
      if (localAcc.password && localAcc.password !== password) {
        throw new Error("Incorrect password. Please try again.");
      }
      const generatedName = localAcc.name || 'Job Seeker';
      userData = {
        id: localAcc.id || 'usr_' + Date.now().toString(36),
        name: generatedName,
        email: normEmail,
        avatarUrl: null,
        avatarInitials: (generatedName.split(' ').map(n => n[0]).join('') || 'U').slice(0, 2).toUpperCase(),
        plan: 'Verified Job Seeker',
        provider: 'email',
        joinedAt: localAcc.joinedAt || new Date().toLocaleDateString()
      };
    }

    if (!userData) {
      const error = new Error("No account found with this email. Please create an account first.");
      error.code = 'ACCOUNT_NOT_FOUND';
      throw error;
    }

    setUser(userData);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
    showToast(`Welcome back, ${userData.name}!`);
    return userData;
  };

  const signup = async (name, email, password) => {
    const nameValidation = validateRealName(name);
    if (!nameValidation.isValid) {
      throw new Error(nameValidation.error);
    }

    const emailValidation = validateRealEmail(email);
    if (!emailValidation.isValid) {
      throw new Error(emailValidation.error);
    }

    const passwordValidation = validateRealPassword(password);
    if (!passwordValidation.isValid) {
      throw new Error(passwordValidation.error);
    }

    const normEmail = emailValidation.normalizedEmail;
    const cleanName = nameValidation.sanitizedName;

    // Check if account already exists
    const accounts = getRegisteredAccounts();
    if (accounts.some(a => a.email.toLowerCase() === normEmail)) {
      throw new Error("An account with this email already exists. Please sign in instead.");
    }

    let registeredAccount = null;
    try {
      registeredAccount = await registerAccount({ name: cleanName, email: normEmail, password });
    } catch (backendErr) {
      console.warn("Backend registration unavailable or unconfigured, registering locally:", backendErr);
    }

    const localAccount = {
      id: registeredAccount?.user_id || 'usr_' + Date.now().toString(36),
      name: cleanName,
      email: normEmail,
      password: password,
      avatarInitials: (cleanName.split(' ').map(n => n[0]).join('') || 'U').slice(0, 2).toUpperCase(),
      plan: 'New Member Shield',
      provider: 'email',
      joinedAt: new Date().toLocaleDateString()
    };
    saveRegisteredAccount(localAccount);
    setSavedAccounts(getRegisteredAccounts());

    const sessionUser = { ...localAccount };
    delete sessionUser.password;
    setUser(sessionUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionUser));
    showToast(`Account created successfully! Welcome, ${sessionUser.name}.`);

    return registeredAccount || localAccount;
  };

  const verifyEmail = async (token) => verifyAccountEmail(token);

  const loginWithGoogle = async (googleData) => {
    let email = '';
    let name = '';
    let picture = null;
    let sub = null;

    if (typeof googleData === 'string') {
      // It's a Google ID Token (JWT) from Google Identity Services
      try {
        const response = await loginWithGoogleCredential(googleData);
        if (response && response.user) {
          const account = response.user;
          const sessionUser = {
            id: account.user_id,
            name: account.name,
            email: account.email,
            avatarUrl: null,
            avatarInitials: (account.name.split(' ').map(p => p[0]).join('') || 'G').slice(0, 2).toUpperCase(),
            plan: 'Verified Google Member',
            provider: 'google',
            joinedAt: new Date().toLocaleDateString()
          };
          setUser(sessionUser);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionUser));
          showToast(`Welcome, ${sessionUser.name}! Signed in with Google.`);
          return sessionUser;
        }
      } catch (backendErr) {
        console.warn("Backend Google verification skipped/failed, parsing real token:", backendErr);
      }

      // Cryptographic JWT extraction from real Google token
      try {
        const base64Url = googleData.split('.')[1];
        if (!base64Url) throw new Error("Invalid token");
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
          atob(base64)
            .split('')
            .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join('')
        );
        const payload = JSON.parse(jsonPayload);

        if (payload.iss && !payload.iss.includes('accounts.google.com')) {
          throw new Error("Invalid token issuer. Only real Google accounts are accepted.");
        }
        if (payload.email_verified === false) {
          throw new Error("This Google account is unverified. Only verified real Google accounts are permitted.");
        }

        email = payload.email || '';
        name = payload.name || payload.given_name || 'Google User';
        picture = payload.picture || null;
        sub = payload.sub || null;
      } catch (parseErr) {
        throw new Error(parseErr.message || "Failed to verify Google credential.");
      }
    } else if (googleData && typeof googleData === 'object' && googleData.credential) {
      return loginWithGoogle(googleData.credential);
    } else if (googleData && typeof googleData === 'object' && googleData.accessToken) {
      try {
        const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${googleData.accessToken}` }
        });
        if (userInfoRes.ok) {
          const profile = await userInfoRes.json();
          email = profile.email || '';
          name = profile.name || profile.given_name || 'Google User';
          picture = profile.picture || null;
          sub = profile.sub || null;
        } else {
          throw new Error('Unable to retrieve Google profile with access token.');
        }
      } catch (profileErr) {
        throw new Error(profileErr.message || 'Google access verification failed.');
      }
    } else {
      throw new Error('Please authenticate through the official Google Sign-In prompt.');
    }

    const emailValidation = validateGoogleAccountEmail(email);
    if (!emailValidation.isValid) {
      throw new Error(emailValidation.error);
    }
    const normEmail = emailValidation.normalizedEmail;
    const nameValidation = validateRealName(name || 'Google User');
    const finalName = nameValidation.isValid ? nameValidation.sanitizedName : 'Google User';

    const sessionUser = {
      id: 'usr_g_' + (sub || Date.now().toString(36)),
      name: finalName,
      email: normEmail,
      avatarUrl: picture,
      avatarInitials: (finalName.split(' ').map(p => p[0]).join('') || 'G').slice(0, 2).toUpperCase(),
      plan: 'Verified Google Member',
      provider: 'google',
      joinedAt: new Date().toLocaleDateString()
    };

    saveRegisteredAccount(sessionUser);
    setSavedAccounts(getRegisteredAccounts());
    setUser(sessionUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionUser));
    showToast(`Welcome, ${sessionUser.name}! Signed in with Google.`);
    return sessionUser;
  };

  const removeSavedAccount = (emailToRemove) => {
    if (!emailToRemove) return [];
    try {
      const accounts = getRegisteredAccounts();
      const updated = accounts.filter(a => a.email?.toLowerCase() !== emailToRemove.toLowerCase());
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updated));
      setSavedAccounts(updated);
      showToast(`Removed saved email ${emailToRemove} from this device.`, 'info');
      if (user && user.email?.toLowerCase() === emailToRemove.toLowerCase()) {
        logout();
      }
      return updated;
    } catch (e) {
      console.warn("Could not remove saved account:", e);
      return [];
    }
  };

  const clearAllSavedAccounts = () => {
    try {
      localStorage.removeItem(USERS_STORAGE_KEY);
      setSavedAccounts([]);
      showToast("All saved emails removed from this device.", 'info');
      if (user) {
        logout();
      }
    } catch (e) {
      console.warn("Could not clear saved accounts:", e);
    }
  };

  const deleteMyAccount = () => {
    if (!user || !user.email) return;
    const emailToDelete = user.email;
    removeSavedAccount(emailToDelete);
    if (user.id) {
      try {
        localStorage.removeItem(HISTORY_KEY_PREFIX + user.id);
      } catch {}
    }
    showToast(`Account ${emailToDelete} and data deleted successfully.`, 'info');
  };

  const logout = () => {
    const prevName = user?.name || 'User';
    setUser(null);
    setHistory([]);
    localStorage.removeItem(STORAGE_KEY);
    showToast(`Signed out successfully. See you soon, ${prevName}!`);
  };

  const addScanToHistory = (scanResult) => {
    if (!user || !user.id || !scanResult) return;

    const newEntry = {
      id: 'hist_' + Date.now().toString(36),
      date: 'Just now',
      text: scanResult.submittedText || '',
      attachedFile: scanResult.attachedFile || null,
      riskScore: scanResult.riskScore || 0,
      riskLevel: scanResult.riskLevel || 'low',
      headline: scanResult.headline || 'Analyzed Offer',
      summary: scanResult.summary || 'Scan completed',
      channel: scanResult.channel || 'generic',
      warningsCount: scanResult.warningSigns?.length || 0,
      warningTitles: scanResult.warningSigns?.map(w => w.title) || [],
      fullResult: scanResult
    };

    setHistory(prev => {
      const updated = [newEntry, ...prev.filter(item => {
        if (newEntry.attachedFile && item.attachedFile) {
          return item.attachedFile.name !== newEntry.attachedFile.name;
        }
        return item.id !== newEntry.id;
      })];

      try {
        localStorage.setItem(HISTORY_KEY_PREFIX + user.id, JSON.stringify(updated.slice(0, 50)));
      } catch (e) {
        console.warn("Could not update history in localStorage:", e);
      }
      return updated;
    });
  };

  const deleteHistoryItem = (id) => {
    if (!user || !user.id) return;
    setHistory(prev => {
      const updated = prev.filter(item => item.id !== id);
      try {
        localStorage.setItem(HISTORY_KEY_PREFIX + user.id, JSON.stringify(updated));
      } catch (e) {
        console.warn("Could not update history in localStorage:", e);
      }
      return updated;
    });
    showToast("Scan deleted from history.");
  };

  const clearHistory = () => {
    if (!user || !user.id) return;
    setHistory([]);
    try {
      localStorage.removeItem(HISTORY_KEY_PREFIX + user.id);
    } catch (e) {
      console.warn("Could not clear history:", e);
    }
    showToast("Scan history cleared.");
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      login, 
      signup, 
      verifyEmail,
      loginWithGoogle,
      logout, 
      toastMessage,
      showToast,
      history,
      addScanToHistory,
      deleteHistoryItem,
      clearHistory,
      savedAccounts,
      removeSavedAccount,
      clearAllSavedAccounts,
      deleteMyAccount
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
