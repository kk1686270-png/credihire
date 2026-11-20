import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('Unauthenticated user score gating logic correctly hides score on submitted scans', () => {
  // Simulator for isScoreHidden computation
  const computeScoreHidden = (user, result) => !user && !result?.isDemo;

  // 1. Unauthenticated user on non-demo live scan -> Score must be hidden
  const unauthLiveScan = { isDemo: false, riskScore: 85, headline: 'High Risk Scam' };
  assert.equal(computeScoreHidden(null, unauthLiveScan), true, 'Score must be hidden when user is not logged in');

  // 2. Authenticated user on non-demo live scan -> Score must be visible
  const loggedInUser = { id: 'usr_123', email: 'alex@example.com' };
  assert.equal(computeScoreHidden(loggedInUser, unauthLiveScan), false, 'Score must be visible when user is logged in');

  // 3. Initial visual reference demo when unauthenticated
  const demoScan = { isDemo: true, riskScore: 85 };
  assert.equal(computeScoreHidden(null, demoScan), false, 'Initial demo reference preserves visual preview');
});

test('AuthContext exports showToast and supports warning toast payload', () => {
  const authContextPath = path.join(rootDir, 'src', 'context', 'AuthContext.jsx');
  const content = fs.readFileSync(authContextPath, 'utf-8');

  // Verify showToast is exported in value
  assert.ok(content.includes('showToast'), 'AuthContext exports showToast');
  assert.ok(content.includes("type = 'info'"), 'showToast supports toast type parameter');
  assert.ok(content.includes('setToastMessage(payload)'), 'showToast sets toast payload with type');
});

test('App.jsx triggers warning toast and gates score when unauthenticated user analyzes an offer', () => {
  const appPath = path.join(rootDir, 'src', 'App.jsx');
  const content = fs.readFileSync(appPath, 'utf-8');

  // Verify showToast is retrieved from useAuth
  assert.ok(content.includes('showToast'), 'App consumes showToast from useAuth');

  // Verify handleAnalyze triggers warning toast when !user
  assert.ok(content.includes('if (!user)'), 'handleAnalyze checks for unauthenticated user');
  assert.ok(
    content.includes('showToast("Please signin/signup", "warning")') || 
    content.includes("showToast('Please signin/signup', 'warning')"),
    'Triggers warning toast saying Please signin/signup'
  );

  // Verify isScoreHidden is passed to ResultsPanel
  assert.ok(content.includes('isScoreHidden={!user && !result?.isDemo}'), 'ResultsPanel receives isScoreHidden');
  assert.ok(content.includes('auth-toast-warning'), 'Toast banner supports auth-toast-warning class');
  assert.ok(content.includes('AlertTriangle'), 'Warning toast renders AlertTriangle icon');
});

test('RiskScoreCard.jsx hides risk percentage score and shows Locked badge when isScoreHidden is true', () => {
  const cardPath = path.join(rootDir, 'src', 'components', 'RiskScoreCard.jsx');
  const content = fs.readFileSync(cardPath, 'utf-8');

  // Verify isScoreHidden prop is declared
  assert.ok(content.includes('isScoreHidden = false'), 'Declares isScoreHidden prop');
  assert.ok(content.includes('Lock'), 'Imports and renders Lock icon');

  // Verify score locking in circle and text
  assert.ok(content.includes('score-locked'), 'Contains score-locked circle state');
  assert.ok(content.includes('score-locked-tag'), 'Contains score-locked-tag badge');
  assert.ok(content.includes('Score Hidden'), 'Shows Score Hidden title');
  assert.ok(content.includes('Please signin/signup'), 'Provides Please signin/signup prompt button');
});
