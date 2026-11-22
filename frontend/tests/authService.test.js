import test from 'node:test';
import assert from 'node:assert/strict';
import { loginAccount, loginWithGoogleCredential, registerAccount, verifyAccountEmail } from '../src/services/authService.js';

test('auth service sends registration, verification, and login requests to the configured API', async () => {
  const requests = [];
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options, body: JSON.parse(options.body) });
    return { ok: true, json: async () => ({ user_id: 'server-user-id' }) };
  };

  try {
    await registerAccount({ name: 'Ravi Sharma', email: 'ravi@example.org', password: 'secret123' }, 'https://api.example/api/v1/');
    await verifyAccountEmail('verification-token', 'https://api.example/api/v1');
    await loginAccount({ email: 'ravi@example.org', password: 'secret123' }, 'https://api.example/api/v1');
    await loginWithGoogleCredential('google-id-token', 'https://api.example/api/v1');
  } finally {
    globalThis.fetch = previousFetch;
  }

  assert.deepEqual(requests.map((request) => request.url), [
    'https://api.example/api/v1/auth/register',
    'https://api.example/api/v1/auth/verify',
    'https://api.example/api/v1/auth/login',
    'https://api.example/api/v1/auth/google'
  ]);
  assert.deepEqual(requests[0].body, { name: 'Ravi Sharma', email: 'ravi@example.org', password: 'secret123' });
  assert.deepEqual(requests[1].body, { token: 'verification-token' });
  assert.deepEqual(requests[3].body, { credential: 'google-id-token' });
});
