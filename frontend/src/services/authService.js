const runtimeApiBase = typeof import.meta !== 'undefined' && import.meta.env
  ? import.meta.env.VITE_API_BASE_URL
  : undefined;

export class AuthApiError extends Error {
  constructor(message, status = null) {
    super(message);
    this.name = 'AuthApiError';
    this.status = status;
  }
}

function getApiBaseUrl(apiBaseUrl = runtimeApiBase) {
  if (!apiBaseUrl || !apiBaseUrl.trim()) {
    throw new AuthApiError('Account service is not configured. Set VITE_API_BASE_URL and try again.');
  }
  return apiBaseUrl.replace(/\/$/, '');
}

async function requestAuth(path, payload, apiBaseUrl) {
  let response;
  try {
    response = await fetch(`${getApiBaseUrl(apiBaseUrl)}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch {
    throw new AuthApiError('Unable to connect to the account service. Check your connection and try again.');
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    // Keep unexpected proxy responses from exposing implementation details.
  }
  if (!response.ok) {
    throw new AuthApiError(data?.detail || 'Account request failed. Please try again.', response.status);
  }
  return data;
}

export function registerAccount({ name, email, password }, apiBaseUrl) {
  return requestAuth('/auth/register', { name, email, password }, apiBaseUrl);
}

export function verifyAccountEmail(token, apiBaseUrl) {
  return requestAuth('/auth/verify', { token }, apiBaseUrl);
}

export function loginWithGoogleCredential(credential, apiBaseUrl) {
  return requestAuth('/auth/google', { credential }, apiBaseUrl);
}

export function loginAccount({ email, password }, apiBaseUrl) {
  return requestAuth('/auth/login', { email, password }, apiBaseUrl);
}
