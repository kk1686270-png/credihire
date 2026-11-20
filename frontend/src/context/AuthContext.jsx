import React, { createContext, useContext, useState, useEffect } from 'react';

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

    const normEmail = email.toLowerCase().trim();
    const accounts = getRegisteredAccounts();
    const existingAccount = accounts.find(a => a.email.toLowerCase() === normEmail);

    if (!existingAccount) {
      const error = new Error("No account found with this email. Please create an account first.");
      error.code = 'ACCOUNT_NOT_FOUND';
      throw error;
    }

    if (existingAccount.password && existingAccount.password !== password) {
      throw new Error("Incorrect password. Please try again.");
    }

    const generatedName = existingAccount.name || 'Job Seeker';

    const userData = {
      id: existingAccount.id || 'usr_' + Date.now().toString(36),
      name: generatedName,
      email: normEmail,
      avatarInitials: existingAccount.avatarInitials || (generatedName.split(' ').map(n => n[0]).join('') || 'U').slice(0, 2).toUpperCase(),
      plan: existingAccount.plan || 'Verified Job Seeker',
      joinedAt: existingAccount.joinedAt || new Date().toLocaleDateString()
    };

    setUser(userData);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
    showToast(`Welcome back, ${userData.name}!`);
    return userData;
  };

  const signup = async (name, email, password) => {
    if (!name || !email || !password) {
      throw new Error("Please fill in all required fields.");
    }
    if (password.length < 6) {
      throw new Error("Password must be at least 6 characters.");
    }

    const normEmail = email.toLowerCase().trim();
    const userData = {
      id: 'usr_' + Date.now().toString(36),
      name: name.trim(),
      email: normEmail,
      password: password,
      avatarInitials: (name.trim().split(' ').map(n => n[0]).join('') || 'U').slice(0, 2).toUpperCase(),
      plan: 'New Member Shield',
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
