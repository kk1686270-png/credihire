/**
 * Google Account Chooser storage and management utilities for CrediHire
 */

const GOOGLE_ACCOUNTS_KEY = 'credihire_saved_google_accounts';
const REGISTERED_USERS_KEY = 'credihire_registered_accounts';

const memoryStore = new Map();

function safeGetItem(key) {
  try {
    if (typeof window !== 'undefined' && window.localStorage && typeof window.localStorage.getItem === 'function') {
      return window.localStorage.getItem(key);
    }
    if (typeof globalThis !== 'undefined' && globalThis.localStorage && typeof globalThis.localStorage.getItem === 'function') {
      return globalThis.localStorage.getItem(key);
    }
  } catch {}
  return memoryStore.get(key) || null;
}

function safeSetItem(key, value) {
  try {
    if (typeof window !== 'undefined' && window.localStorage && typeof window.localStorage.setItem === 'function') {
      window.localStorage.setItem(key, value);
      return;
    }
    if (typeof globalThis !== 'undefined' && globalThis.localStorage && typeof globalThis.localStorage.setItem === 'function') {
      globalThis.localStorage.setItem(key, value);
      return;
    }
  } catch {}
  memoryStore.set(key, value);
}

const AVATAR_COLORS = [
  '#4285F4', // Google Blue
  '#0F9D58', // Google Green
  '#DB4437', // Google Red
  '#F4B400', // Google Yellow
  '#8B5CF6'  // Purple
];

export function getAvatarColor(identifier = '') {
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    hash = identifier.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

/**
 * Returns the list of Google accounts available on this browser/session.
 * Discovers accounts from:
 * 1. Saved Google accounts store
 * 2. Any registered accounts with @gmail.com or provider: 'google'
 * 3. Default known device Google profiles if initial list is empty.
 */
export function getSavedGoogleAccounts() {
  const accountsMap = new Map();

  // 1. Load explicitly saved Google accounts
  try {
    const raw = safeGetItem(GOOGLE_ACCOUNTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach(acc => {
          if (acc && acc.email) {
            accountsMap.set(acc.email.toLowerCase(), {
              name: acc.name || 'Google User',
              email: acc.email.toLowerCase(),
              avatarColor: acc.avatarColor || getAvatarColor(acc.email)
            });
          }
        });
      }
    }
  } catch (e) {
    console.warn("Could not read saved Google accounts:", e);
  }

  // 2. Discover registered Google accounts
  try {
    const rawReg = safeGetItem(REGISTERED_USERS_KEY);
    if (rawReg) {
      const parsedReg = JSON.parse(rawReg);
      if (Array.isArray(parsedReg)) {
        parsedReg.forEach(reg => {
          if (reg && reg.email && (reg.provider === 'google' || reg.email.toLowerCase().endsWith('@gmail.com'))) {
            const lowerEmail = reg.email.toLowerCase();
            if (!accountsMap.has(lowerEmail)) {
              accountsMap.set(lowerEmail, {
                name: reg.name || 'Google User',
                email: lowerEmail,
                avatarColor: getAvatarColor(lowerEmail)
              });
            }
          }
        });
      }
    }
  } catch (e) {
    console.warn("Could not discover registered Google accounts:", e);
  }

  // 3. If still empty, seed default realistic device Google profiles
  if (accountsMap.size === 0) {
    const defaultAccounts = [
      {
        name: 'Karan Kumar',
        email: 'karan.google@gmail.com',
        avatarColor: '#4285F4'
      },
      {
        name: 'Priya Sharma',
        email: 'priya.google@gmail.com',
        avatarColor: '#0F9D58'
      }
    ];

    defaultAccounts.forEach(acc => accountsMap.set(acc.email, acc));
    try {
      safeSetItem(GOOGLE_ACCOUNTS_KEY, JSON.stringify(defaultAccounts));
    } catch {}
  }

  return Array.from(accountsMap.values());
}

/**
 * Saves or updates a Google account in the chooser list.
 */
export function saveGoogleAccount(account) {
  if (!account || !account.email) return [];

  try {
    const current = getSavedGoogleAccounts();
    const cleanEmail = account.email.trim().toLowerCase();
    const updated = [
      {
        name: account.name?.trim() || 'Google User',
        email: cleanEmail,
        avatarColor: account.avatarColor || getAvatarColor(cleanEmail)
      },
      ...current.filter(a => a.email.toLowerCase() !== cleanEmail)
    ];

    safeSetItem(GOOGLE_ACCOUNTS_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.warn("Could not save Google account:", e);
    return [];
  }
}
