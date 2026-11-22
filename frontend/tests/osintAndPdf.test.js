import assert from 'node:assert/strict';
import test from 'node:test';

import { generateLocalScamAdvice } from '../src/utils/localScamAdvisor.js';
import {
  analyzeDomainIntel,
  analyzeUpiIntel,
  analyzeForwardedMessage,
  analyzeEmailHeader,
  analyzeDocumentMetadata,
  analyzeQrTrap,
  analyzeCompanyCin
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

test('analyzeEmailHeader sends POST request to /osint/email-header', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });

  let calledUrl;
  let requestBody;
  globalThis.fetch = async (url, options) => {
    calledUrl = url;
    requestBody = JSON.parse(options.body);
    return new Response(JSON.stringify({
      sender: 'careers@tcs-portal.online',
      from_header: 'TCS Careers <careers@tcs-portal.online>',
      return_path: 'scam@dark.ru',
      originating_ip: '185.220.101.5',
      spf_status: 'softfail',
      dkim_status: 'fail',
      dmarc_status: 'fail',
      envelope_mismatch: true,
      risk_score: 95,
      risk_level: 'critical',
      verdict: 'High likelihood of spoofed email sender',
      indicators: []
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const rawHeader = 'From: TCS <careers@tcs-portal.online>\nReturn-Path: scam@dark.ru';
  const res = await analyzeEmailHeader(rawHeader, apiBase);
  assert.equal(calledUrl, `${apiBase}/osint/email-header`);
  assert.equal(requestBody.raw_header, rawHeader);
  assert.equal(res.envelope_mismatch, true);
  assert.equal(res.risk_score, 95);
});

test('analyzeDocumentMetadata sends POST request to /osint/document-metadata', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });

  let calledUrl;
  let requestBody;
  globalThis.fetch = async (url, options) => {
    calledUrl = url;
    requestBody = JSON.parse(options.body);
    return new Response(JSON.stringify({
      file_name: 'Tata_Letter.canva.pdf',
      detected_software: 'Canva',
      created_with_canva: true,
      created_with_photoshop: false,
      has_digital_signature: false,
      suspicious_clauses: ['Deposit 4500 security deposit'],
      risk_score: 85,
      risk_level: 'critical',
      verdict: 'Suspicious offer letter generated in graphic design tool',
      indicators: []
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const res = await analyzeDocumentMetadata({ fileName: 'Tata_Letter.canva.pdf', textContent: 'Deposit 4500 security deposit' }, apiBase);
  assert.equal(calledUrl, `${apiBase}/osint/document-metadata`);
  assert.equal(requestBody.file_name, 'Tata_Letter.canva.pdf');
  assert.equal(res.created_with_canva, true);
  assert.equal(res.has_digital_signature, false);
});

test('analyzeQrTrap sends POST request to /osint/qr-trap', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });

  let calledUrl;
  let requestBody;
  globalThis.fetch = async (url, options) => {
    calledUrl = url;
    requestBody = JSON.parse(options.body);
    return new Response(JSON.stringify({
      raw_payload: 'upi://pay?pa=hr@okhdfcbank&am=3000',
      target_vpa: 'hr@okhdfcbank',
      payee_name: 'Recruiter',
      demanded_amount: '3000',
      is_reverse_payment_trap: true,
      risk_score: 95,
      risk_level: 'critical',
      verdict: 'CRITICAL: Reverse payment debit trap detected',
      indicators: []
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const res = await analyzeQrTrap('upi://pay?pa=hr@okhdfcbank&am=3000', 'Scan to receive bonus', apiBase);
  assert.equal(calledUrl, `${apiBase}/osint/qr-trap`);
  assert.equal(requestBody.qr_payload_or_uri, 'upi://pay?pa=hr@okhdfcbank&am=3000');
  assert.equal(res.is_reverse_payment_trap, true);
  assert.equal(res.demanded_amount, '3000');
});

test('analyzeCompanyCin sends POST request to /osint/company-cin', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });

  let calledUrl;
  let requestBody;
  globalThis.fetch = async (url, options) => {
    calledUrl = url;
    requestBody = JSON.parse(options.body);
    return new Response(JSON.stringify({
      query: 'L85110KA1981PLC013115',
      is_cin: true,
      is_gstin: false,
      is_valid_format: true,
      state_code: 'KA',
      state_name: 'Karnataka',
      incorporation_year: 1981,
      entity_class: 'Public Limited Company (PLC)',
      risk_score: 5,
      risk_level: 'safe',
      verdict: 'Valid 21-digit Indian Corporate Identity Number (CIN)',
      indicators: []
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const res = await analyzeCompanyCin('L85110KA1981PLC013115', '', apiBase);
  assert.equal(calledUrl, `${apiBase}/osint/company-cin`);
  assert.equal(requestBody.cin_or_gstin, 'L85110KA1981PLC013115');
  assert.equal(res.is_valid_format, true);
  assert.equal(res.state_name, 'Karnataka');
});
