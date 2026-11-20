import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('AuthModal has removed Instant Test Account demo box and demo login buttons', () => {
  const modalPath = path.join(rootDir, 'src', 'components', 'AuthModal.jsx');
  const content = fs.readFileSync(modalPath, 'utf-8');

  // Verify demo-auth-box and 1-Click Demo references are completely absent
  assert.ok(!content.includes('demo-auth-box'), 'No demo-auth-box className in AuthModal');
  assert.ok(!content.includes('Instant Test Account'), 'No Instant Test Account text in AuthModal');
  assert.ok(!content.includes('Alex Carter (1-Click Demo)'), 'No Alex Carter 1-Click button in AuthModal');
  assert.ok(!content.includes('loginWithDemo'), 'No loginWithDemo invocation in AuthModal');
});

test('AuthContext has removed mock demo accounts and requires genuine registered accounts', () => {
  const contextPath = path.join(rootDir, 'src', 'components', '..', 'context', 'AuthContext.jsx');
  const content = fs.readFileSync(contextPath, 'utf-8');

  // Verify demo bypasses and mock generators are removed
  assert.ok(!content.includes('createDemoHistory'), 'No createDemoHistory helper in AuthContext');
  assert.ok(!content.includes('loginWithDemo'), 'No loginWithDemo function exported');
  assert.ok(!content.includes('alex.carter@example.com'), 'No hardcoded alex.carter demo email in AuthContext');
  
  // Verify strict account check: unregistered email throws ACCOUNT_NOT_FOUND
  assert.ok(content.includes('ACCOUNT_NOT_FOUND'), 'Throws ACCOUNT_NOT_FOUND when account is not registered');
  assert.ok(content.includes('getRegisteredAccounts()'), 'Reads from registered accounts store');
});
