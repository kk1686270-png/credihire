import assert from 'node:assert/strict';
import test from 'node:test';

import { detectHomoglyphs } from '../src/utils/homoglyphDetector.js';
import { scanPii, redactPii } from '../src/utils/piiRedactor.js';

test('detectHomoglyphs returns safe for clean ASCII corporate domain', () => {
  const result = detectHomoglyphs('https://careers.google.com');
  assert.equal(result.isHomoglyph, false);
  assert.equal(result.detectedCount, 0);
  assert.equal(result.spoofedTarget, null);
});

test('detectHomoglyphs flags lookalike Cyrillic character spoofing TCS', () => {
  // 'с' is Cyrillic U+0441
  const spoofedDomain = 't\u0441s.com';
  const result = detectHomoglyphs(spoofedDomain);
  assert.equal(result.isHomoglyph, true);
  assert.equal(result.detectedCount, 1);
  assert.equal(result.normalizedDomain, 'tcs.com');
  assert.equal(result.spoofedTarget, 'tcs.com');
  assert.ok(result.warning.includes('Visual Deception Alert'));
});

test('detectHomoglyphs flags punycode domains', () => {
  const result = detectHomoglyphs('https://xn--ts-fmc.com/careers');
  assert.equal(result.isHomoglyph, true);
  assert.equal(result.isPunycode, true);
});

test('scanPii and redactPii identify and mask Aadhaar numbers', () => {
  const text = 'Candidate registration Aadhaar: 2345 6789 0123 for background check';
  const scan = scanPii(text);
  assert.equal(scan.hasPii, true);
  assert.equal(scan.types.includes('Aadhaar'), true);

  const redacted = redactPii(text);
  assert.equal(redacted.redactionsCount, 1);
  assert.ok(!redacted.redactedText.includes('2345 6789 0123'));
  assert.ok(redacted.redactedText.includes('[AADHAAR_MASKED_XXXX_0123]'));
});

test('scanPii and redactPii identify and mask PAN Card', () => {
  const text = 'Identity verification PAN number ABCDE1234F provided';
  const scan = scanPii(text);
  assert.equal(scan.hasPii, true);
  assert.equal(scan.types.includes('PAN'), true);

  const redacted = redactPii(text);
  assert.equal(redacted.redactionsCount, 1);
  assert.ok(!redacted.redactedText.includes('ABCDE1234F'));
  assert.ok(redacted.redactedText.includes('[PAN_MASKED_ABXX4F]'));
});

test('scanPii and redactPii mask Bank Accounts', () => {
  const text = 'Please verify Account 987654321098 for salary disbursement';
  const scan = scanPii(text);
  assert.equal(scan.hasPii, true);
  assert.equal(scan.types.includes('Bank Account'), true);

  const redacted = redactPii(text);
  assert.ok(!redacted.redactedText.includes('987654321098'));
  assert.ok(redacted.redactedText.includes('[BANK_AC_MASKED_XXXX_1098]'));
});

test('scanPii returns clean for text without sensitive PII', () => {
  const text = 'Looking for senior software engineer with 5 years of React experience';
  const scan = scanPii(text);
  assert.equal(scan.hasPii, false);
  assert.equal(scan.count, 0);
  assert.equal(scan.types.length, 0);

  const redacted = redactPii(text);
  assert.equal(redacted.redactedText, text);
  assert.equal(redacted.redactionsCount, 0);
});
