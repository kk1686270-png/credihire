import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 
  validateRealEmail, 
  validateGoogleAccountEmail, 
  validateRealName, 
  validateRealPassword,
  validateGoogleClientId,
  isValidGoogleClientId,
  DISPOSABLE_OR_TEST_DOMAINS 
} from '../src/utils/validation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('validateRealEmail accepts valid real email addresses', () => {
  const validEmails = [
    'karankumar@gmail.com',
    'priya.sharma@outlook.com',
    'john.doe@techcorp.io',
    'student@university.edu',
    'recruiter@company.co.in'
  ];

  for (const email of validEmails) {
    const res = validateRealEmail(email);
    assert.strictEqual(res.isValid, true, `Should accept valid real email: ${email}`);
    assert.strictEqual(res.error, null);
    assert.strictEqual(res.normalizedEmail, email.toLowerCase());
  }
});

test('validateRealEmail rejects malformed, incomplete, or dummy emails', () => {
  const invalidEmails = [
    '',
    '   ',
    'notanemail',
    '@nodomain.com',
    'missingdomain@',
    'user@.com',
    'user@domain',
    'a@b.c' // TLD too short or local part too short
  ];

  for (const email of invalidEmails) {
    const res = validateRealEmail(email);
    assert.strictEqual(res.isValid, false, `Should reject invalid email: ${email}`);
    assert.ok(res.error, `Error message must be present for: ${email}`);
  }
});

test('validateRealEmail rejects disposable and fake test domains', () => {
  const testDomains = [
    'tempmail.com',
    '10minutemail.com',
    'mailinator.com',
    'guerrillamail.com',
    'yopmail.com',
    'fake.com',
    'test.com',
    'example.com',
    'throwawaymail.com'
  ];

  for (const domain of testDomains) {
    const res = validateRealEmail(`user@${domain}`);
    assert.strictEqual(res.isValid, false, `Should reject disposable/test domain: ${domain}`);
    assert.ok(res.error.includes('Temporary') || res.error.includes('disposable') || res.error.includes('test'));
  }
});

test('validateGoogleAccountEmail enforces genuine Google account domains', () => {
  // Valid Google domains
  const validGoogle = ['rajesh.verma@gmail.com', 'user@googlemail.com'];
  for (const email of validGoogle) {
    const res = validateGoogleAccountEmail(email);
    assert.strictEqual(res.isValid, true, `Should accept valid Google email: ${email}`);
    assert.strictEqual(res.error, null);
  }

  // Non-Google domains
  const nonGoogle = ['user@yahoo.com', 'person@hotmail.com', 'someone@domain.com'];
  for (const email of nonGoogle) {
    const res = validateGoogleAccountEmail(email);
    assert.strictEqual(res.isValid, false, `Should reject non-Google email: ${email}`);
    assert.ok(res.error.includes('Google account'));
  }
});

test('validateRealName validates real personal names and rejects placeholders', () => {
  // Valid names
  assert.strictEqual(validateRealName('Karan Kumar').isValid, true);
  assert.strictEqual(validateRealName('Sarah O\'Connor').isValid, true);
  assert.strictEqual(validateRealName('Jean-Luc Picard').isValid, true);

  // Invalid names
  assert.strictEqual(validateRealName('').isValid, false);
  assert.strictEqual(validateRealName('A').isValid, false); // Too short
  assert.strictEqual(validateRealName('test').isValid, false); // Dummy name
  assert.strictEqual(validateRealName('asdf').isValid, false); // Dummy name
  assert.strictEqual(validateRealName('dummy').isValid, false); // Dummy name
  assert.strictEqual(validateRealName('User 123').isValid, false); // Digits not allowed in real person name
});

test('validateRealPassword enforces minimum 6 character password', () => {
  assert.strictEqual(validateRealPassword('Secret123!').isValid, true);
  assert.strictEqual(validateRealPassword('12345').isValid, false);
  assert.strictEqual(validateRealPassword('').isValid, false);
});

test('AuthModal renders Google Sign-In button and integrates loginWithGoogle', () => {
  const modalPath = path.join(rootDir, 'src', 'components', 'AuthModal.jsx');
  const content = fs.readFileSync(modalPath, 'utf-8');

  assert.ok(content.includes('loginWithGoogle'), 'AuthModal accesses loginWithGoogle from useAuth');
  assert.ok(content.includes('btn-google-auth'), 'AuthModal renders .btn-google-auth button');
  assert.ok(content.includes('GoogleIcon'), 'AuthModal renders GoogleIcon');
  assert.ok(content.includes('Sign in with Google'), 'Supports Sign in with Google');
  assert.ok(content.includes('Sign up with Google'), 'Supports Sign up with Google');
  assert.ok(content.includes('googleButtonRef'), 'Includes ref for official Google Identity Services button');
  assert.ok(!content.includes('google-chooser-card'), 'No mock google-chooser-card in AuthModal');
  assert.ok(!content.includes('alex.carter@example.com'), 'Sample demo credentials completely absent');
});

test('AuthContext exports loginWithGoogle and validates real Google accounts', () => {
  const contextPath = path.join(rootDir, 'src', 'context', 'AuthContext.jsx');
  const content = fs.readFileSync(contextPath, 'utf-8');

  assert.ok(content.includes('loginWithGoogle'), 'AuthContext defines loginWithGoogle');
  assert.ok(content.includes('validateRealEmail'), 'AuthContext imports validateRealEmail');
  assert.ok(content.includes('validateGoogleAccountEmail'), 'AuthContext imports validateGoogleAccountEmail');
  assert.ok(content.includes('validateRealName'), 'AuthContext imports validateRealName');
  assert.ok(content.includes('provider: \'google\''), 'Tags Google accounts with provider: google');
});

test('validateGoogleClientId accepts valid Google OAuth Web Client IDs', () => {
  const validIds = [
    '123456789012-abcdefghijklmnopqrstuvwxyz123456.apps.googleusercontent.com',
    '987654321-foo_bar.apps.googleusercontent.com'
  ];

  for (const id of validIds) {
    const res = validateGoogleClientId(id);
    assert.strictEqual(res.isValid, true, `Should accept valid Client ID: ${id}`);
    assert.strictEqual(res.error, null);
    assert.strictEqual(isValidGoogleClientId(id), true);
  }
});

test('validateGoogleClientId rejects project IDs, empty values, and malformed strings', () => {
  const invalidIds = [
    '',
    '   ',
    'credihire-project-12345', // Project ID, not OAuth Client ID
    'my-project',
    'AIzaSyD-dummy-api-key', // API Key, not Client ID
    'abcdef.apps.googleusercontent.com', // Missing project number prefix
    '123456789.com' // Not .apps.googleusercontent.com
  ];

  for (const id of invalidIds) {
    const res = validateGoogleClientId(id);
    assert.strictEqual(res.isValid, false, `Should reject invalid Client ID: ${id}`);
    assert.ok(res.error, 'Must provide informative error');
    assert.strictEqual(isValidGoogleClientId(id), false);
  }
});

