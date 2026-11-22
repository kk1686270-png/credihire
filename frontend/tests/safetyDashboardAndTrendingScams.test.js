import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { calculateEstimatedMoneySaved } from '../src/utils/dashboardStats.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('calculateEstimatedMoneySaved sums detected fees and defaults accurately for scams', () => {
  // Empty history
  assert.strictEqual(calculateEstimatedMoneySaved([]), 0);

  // Safe / Low risk scan should not count as saved fraud money
  const safeHistory = [
    { id: '1', riskLevel: 'low', text: 'Official offer letter from Google with no fees' }
  ];
  assert.strictEqual(calculateEstimatedMoneySaved(safeHistory), 0);

  // Scam with explicit fee amount ("Pay 2000 registration fee")
  const explicitFeeHistory = [
    { id: '2', riskLevel: 'high', text: 'Pay 2000 registration fee to confirm slot' }
  ];
  assert.strictEqual(calculateEstimatedMoneySaved(explicitFeeHistory), 2000);

  // Scam with INR format ("deposit INR 5,000")
  const inrHistory = [
    { id: '3', riskLevel: 'high', text: 'Refundable security deposit INR 5,000 via UPI' }
  ];
  assert.strictEqual(calculateEstimatedMoneySaved(inrHistory), 5000);

  // Scam without explicit amount defaults to realistic average (3500)
  const defaultHistory = [
    { id: '4', riskLevel: 'high', text: 'Kindly transfer verification charge before joining' }
  ];
  assert.strictEqual(calculateEstimatedMoneySaved(defaultHistory), 3500);

  // Combined multiple scans
  const mixedHistory = [
    { id: 'a', riskLevel: 'low', text: 'Normal corporate letter' },
    { id: 'b', riskLevel: 'high', text: 'Pay 2000 registration fee' },
    { id: 'c', riskLevel: 'medium', text: 'Uniform clearance fee of 2,450' }
  ];
  assert.strictEqual(calculateEstimatedMoneySaved(mixedHistory), 4450);
});

test('TrendingScamsFeed component exists and contains required scam intelligence', () => {
  const filePath = path.join(rootDir, 'src', 'components', 'TrendingScamsFeed.jsx');
  const content = fs.readFileSync(filePath, 'utf-8');

  assert.ok(content.includes('Trending Job Scams in India'), 'Renders Trending Job Scams in India header');
  assert.ok(content.includes('LIVE SCAM RADAR'), 'Includes LIVE SCAM RADAR badge');
  assert.ok(content.includes('Telegram YouTube "Like & Earn"'), 'Includes Telegram like and earn scam');
  assert.ok(content.includes('Indigo Airlines / Airport Ground Staff'), 'Includes Indigo airport scam');
  assert.ok(content.includes('Work From Home Notepad / Excel Data Entry'), 'Includes WFH data entry scam');
  assert.ok(content.includes('HR Recruiter Impersonation & APK'), 'Includes HR APK malware scam');
  assert.ok(content.includes('Test in Analyzer'), 'Provides 1-click Test in Analyzer button');
  assert.ok(content.includes('Report a Scam You Encountered'), 'Includes community report action');
});

test('App.jsx renders TrendingScamsFeed and links from Navbar', () => {
  const appPath = path.join(rootDir, 'src', 'App.jsx');
  const appContent = fs.readFileSync(appPath, 'utf-8');
  assert.ok(appContent.includes('TrendingScamsFeed'), 'App imports TrendingScamsFeed');
  assert.ok(appContent.includes('<TrendingScamsFeed'), 'App renders TrendingScamsFeed component');
  assert.ok(appContent.includes('handleTestScamText'), 'App connects handleTestScamText handler');

  const navPath = path.join(rootDir, 'src', 'components', 'Navbar.jsx');
  const navContent = fs.readFileSync(navPath, 'utf-8');
  assert.ok(navContent.includes('trending-scams-radar'), 'Navbar links to #trending-scams-radar');
  assert.ok(navContent.includes('Trending Scams'), 'Navbar displays Trending Scams');
});
