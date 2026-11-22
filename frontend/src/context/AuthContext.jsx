import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  validateRealEmail, 
  validateRealName, 
  validateRealPassword,
  validateGoogleAccountEmail
} from '../utils/validation.js';
import { loginAccount, loginWithGoogleCredential, registerAccount, verifyAccountEmail } from '../services/authService.js';
import { getSavedGoogleAccounts, saveGoogleAccount } from '../utils/googleAccounts.js';

const AuthContext = createContext(null);

const STORAGE_KEY = 'credihire_user_session';
const HISTORY_KEY_PREFIX = 'credihire_history_';
const USERS_STORAGE_KEY = 'credihire_registered_accounts';

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
          showToast(`Welcome back, ${sessionUser.name}! Signed in with Google.`);
          return sessionUser;
        }
      } catch (backendErr) {
        console.warn("Backend Google verification skipped/failed, parsing token:", backendErr);
      }

      // Client-side JWT parse fallback
      try {
        const base64Url = googleData.split('.')[1];
        if (base64Url) {
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const jsonPayload = decodeURIComponent(
            atob(base64)
              .split('')
              .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
              .join('')
          );
          const payload = JSON.parse(jsonPayload);
          email = payload.email || '';
          name = payload.name || payload.given_name || 'Google User';
          picture = payload.picture || null;
          sub = payload.sub || null;
        }
      } catch (parseErr) {
        throw new Error("Invalid Google credential format.");
      }
    } else if (googleData && typeof googleData === 'object') {
      email = googleData.email || '';
      name = googleData.name || 'Google User';
      picture = googleData.picture || null;
      sub = googleData.sub || null;
    } else {
      throw new Error('Please select or enter a valid Google account.');
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
    saveGoogleAccount({ name: finalName, email: normEmail });

    setUser(sessionUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionUser));
    showToast(`Welcome, ${sessionUser.name}! Signed in with Google.`);
    return sessionUser;
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
      clearHistory
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
