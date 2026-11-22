import assert from 'node:assert/strict';
import test from 'node:test';

import { generateLocalScamAdvice } from '../src/utils/localScamAdvisor.js';
import {
  analyzeDomainIntel,
  analyzeUpiIntel,
  analyzeForwardedMessage
} from '../src/services/osintService.js';

const apiBase = 'http://127.0.0.1:8000/api/v1';

test('generateLocalScamAdvice returns fee warning when fees or deposits mentioned', () => {
  const result = generateLocalScamAdvice('Pay 2000 rupees security deposit for employee card');
  assert.ok(result.reply.includes('RED FLAG WARNING'));
  assert.ok(result.reply.includes('1930'));
  assert.ok(result.disclaimer.includes('Offline Active Protection'));
});

test('generateLocalScamAdvice returns Telegram task fraud guidance when task/like mentioned', () => {
  const result = generateLocalScamAdvice('Earn 3000 daily liking YouTube videos on Telegram');
  assert.ok(result.reply.includes('Telegram / WhatsApp "Like & Earn" Task Fraud'));
  assert.ok(result.reply.includes('VIP High Commission Tasks'));
});

test('generateLocalScamAdvice returns cybercrime reporting procedure when 1930/police queried', () => {
  const result = generateLocalScamAdvice('How can I file cybercrime complaint or report scam?');
  assert.ok(result.reply.includes('1930'));
  assert.ok(result.reply.includes('cybercrime.gov.in'));
});

test('analyzeDomainIntel sends POST request to /osint/domain', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });

  let calledUrl;
  let requestBody;
  globalThis.fetch = async (url, options) => {
    calledUrl = url;
    requestBody = JSON.parse(options.body);
    return new Response(JSON.stringify({
      domain: 'fake-tcs-portal.in',
      clean_url: 'https://fake-tcs-portal.in',
      risk_score: 90,
      risk_level: 'critical',
      dns_resolvable: true,
      is_free_mail_provider: false,
      impersonation_target: 'TCS',
      indicators: [],
      recommendations: [],
      summary: 'Fake TCS portal'
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const res = await analyzeDomainIntel('fake-tcs-portal.in', apiBase);
  assert.equal(calledUrl, `${apiBase}/osint/domain`);
  assert.equal(requestBody.domain_or_url, 'fake-tcs-portal.in');
  assert.equal(res.impersonation_target, 'TCS');
});

test('analyzeUpiIntel sends POST request to /osint/upi', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });

  let calledUrl;
  let requestBody;
  globalThis.fetch = async (url, options) => {
    calledUrl = url;
    requestBody = JSON.parse(options.body);
    return new Response(JSON.stringify({
      upi_id: 'hr@ybl',
      psp_bank: 'PhonePe',
      is_personal_psp: true,
      risk_score: 85,
      risk_level: 'critical',
      flags: [],
      recommendations: [],
      summary: 'Personal VPA'
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const res = await analyzeUpiIntel('hr@ybl', 'Deposit ₹2,000', apiBase);
  assert.equal(calledUrl, `${apiBase}/osint/upi`);
  assert.equal(requestBody.upi_id_or_uri, 'hr@ybl');
  assert.equal(res.is_personal_psp, true);
});

test('analyzeForwardedMessage sends POST request to /osint/forwarded-message', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });

  let calledUrl;
  let requestBody;
  globalThis.fetch = async (url, options) => {
    calledUrl = url;
    requestBody = JSON.parse(options.body);
    return new Response(JSON.stringify({
      is_forwarded: true,
      detected_platform: 'WhatsApp',
      suspicious_phone_numbers: ['+2341234567'],
      telegram_links: [],
      external_links: [],
      risk_score: 95,
      risk_level: 'critical',
      indicators: [],
      clean_message: 'Clean text',
      summary: 'WhatsApp scam'
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const res = await analyzeForwardedMessage('Forwarded: Daily earn 5000', apiBase);
  assert.equal(calledUrl, `${apiBase}/osint/forwarded-message`);
  assert.equal(res.is_forwarded, true);
  assert.equal(res.detected_platform, 'WhatsApp');
});
