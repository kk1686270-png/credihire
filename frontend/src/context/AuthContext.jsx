import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  validateRealEmail, 
  validateRealName, 
  validateRealPassword, 
  validateGoogleAccountEmail 
} from '../utils/validation.js';

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

    const accounts = getRegisteredAccounts();
    const existingAccount = accounts.find(a => a.email.toLowerCase() === normEmail);

    if (!existingAccount) {
      const error = new Error("No account found with this email. Please create an account first.");
      error.code = 'ACCOUNT_NOT_FOUND';
      throw error;
    }

    if (existingAccount.provider === 'google' && !existingAccount.password) {
      throw new Error("This account is registered with Google. Please use 'Sign in with Google'.");
    }

    if (existingAccount.password && existingAccount.password !== password) {
      throw new Error("Incorrect password. Please try again.");
    }

    const generatedName = existingAccount.name || 'Job Seeker';

    const userData = {
      id: existingAccount.id || 'usr_' + Date.now().toString(36),
      name: generatedName,
      email: normEmail,
      avatarUrl: existingAccount.avatarUrl || null,
      avatarInitials: existingAccount.avatarInitials || (generatedName.split(' ').map(n => n[0]).join('') || 'U').slice(0, 2).toUpperCase(),
      plan: existingAccount.plan || 'Verified Job Seeker',
      provider: existingAccount.provider || 'email',
      joinedAt: existingAccount.joinedAt || new Date().toLocaleDateString()
    };

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
    const accounts = getRegisteredAccounts();
    const existingAccount = accounts.find(a => a.email.toLowerCase() === normEmail);
    if (existingAccount) {
      throw new Error("An account with this email already exists. Please sign in instead.");
    }

    const cleanName = nameValidation.sanitizedName;
    const userData = {
      id: 'usr_' + Date.now().toString(36),
      name: cleanName,
      email: normEmail,
      password: password,
      avatarUrl: null,
      avatarInitials: (cleanName.split(' ').map(n => n[0]).join('') || 'U').slice(0, 2).toUpperCase(),
      plan: 'New Member Shield',
      provider: 'email',
      joinedAt: new Date().toLocaleDateString()
    };

    saveRegisteredAccount(userData);

    const sessionUser = { ...userData };
    delete sessionUser.password;

    setUser(sessionUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionUser));
    showToast(`Account created successfully! Welcome, ${sessionUser.name}.`);
    return sessionUser;
  };

  const loginWithGoogle = async (googleAuthInput) => {
    let email = '';
    let name = '';
    let picture = null;
    let sub = null;

    if (typeof googleAuthInput === 'string') {
      // Decode Google Identity Services JWT credential
      try {
        const base64Url = googleAuthInput.split('.')[1];
        if (!base64Url) throw new Error("Invalid JWT token format");
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
          atob(base64)
            .split('')
            .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join('')
        );
        const payload = JSON.parse(jsonPayload);

        if (!payload.email) {
          throw new Error("Google credential missing email address.");
        }
        if (payload.email_verified === false) {
          throw new Error("Google account is not verified. Only real verified accounts can sign in.");
        }

        email = payload.email;
        name = payload.name || payload.given_name || 'Google User';
        picture = payload.picture || null;
        sub = payload.sub || null;
      } catch (err) {
        throw new Error(err.message || "Failed to process Google account credentials.");
      }
    } else if (googleAuthInput && typeof googleAuthInput === 'object') {
      // Direct validated Google account input
      email = googleAuthInput.email || '';
      name = googleAuthInput.name || '';
      picture = googleAuthInput.picture || null;
      sub = googleAuthInput.sub || null;
    } else {
      throw new Error("Invalid Google authentication data.");
    }

    // Validate that it's a real Google account
    const googleEmailValidation = validateGoogleAccountEmail(email);
    if (!googleEmailValidation.isValid) {
      throw new Error(googleEmailValidation.error);
    }
    const normEmail = googleEmailValidation.normalizedEmail;

    const nameValidation = validateRealName(name || 'Google Member');
    const finalName = nameValidation.isValid ? nameValidation.sanitizedName : 'Google Member';

    const accounts = getRegisteredAccounts();
    const existingAccount = accounts.find(a => a.email.toLowerCase() === normEmail);

    let sessionUser;
    if (existingAccount) {
      sessionUser = {
        id: existingAccount.id,
        name: existingAccount.name || finalName,
        email: normEmail,
        avatarUrl: picture || existingAccount.avatarUrl || null,
        avatarInitials: (finalName.split(' ').map(n => n[0]).join('') || 'G').slice(0, 2).toUpperCase(),
        plan: existingAccount.plan || 'Verified Google Member',
        provider: 'google',
        joinedAt: existingAccount.joinedAt || new Date().toLocaleDateString()
      };
      saveRegisteredAccount({ ...existingAccount, ...sessionUser });
      showToast(`Welcome back, ${sessionUser.name}! Signed in with Google.`);
    } else {
      // Automatically provision new genuine Google account
      sessionUser = {
        id: 'usr_g_' + (sub || Date.now().toString(36)),
        name: finalName,
        email: normEmail,
        avatarUrl: picture || null,
        avatarInitials: (finalName.split(' ').map(n => n[0]).join('') || 'G').slice(0, 2).toUpperCase(),
        plan: 'Verified Google Member',
        provider: 'google',
        joinedAt: new Date().toLocaleDateString()
      };
      saveRegisteredAccount(sessionUser);
      showToast(`Account created successfully! Welcome, ${sessionUser.name}.`);
    }

    setUser(sessionUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionUser));
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
        if (newEntry.text && item.text) {
          return item.text !== newEntry.text;
        }
        return item.id !== newEntry.id;
      })];
      try {
        localStorage.setItem(HISTORY_KEY_PREFIX + user.id, JSON.stringify(updated));
      } catch (e) {
        console.warn("Could not save history to localStorage:", e);
      }
      return updated;
    });

    showToast("Scan saved to your History.");
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
