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
