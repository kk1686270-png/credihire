const GOOGLE_IDENTITY_SCRIPT = 'https://accounts.google.com/gsi/client';
let googleScriptPromise;

export function loadGoogleIdentityServices() {
  if (globalThis.google?.accounts?.id) {
    return Promise.resolve(globalThis.google);
  }
  if (googleScriptPromise) {
    return googleScriptPromise;
  }

  googleScriptPromise = new Promise((resolve, reject) => {
    let script = document.querySelector(`script[src="${GOOGLE_IDENTITY_SCRIPT}"]`);
    const handleLoad = () => {
      if (globalThis.google?.accounts?.id) {
        resolve(globalThis.google);
      } else {
        googleScriptPromise = null;
        reject(new Error('Google sign-in could not be loaded. Please try again.'));
      }
    };
    const handleError = () => {
      googleScriptPromise = null;
      reject(new Error('Google sign-in could not be loaded. Please try again.'));
    };

    if (!script) {
      script = document.createElement('script');
      script.src = GOOGLE_IDENTITY_SCRIPT;
      script.async = true;
      script.defer = true;
      script.addEventListener('load', handleLoad, { once: true });
      script.addEventListener('error', handleError, { once: true });
      document.head.appendChild(script);
      return;
    }

    script.addEventListener('load', handleLoad, { once: true });
    script.addEventListener('error', handleError, { once: true });
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
    prompt: 'consent'
  });
  if (emailHint) {
    params.set('login_hint', emailHint.trim().toLowerCase());
  }
  return `${base}?${params.toString()}`;
}

