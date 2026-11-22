const GOOGLE_IDENTITY_SCRIPT = 'https://accounts.google.com/gsi/client';
let googleScriptPromise = null;

export function loadGoogleIdentityServices() {
  if (globalThis.google?.accounts?.id) {
    return Promise.resolve(globalThis.google);
  }
  if (googleScriptPromise) {
    return googleScriptPromise;
  }

  googleScriptPromise = new Promise((resolve, reject) => {
    // If google identity already loaded in globalThis
    if (globalThis.google?.accounts?.id) {
      resolve(globalThis.google);
      return;
    }

    let existingScript = document.querySelector(`script[src="${GOOGLE_IDENTITY_SCRIPT}"]`);
    if (existingScript) {
      // If script exists in DOM, poll for window.google
      let attempts = 0;
      const interval = setInterval(() => {
        attempts += 1;
        if (globalThis.google?.accounts?.id) {
          clearInterval(interval);
          resolve(globalThis.google);
        } else if (attempts > 40) {
          clearInterval(interval);
          // Script might be stalled, remove it to re-fetch
          existingScript.remove();
          googleScriptPromise = null;
          loadGoogleIdentityServices().then(resolve).catch(reject);
        }
      }, 50);
      return;
    }

    const script = document.createElement('script');
    script.src = GOOGLE_IDENTITY_SCRIPT;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      if (globalThis.google?.accounts?.id) {
        resolve(globalThis.google);
      } else {
        // Give GIS a tiny moment to initialize after script execution
        setTimeout(() => {
          if (globalThis.google?.accounts?.id) {
            resolve(globalThis.google);
          } else {
            googleScriptPromise = null;
            reject(new Error('Google Identity Services initialized without accounts.id'));
          }
        }, 100);
      }
    };

    script.onerror = () => {
      googleScriptPromise = null;
      script.remove();
      reject(new Error('Google sign-in script could not be loaded. Please check your connection.'));
    };

    document.head.appendChild(script);
  });

  return googleScriptPromise;
}

/**
 * Builds the official Google OAuth 2.0 redirect URL with login_hint.
 * When emailHint is provided, Google immediately prompts that specific account on their phone.
 */
export function getGoogleOAuthRedirectUrl({ clientId, emailHint = '', redirectUri = '' }) {
  const base = 'https://accounts.google.com/o/oauth2/v2/auth';
  const uri = redirectUri || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173');
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: uri,
    response_type: 'id_token token',
    scope: 'openid email profile',
    nonce: Math.random().toString(36).substring(2),
    prompt: 'select_account'
  });
  if (emailHint) {
    params.set('login_hint', emailHint.trim().toLowerCase());
  }
  return `${base}?${params.toString()}`;
}
