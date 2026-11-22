import React, { useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  Building,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Globe,
  Loader2,
  Mail,
  MessageSquare,
  QrCode,
  Search,
  Shield,
  ShieldAlert,
  Smartphone,
  Sparkles,
  FileText,
  CreditCard
} from 'lucide-react';
import {
  analyzeCompanyCin,
  analyzeDocumentMetadata,
  analyzeDomainIntel,
  analyzeEmailHeader,
  analyzeForwardedMessage,
  analyzeQrTrap,
  analyzeUpiIntel,
  downloadEvidenceDossierPdf
} from '../services/osintService.js';

export function OsintHub({ onPopulateAnalyzer }) {
  const [activeTab, setActiveTab] = useState('domain'); // domain | upi | forward

  // Domain State
  const [domainInput, setDomainInput] = useState('');
  const [domainLoading, setDomainLoading] = useState(false);
  const [domainResult, setDomainResult] = useState(null);
  const [domainError, setDomainError] = useState('');

  // UPI State
  const [upiInput, setUpiInput] = useState('');
  const [upiContext, setUpiContext] = useState('');
  const [upiLoading, setUpiLoading] = useState(false);
  const [upiResult, setUpiResult] = useState(null);
  const [upiError, setUpiError] = useState('');

  // Forward State
  const [forwardInput, setForwardInput] = useState('');
  const [forwardLoading, setForwardLoading] = useState(false);
  const [forwardResult, setForwardResult] = useState(null);
  const [forwardError, setForwardError] = useState('');

  // Email Header State
  const [emailInput, setEmailInput] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailResult, setEmailResult] = useState(null);
  const [emailError, setEmailError] = useState('');

  // Document Metadata State
  const [docFileName, setDocFileName] = useState('');
  const [docContent, setDocContent] = useState('');
  const [docLoading, setDocLoading] = useState(false);
  const [docResult, setDocResult] = useState(null);
  const [docError, setDocError] = useState('');

  // QR Trap State
  const [qrInput, setQrInput] = useState('');
  const [qrContext, setQrContext] = useState('');
  const [qrLoading, setQrLoading] = useState(false);
  const [qrResult, setQrResult] = useState(null);
  const [qrError, setQrError] = useState('');

  // CIN / GSTIN State
  const [cinInput, setCinInput] = useState('');
  const [cinLoading, setCinLoading] = useState(false);
  const [cinResult, setCinResult] = useState(null);
  const [cinError, setCinError] = useState('');

  // PDF Export State
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  // Quick Preset Handlers
  const handleDomainPreset = (val) => {
    setDomainInput(val);
    runDomainScan(val);
  };

  const handleUpiPreset = (vpa, ctx) => {
    setUpiInput(vpa);
    setUpiContext(ctx);
    runUpiScan(vpa, ctx);
  };

  const handleForwardPreset = (text) => {
    setForwardInput(text);
    runForwardScan(text);
  };

  const handleEmailPreset = (val) => {
    setEmailInput(val);
    runEmailScan(val);
  };

  const handleDocPreset = (name, text) => {
    setDocFileName(name);
    setDocContent(text);
    runDocScan(name, text);
  };

  const handleQrPreset = (uri, ctx) => {
    setQrInput(uri);
    setQrContext(ctx);
    runQrScan(uri, ctx);
  };

  const handleCinPreset = (val) => {
    setCinInput(val);
    runCinScan(val);
  };

  // Run Scans
  const runDomainScan = async (target) => {
    const query = (target || domainInput).trim();
    if (!query) {
      setDomainError('Please enter a domain or recruitment URL');
      return;
    }
    setDomainError('');
    setDomainLoading(true);
    try {
      const res = await analyzeDomainIntel(query);
      setDomainResult(res);
    } catch (err) {
      setDomainError(err.message || 'Domain check failed');
    } finally {
      setDomainLoading(false);
    }
  };

  const runUpiScan = async (vpa, ctx) => {
    const targetVpa = (vpa || upiInput).trim();
    if (!targetVpa) {
      setUpiError('Please enter a UPI VPA or upi:// URI');
      return;
    }
    setUpiError('');
    setUpiLoading(true);
    try {
      const res = await analyzeUpiIntel(targetVpa, ctx !== undefined ? ctx : upiContext);
      setUpiResult(res);
    } catch (err) {
      setUpiError(err.message || 'UPI check failed');
    } finally {
      setUpiLoading(false);
    }
  };

  const runForwardScan = async (text) => {
    const raw = (text || forwardInput).trim();
    if (!raw) {
      setForwardError('Please paste a forwarded message');
      return;
    }
    setForwardError('');
    setForwardLoading(true);
    try {
      const res = await analyzeForwardedMessage(raw);
      setForwardResult(res);
    } catch (err) {
      setForwardError(err.message || 'Forward message check failed');
    } finally {
      setForwardLoading(false);
    }
  };

  const runEmailScan = async (header) => {
    const raw = (header || emailInput).trim();
    if (!raw) {
      setEmailError('Please paste raw email headers');
      return;
    }
    setEmailError('');
    setEmailLoading(true);
    try {
      const res = await analyzeEmailHeader(raw);
      setEmailResult(res);
    } catch (err) {
      setEmailError(err.message || 'Email header check failed');
    } finally {
      setEmailLoading(false);
    }
  };

  const runDocScan = async (name, text) => {
    const targetName = (name || docFileName).trim();
    if (!targetName) {
      setDocError('Please provide a file name');
      return;
    }
    setDocError('');
    setDocLoading(true);
    try {
      const res = await analyzeDocumentMetadata({
        fileName: targetName,
        textContent: text !== undefined ? text : docContent,
      });
      setDocResult(res);
    } catch (err) {
      setDocError(err.message || 'Document metadata check failed');
    } finally {
      setDocLoading(false);
    }
  };

  const runQrScan = async (uri, ctx) => {
    const targetUri = (uri || qrInput).trim();
    if (!targetUri) {
      setQrError('Please enter QR UPI payload');
      return;
    }
    setQrError('');
    setQrLoading(true);
    try {
      const res = await analyzeQrTrap(targetUri, ctx !== undefined ? ctx : qrContext);
      setQrResult(res);
    } catch (err) {
      setQrError(err.message || 'QR trap scan failed');
    } finally {
      setQrLoading(false);
    }
  };

  const runCinScan = async (val) => {
    const query = (val || cinInput).trim();
    if (!query) {
      setCinError('Please enter 21-digit CIN or 15-digit GSTIN');
      return;
    }
    setCinError('');
    setCinLoading(true);
    try {
      const res = await analyzeCompanyCin(query);
      setCinResult(res);
    } catch (err) {
      setCinError(err.message || 'CIN verification failed');
    } finally {
      setCinLoading(false);
    }
  };

  const handleExportPdf = async (title, score, level, text, fee, vpa) => {
    setIsDownloadingPdf(true);
    try {
      await downloadEvidenceDossierPdf({
        scan_title: title,
        risk_score: score,
        risk_level: level,
        job_text: text,
        demanded_amount: fee,
        payment_handle: vpa,
        indicators: [
          'Advance payment demanded before recruitment',
          'Retail personal payment handle used instead of corporate merchant',
          'Unverified recruitment channel'
        ]
      });
    } catch (err) {
      alert(`Could not download PDF: ${err.message}`);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return (
    <section className="credihire-osint-hub mt-5 mb-5" id="osint-hub" aria-label="Cyber Forensics and OSINT Tools">
      <div className="section-header d-flex flex-column align-items-center text-center mb-4">
        <div className="d-flex align-items-center gap-2 mb-2">
          <span className="badge bg-danger bg-opacity-25 text-danger px-3 py-1 border border-danger border-opacity-30 rounded-pill d-inline-flex align-items-center gap-2">
            <span className="status-dot live"></span>
            CYBER FORENSICS &amp; OSINT RADAR
          </span>
        </div>
        <h2 className="fw-bold fs-3 text-white">Multi-Vector Fraud Investigation Suite</h2>
        <p className="text-white-50" style={{ maxWidth: '650px', fontSize: '0.9rem' }}>
          Real-time open source intelligence (OSINT) tools engineered to uncover brand impersonators, domain registration ages, personal UPI traps, and viral WhatsApp/Telegram task rackets.
        </p>
      </div>

      {/* Tabs */}
      <div className="osint-tabs d-flex flex-wrap justify-content-center gap-2 mb-4">
        <button
          type="button"
          className={`osint-tab-btn ${activeTab === 'domain' ? 'active' : ''}`}
          onClick={() => setActiveTab('domain')}
        >
          <Globe size={16} /> Domain &amp; WHOIS Age
        </button>
        <button
          type="button"
          className={`osint-tab-btn ${activeTab === 'upi' ? 'active' : ''}`}
          onClick={() => setActiveTab('upi')}
        >
          <CreditCard size={16} /> UPI &amp; Payment Inspector
        </button>
        <button
          type="button"
          className={`osint-tab-btn ${activeTab === 'forward' ? 'active' : ''}`}
          onClick={() => setActiveTab('forward')}
        >
          <Smartphone size={16} /> WhatsApp / Telegram Forward
        </button>
        <button
          type="button"
          className={`osint-tab-btn ${activeTab === 'email' ? 'active' : ''}`}
          onClick={() => setActiveTab('email')}
        >
          <Mail size={16} /> Email Header Spoofing
        </button>
        <button
          type="button"
          className={`osint-tab-btn ${activeTab === 'document' ? 'active' : ''}`}
          onClick={() => setActiveTab('document')}
        >
          <FileText size={16} /> Offer Letter Forensic
        </button>
        <button
          type="button"
          className={`osint-tab-btn ${activeTab === 'qrtrap' ? 'active' : ''}`}
          onClick={() => setActiveTab('qrtrap')}
        >
          <QrCode size={16} /> QR Debit Trap
        </button>
        <button
          type="button"
          className={`osint-tab-btn ${activeTab === 'cin' ? 'active' : ''}`}
          onClick={() => setActiveTab('cin')}
        >
          <Building size={16} /> MCA CIN &amp; GSTIN
        </button>
      </div>

      <div className="osint-card-container p-4 rounded-4 border border-white-10" style={{ background: '#0b1329' }}>
        {/* TAB 1: DOMAIN INTELLIGENCE */}
        {activeTab === 'domain' && (
          <div>
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
              <div>
                <h3 className="fs-5 fw-bold text-white mb-1 d-flex align-items-center gap-2">
                  <Globe size={18} className="text-info" /> Recruiter Domain &amp; WHOIS Age Analysis
                </h3>
                <p className="text-white-50 mb-0" style={{ fontSize: '0.82rem' }}>
                  Verifies registration age, authoritative DNS, and checks corporate impersonation whitelists.
                </p>
              </div>
              <div className="d-flex gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary text-white-50"
                  style={{ fontSize: '0.75rem' }}
                  onClick={() => handleDomainPreset('tcs-careers-recruitment-portal.online')}
                >
                  ⚡ Preset: Fake TCS Domain
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary text-white-50"
                  style={{ fontSize: '0.75rem' }}
                  onClick={() => handleDomainPreset('tcs.com')}
                >
                  ✔ Preset: Official TCS
                </button>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                runDomainScan();
              }}
              className="d-flex gap-2 mb-3"
            >
              <div className="position-relative flex-grow-1">
                <Search size={16} className="position-absolute top-50 start-0 translate-middle-y ms-3 text-white-50" />
                <input
                  type="text"
                  className="form-control ps-5 py-2 bg-dark text-white border-white-15 rounded-3"
                  placeholder="e.g. tcs-recruitment-portal.in or apply-indigo-careers.com"
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary px-4 d-flex align-items-center gap-2"
                disabled={domainLoading || !domainInput.trim()}
              >
                {domainLoading ? <Loader2 size={16} className="spin" /> : <Globe size={16} />}
                Investigate Domain
              </button>
            </form>

            {domainError && <div className="alert alert-danger py-2" role="alert">{domainError}</div>}

            {domainResult && (
              <div className="osint-result-box p-3 rounded-3 border border-white-10 mt-3 bg-black bg-opacity-25">
                <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3 pb-3 border-bottom border-white-10">
                  <div>
                    <span className="text-white-50 text-uppercase" style={{ fontSize: '0.7rem' }}>TARGET DOMAIN</span>
                    <h4 className="fs-5 text-white mb-0">{domainResult.domain}</h4>
                  </div>
                  <div className="d-flex align-items-center gap-3">
                    <div className="text-end">
                      <span className="text-white-50" style={{ fontSize: '0.7rem' }}>THREAT LEVEL</span>
                      <div className={`fw-bold text-uppercase ${domainResult.risk_level === 'critical' || domainResult.risk_level === 'high' ? 'text-danger' : domainResult.risk_level === 'medium' ? 'text-warning' : 'text-success'}`}>
                        {domainResult.risk_level} ({domainResult.risk_score}/100)
                      </div>
                    </div>
                  </div>
                </div>

                <div className="row g-3 mb-3">
                  <div className="col-12 col-md-4">
                    <div className="p-2 rounded bg-dark border border-white-10">
                      <span className="text-white-50 d-block" style={{ fontSize: '0.7rem' }}>DOMAIN AGE</span>
                      <strong className="text-white">
                        {domainResult.domain_age_days != null ? `${domainResult.domain_age_days} Days` : 'Undisclosed / Fresh'}
                      </strong>
                    </div>
                  </div>
                  <div className="col-12 col-md-4">
                    <div className="p-2 rounded bg-dark border border-white-10">
                      <span className="text-white-50 d-block" style={{ fontSize: '0.7rem' }}>DNS RESOLUTION</span>
                      <strong className={domainResult.dns_resolvable ? 'text-success' : 'text-danger'}>
                        {domainResult.dns_resolvable ? '✔ Active Public DNS' : '✖ Unresolvable / Taken Down'}
                      </strong>
                    </div>
                  </div>
                  <div className="col-12 col-md-4">
                    <div className="p-2 rounded bg-dark border border-white-10">
                      <span className="text-white-50 d-block" style={{ fontSize: '0.7rem' }}>IMPERSONATION CHECK</span>
                      <strong className={domainResult.impersonation_target ? 'text-danger' : 'text-success'}>
                        {domainResult.impersonation_target ? `Impersonates ${domainResult.impersonation_target}` : 'No Trademark Conflict'}
                      </strong>
                    </div>
                  </div>
                </div>

                {domainResult.indicators.length > 0 && (
                  <div className="mb-3">
                    <strong className="text-white-50 d-block mb-1" style={{ fontSize: '0.75rem' }}>FORENSIC INDICATORS</strong>
                    <ul className="mb-0 ps-3 text-white" style={{ fontSize: '0.82rem' }}>
                      {domainResult.indicators.map((ind, idx) => (
                        <li key={idx} className="mb-1">{ind.message}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="p-2 rounded bg-info bg-opacity-10 border border-info border-opacity-20 text-info" style={{ fontSize: '0.82rem' }}>
                  <strong>Advisory:</strong> {domainResult.recommendations?.[0]}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: UPI PAYMENT INSPECTOR */}
        {activeTab === 'upi' && (
          <div>
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
              <div>
                <h3 className="fs-5 fw-bold text-white mb-1 d-flex align-items-center gap-2">
                  <QrCode size={18} className="text-warning" /> UPI &amp; Recruiter Payment Threat Scanner
                </h3>
                <p className="text-white-50 mb-0" style={{ fontSize: '0.82rem' }}>
                  Detects personal retail consumer handles (@okhdfcbank, @ybl, @paytm) posing as corporate HR accounts.
                </p>
              </div>
              <div className="d-flex gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary text-white-50"
                  style={{ fontSize: '0.75rem' }}
                  onClick={() => handleUpiPreset('tcs-careers@okhdfcbank', 'Pay ₹2,000 security deposit for employee ID card and laptop')}
                >
                  ⚡ Preset: Fake TCS VPA
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary text-white-50"
                  style={{ fontSize: '0.75rem' }}
                  onClick={() => handleUpiPreset('indigo.gatepass@ybl', 'Deposit ₹1,500 for airport security clearance')}
                >
                  ⚡ Preset: Indigo Gate Pass
                </button>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                runUpiScan();
              }}
              className="mb-3"
            >
              <div className="row g-2">
                <div className="col-12 col-md-6">
                  <input
                    type="text"
                    className="form-control py-2 bg-dark text-white border-white-15 rounded-3"
                    placeholder="e.g. tcs-hr@okhdfcbank or upi://pay?pa=..."
                    value={upiInput}
                    onChange={(e) => setUpiInput(e.target.value)}
                  />
                </div>
                <div className="col-12 col-md-4">
                  <input
                    type="text"
                    className="form-control py-2 bg-dark text-white border-white-15 rounded-3"
                    placeholder="Context: e.g. Demanded ₹2,500 deposit"
                    value={upiContext}
                    onChange={(e) => setUpiContext(e.target.value)}
                  />
                </div>
                <div className="col-12 col-md-2">
                  <button
                    type="submit"
                    className="btn btn-warning w-100 py-2 d-flex align-items-center justify-content-center gap-2 fw-semibold text-dark"
                    disabled={upiLoading || !upiInput.trim()}
                  >
                    {upiLoading ? <Loader2 size={16} className="spin" /> : <QrCode size={16} />}
                    Scan UPI
                  </button>
                </div>
              </div>
            </form>

            {upiError && <div className="alert alert-danger py-2" role="alert">{upiError}</div>}

            {upiResult && (
              <div className="osint-result-box p-3 rounded-3 border border-white-10 mt-3 bg-black bg-opacity-25">
                <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3 pb-3 border-bottom border-white-10">
                  <div>
                    <span className="text-white-50 text-uppercase" style={{ fontSize: '0.7rem' }}>TARGET VPA / UPI ID</span>
                    <h4 className="fs-5 text-white mb-0">{upiResult.upi_id}</h4>
                    <small className="text-warning">{upiResult.psp_bank}</small>
                  </div>
                  <div className="text-end">
                    <span className="text-white-50" style={{ fontSize: '0.7rem' }}>RISK SCORE</span>
                    <div className="fs-5 fw-bold text-danger">{upiResult.risk_score} / 100 ({upiResult.risk_level.toUpperCase()})</div>
                  </div>
                </div>

                {upiResult.flags.length > 0 && (
                  <div className="mb-3">
                    <strong className="text-white-50 d-block mb-1" style={{ fontSize: '0.75rem' }}>RED FLAGS DETECTED</strong>
                    <ul className="mb-0 ps-3 text-white" style={{ fontSize: '0.82rem' }}>
                      {upiResult.flags.map((f, idx) => (
                        <li key={idx} className="mb-1 text-danger-emphasis">{f.message}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="d-flex flex-wrap gap-2 pt-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1"
                    onClick={() => handleExportPdf(
                      `UPI Fraud Dossier: ${upiResult.upi_id}`,
                      upiResult.risk_score,
                      upiResult.risk_level,
                      `Suspect VPA: ${upiResult.upi_id}. ${upiContext || 'Demanded advance recruitment deposit.'}`,
                      upiResult.demanded_amount,
                      upiResult.upi_id
                    )}
                    disabled={isDownloadingPdf}
                  >
                    {isDownloadingPdf ? <Loader2 size={13} className="spin" /> : <Download size={13} />}
                    Download Cybercrime Dossier (PDF)
                  </button>
                  <a
                    href="https://cybercrime.gov.in"
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-sm btn-danger d-inline-flex align-items-center gap-1"
                  >
                    <ShieldAlert size={13} /> Report to 1930 / cybercrime.gov.in <ExternalLink size={11} />
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: WHATSAPP / TELEGRAM FORWARD INSPECTOR */}
        {activeTab === 'forward' && (
          <div>
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
              <div>
                <h3 className="fs-5 fw-bold text-white mb-1 d-flex align-items-center gap-2">
                  <Smartphone size={18} className="text-success" /> WhatsApp &amp; Telegram Message Forensic Scanner
                </h3>
                <p className="text-white-50 mb-0" style={{ fontSize: '0.82rem' }}>
                  Parses forwarded chat logs, international recruiter country codes (+234, +62, +84), and task invites.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary text-white-50"
                style={{ fontSize: '0.75rem' }}
                onClick={() => handleForwardPreset(`Forwarded
[10:30 AM, 11/20/2026] +234 803 123 4567:
Dear candidate, Congratulations! Earn ₹2,500 daily liking YouTube videos.
Deposit ₹1,000 security recharge to activate VIP tasks.
Join our official manager at https://t.me/vip_task_manager`)}
              >
                ⚡ Preset: WhatsApp Task Trap
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                runForwardScan();
              }}
              className="mb-3"
            >
              <textarea
                className="form-control bg-dark text-white border-white-15 rounded-3 mb-2"
                rows={3}
                placeholder="Paste the raw forwarded message from WhatsApp or Telegram here..."
                value={forwardInput}
                onChange={(e) => setForwardInput(e.target.value)}
              />
              <div className="d-flex justify-content-between align-items-center">
                <span className="text-white-50" style={{ fontSize: '0.75rem' }}>
                  Detects: Foreign country codes, mass forward flags, Telegram channels, and fee demands.
                </span>
                <button
                  type="submit"
                  className="btn btn-success px-4 d-flex align-items-center gap-2 fw-semibold"
                  disabled={forwardLoading || !forwardInput.trim()}
                >
                  {forwardLoading ? <Loader2 size={16} className="spin" /> : <Smartphone size={16} />}
                  Scan Forwarded Chat
                </button>
              </div>
            </form>

            {forwardError && <div className="alert alert-danger py-2" role="alert">{forwardError}</div>}

            {forwardResult && (
              <div className="osint-result-box p-3 rounded-3 border border-white-10 mt-3 bg-black bg-opacity-25">
                <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3 pb-3 border-bottom border-white-10">
                  <div>
                    <span className="text-white-50 text-uppercase" style={{ fontSize: '0.7rem' }}>ORIGIN PLATFORM</span>
                    <h4 className="fs-5 text-white mb-0">{forwardResult.detected_platform}</h4>
                    {forwardResult.is_forwarded && <span className="badge bg-warning text-dark mt-1">Mass Forwarded</span>}
                  </div>
                  <div className="text-end">
                    <span className="text-white-50" style={{ fontSize: '0.7rem' }}>RISK SCORE</span>
                    <div className="fs-5 fw-bold text-danger">{forwardResult.risk_score} / 100 ({forwardResult.risk_level.toUpperCase()})</div>
                  </div>
                </div>

                <div className="row g-2 mb-3">
                  {forwardResult.suspicious_phone_numbers.length > 0 && (
                    <div className="col-12 col-md-6">
                      <div className="p-2 rounded bg-dark border border-white-10">
                        <span className="text-white-50 d-block" style={{ fontSize: '0.7rem' }}>SUSPECT NUMBERS</span>
                        <strong className="text-danger">{forwardResult.suspicious_phone_numbers.join(', ')}</strong>
                      </div>
                    </div>
                  )}
                  {forwardResult.demanded_fees && (
                    <div className="col-12 col-md-6">
                      <div className="p-2 rounded bg-dark border border-white-10">
                        <span className="text-white-50 d-block" style={{ fontSize: '0.7rem' }}>DEMANDED FEE</span>
                        <strong className="text-danger">{forwardResult.demanded_fees}</strong>
                      </div>
                    </div>
                  )}
                </div>

                {forwardResult.indicators.length > 0 && (
                  <div className="mb-3">
                    <strong className="text-white-50 d-block mb-1" style={{ fontSize: '0.75rem' }}>EVIDENCE DETECTED</strong>
                    <ul className="mb-0 ps-3 text-white" style={{ fontSize: '0.82rem' }}>
                      {forwardResult.indicators.map((ind, idx) => (
                        <li key={idx} className="mb-1">{ind.message}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="d-flex flex-wrap gap-2 pt-2">
                  {onPopulateAnalyzer && (
                    <button
                      type="button"
                      className="btn btn-sm btn-primary d-inline-flex align-items-center gap-1"
                      onClick={() => onPopulateAnalyzer(forwardResult.clean_message)}
                    >
                      <Sparkles size={13} /> Test Clean Message in Analyzer
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1"
                    onClick={() => handleExportPdf(
                      `WhatsApp Fraud Dossier: ${forwardResult.detected_platform}`,
                      forwardResult.risk_score,
                      forwardResult.risk_level,
                      forwardResult.clean_message,
                      forwardResult.demanded_fees,
                      forwardResult.suspicious_phone_numbers[0] || 'Unknown Number'
                    )}
                    disabled={isDownloadingPdf}
                  >
                    {isDownloadingPdf ? <Loader2 size={13} className="spin" /> : <Download size={13} />}
                    Export Evidence PDF
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: EMAIL HEADER SPOOFING */}
        {activeTab === 'email' && (
          <div>
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
              <div>
                <h3 className="fs-5 fw-bold text-white mb-1 d-flex align-items-center gap-2">
                  <Mail size={18} className="text-info" /> Email Header &amp; SPF/DKIM/DMARC Forensic Analyzer
                </h3>
                <p className="text-white-50 mb-0" style={{ fontSize: '0.82rem' }}>
                  Analyzes RFC 5322 email headers, cryptographic authentication tags, originating IP, and sender envelope mismatches.
                </p>
              </div>
              <div className="d-flex gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary text-white-50"
                  style={{ fontSize: '0.75rem' }}
                  onClick={() => handleEmailPreset(`From: TCS Careers <careers@tcs-recruitment-team.online>\nReturn-Path: spoofed-phish@darknet-mailer.xyz\nReceived: from mail.unknown-vps.com (185.220.101.5)\nReceived-SPF: softfail (tcs.com does not designate 185.220.101.5)\nAuthentication-Results: dkim=fail; dmarc=fail (p=reject)\nSubject: Direct Selection - TCS Digital Specialist Package ₹12 LPA`)}
                >
                  ⚡ Preset: Spoofed TCS Email
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary text-white-50"
                  style={{ fontSize: '0.75rem' }}
                  onClick={() => handleEmailPreset(`From: TCS NextStep <careers@tcs.com>\nReturn-Path: careers@tcs.com\nReceived: from mail.tcs.com (199.19.0.1)\nReceived-SPF: pass (tcs.com designates 199.19.0.1)\nAuthentication-Results: dkim=pass; dmarc=pass\nSubject: TCS NextStep Registration Confirmation`)}
                >
                  ✔ Preset: Legitimate TCS
                </button>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                runEmailScan();
              }}
              className="mb-3"
            >
              <textarea
                className="form-control bg-dark text-white border-white-15 rounded-3 mb-2"
                rows={4}
                placeholder="Paste raw email headers (Received, From, Return-Path, Authentication-Results, Received-SPF)..."
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
              />
              <div className="d-flex justify-content-between align-items-center">
                <span className="text-white-50" style={{ fontSize: '0.75rem' }}>
                  Forensic checks: Return-Path mismatch, SPF/DKIM/DMARC status, and originating IP lookup.
                </span>
                <button
                  type="submit"
                  className="btn btn-info px-4 d-flex align-items-center gap-2 fw-semibold text-dark"
                  disabled={emailLoading || !emailInput.trim()}
                >
                  {emailLoading ? <Loader2 size={16} className="spin" /> : <Mail size={16} />}
                  Analyze Email Headers
                </button>
              </div>
            </form>

            {emailError && <div className="alert alert-danger py-2" role="alert">{emailError}</div>}

            {emailResult && (
              <div className="osint-result-box p-3 rounded-3 border border-white-10 mt-3 bg-black bg-opacity-25">
                <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3 pb-3 border-bottom border-white-10">
                  <div>
                    <span className="text-white-50 text-uppercase" style={{ fontSize: '0.7rem' }}>SENDER / FROM</span>
                    <h4 className="fs-5 text-white mb-0">{emailResult.sender || 'Unknown Sender'}</h4>
                    {emailResult.return_path && (
                      <small className="text-white-50 d-block">Return-Path: {emailResult.return_path}</small>
                    )}
                  </div>
                  <div className="text-end">
                    <span className="text-white-50" style={{ fontSize: '0.7rem' }}>RISK SCORE</span>
                    <div className={`fs-5 fw-bold ${emailResult.risk_level === 'critical' || emailResult.risk_level === 'high' ? 'text-danger' : emailResult.risk_level === 'medium' ? 'text-warning' : 'text-success'}`}>
                      {emailResult.risk_score} / 100 ({emailResult.risk_level.toUpperCase()})
                    </div>
                  </div>
                </div>

                <div className="row g-2 mb-3">
                  <div className="col-6 col-md-3">
                    <div className="p-2 rounded bg-dark border border-white-10">
                      <span className="text-white-50 d-block" style={{ fontSize: '0.7rem' }}>SPF STATUS</span>
                      <strong className={(emailResult.spf_status || '').toLowerCase() === 'pass' ? 'text-success' : 'text-danger'}>
                        {(emailResult.spf_status || 'NONE').toUpperCase()}
                      </strong>
                    </div>
                  </div>
                  <div className="col-6 col-md-3">
                    <div className="p-2 rounded bg-dark border border-white-10">
                      <span className="text-white-50 d-block" style={{ fontSize: '0.7rem' }}>DKIM SIGNATURE</span>
                      <strong className={(emailResult.dkim_status || '').toLowerCase() === 'pass' ? 'text-success' : 'text-danger'}>
                        {(emailResult.dkim_status || 'NONE').toUpperCase()}
                      </strong>
                    </div>
                  </div>
                  <div className="col-6 col-md-3">
                    <div className="p-2 rounded bg-dark border border-white-10">
                      <span className="text-white-50 d-block" style={{ fontSize: '0.7rem' }}>DMARC POLICY</span>
                      <strong className={(emailResult.dmarc_status || '').toLowerCase() === 'pass' ? 'text-success' : 'text-danger'}>
                        {(emailResult.dmarc_status || 'NONE').toUpperCase()}
                      </strong>
                    </div>
                  </div>
                  <div className="col-6 col-md-3">
                    <div className="p-2 rounded bg-dark border border-white-10">
                      <span className="text-white-50 d-block" style={{ fontSize: '0.7rem' }}>ORIGINATING IP</span>
                      <strong className="text-white">
                        {emailResult.originating_ip || 'Internal / Cloud'}
                      </strong>
                    </div>
                  </div>
                </div>

                {(emailResult.is_spoofed || emailResult.envelope_mismatch) && (
                  <div className="alert alert-danger py-2 d-flex align-items-center gap-2 mb-3" role="alert">
                    <AlertOctagon size={16} />
                    <span style={{ fontSize: '0.82rem' }}>
                      <strong>Critical Mismatch Detected:</strong> Return-Path differs from the From header domain. Highly indicative of forged / spoofed email sender.
                    </span>
                  </div>
                )}

                {(emailResult.flags || emailResult.indicators || []).length > 0 && (
                  <div className="mb-3">
                    <strong className="text-white-50 d-block mb-1" style={{ fontSize: '0.75rem' }}>EVIDENCE &amp; AUDIT TRAIL</strong>
                    <ul className="mb-0 ps-3 text-white" style={{ fontSize: '0.82rem' }}>
                      {(emailResult.flags || emailResult.indicators || []).map((ind, idx) => (
                        <li key={idx} className="mb-1">{ind.message}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="d-flex flex-wrap gap-2 pt-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1"
                    onClick={() => handleExportPdf(
                      `Email Header Dossier: ${emailResult.sender}`,
                      emailResult.risk_score,
                      emailResult.risk_level,
                      `From: ${emailResult.from_header || emailResult.sender}. Origin IP: ${emailResult.originating_ip || 'Unknown'}. Verdict: ${emailResult.summary || emailResult.verdict}`,
                      null,
                      emailResult.sender
                    )}
                    disabled={isDownloadingPdf}
                  >
                    {isDownloadingPdf ? <Loader2 size={13} className="spin" /> : <Download size={13} />}
                    Export Evidence PDF
                  </button>
                  <a
                    href="https://cybercrime.gov.in"
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-sm btn-danger d-inline-flex align-items-center gap-1"
                  >
                    <ShieldAlert size={13} /> Report Email Phishing <ExternalLink size={11} />
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: OFFER LETTER & DOCUMENT METADATA */}
        {activeTab === 'document' && (
          <div>
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
              <div>
                <h3 className="fs-5 fw-bold text-white mb-1 d-flex align-items-center gap-2">
                  <FileText size={18} className="text-primary" /> Offer Letter &amp; PDF Metadata Forensic Scanner
                </h3>
                <p className="text-white-50 mb-0" style={{ fontSize: '0.82rem' }}>
                  Detects amateur graphic tools (Canva, Photoshop, GIMP), missing digital PKI signatures, and extortion deposit clauses.
                </p>
              </div>
              <div className="d-flex gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary text-white-50"
                  style={{ fontSize: '0.75rem' }}
                  onClick={() => handleDocPreset(
                    'Tata_Consultancy_Services_Offer_Letter_2026.canva.pdf',
                    'Appointment Letter: Generated on Canva template. Deposit ₹4,500 security deposit for corporate badge and MacBook Pro delivery within 24 hours. Failure to comply will lead to legal breach proceedings under IPC.'
                  )}
                >
                  ⚡ Preset: Canva Fake Offer
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary text-white-50"
                  style={{ fontSize: '0.75rem' }}
                  onClick={() => handleDocPreset(
                    'Infosys_Offer_Letter_DocuSign_Verified.pdf',
                    'Official Appointment Letter by Infosys Ltd. Digitally signed via DocuSign PKI Certificate SHA256. Infosys never charges any recruitment or training fees.'
                  )}
                >
                  ✔ Preset: DocuSign Enterprise Offer
                </button>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                runDocScan();
              }}
              className="mb-3"
            >
              <div className="row g-2 mb-2">
                <div className="col-12">
                  <input
                    type="text"
                    className="form-control py-2 bg-dark text-white border-white-15 rounded-3"
                    placeholder="File name (e.g. TCS_Offer_Letter_2026.pdf or appointment.canva.pdf)"
                    value={docFileName}
                    onChange={(e) => setDocFileName(e.target.value)}
                  />
                </div>
                <div className="col-12">
                  <textarea
                    className="form-control bg-dark text-white border-white-15 rounded-3"
                    rows={3}
                    placeholder="Paste letter clauses, fine print, payment/deposit requirements, or metadata text..."
                    value={docContent}
                    onChange={(e) => setDocContent(e.target.value)}
                  />
                </div>
              </div>
              <div className="d-flex justify-content-between align-items-center">
                <span className="text-white-50" style={{ fontSize: '0.75rem' }}>
                  Audits software producer tags, cryptographic signatures, and fraudulent deposit covenants.
                </span>
                <button
                  type="submit"
                  className="btn btn-primary px-4 d-flex align-items-center gap-2 fw-semibold"
                  disabled={docLoading || !docFileName.trim()}
                >
                  {docLoading ? <Loader2 size={16} className="spin" /> : <FileText size={16} />}
                  Audit Offer Letter
                </button>
              </div>
            </form>

            {docError && <div className="alert alert-danger py-2" role="alert">{docError}</div>}

            {docResult && (
              <div className="osint-result-box p-3 rounded-3 border border-white-10 mt-3 bg-black bg-opacity-25">
                <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3 pb-3 border-bottom border-white-10">
                  <div>
                    <span className="text-white-50 text-uppercase" style={{ fontSize: '0.7rem' }}>TARGET DOCUMENT</span>
                    <h4 className="fs-5 text-white mb-0">{docResult.file_name}</h4>
                    <small className="text-info">{docResult.software_tool || docResult.detected_software || 'Standard PDF Architecture'}</small>
                  </div>
                  <div className="text-end">
                    <span className="text-white-50" style={{ fontSize: '0.7rem' }}>RISK SCORE</span>
                    <div className={`fs-5 fw-bold ${docResult.risk_level === 'critical' || docResult.risk_level === 'high' ? 'text-danger' : docResult.risk_level === 'medium' ? 'text-warning' : 'text-success'}`}>
                      {docResult.risk_score} / 100 ({docResult.risk_level.toUpperCase()})
                    </div>
                  </div>
                </div>

                <div className="row g-2 mb-3">
                  <div className="col-12 col-md-4">
                    <div className="p-2 rounded bg-dark border border-white-10">
                      <span className="text-white-50 d-block" style={{ fontSize: '0.7rem' }}>CREATION SOFTWARE</span>
                      <strong className={docResult.is_tampered_or_canva || docResult.created_with_canva || docResult.created_with_photoshop ? 'text-danger' : 'text-white'}>
                        {docResult.software_tool || (docResult.created_with_canva ? 'Canva Graphics Engine' : docResult.created_with_photoshop ? 'Adobe Photoshop' : 'Enterprise Standard')}
                      </strong>
                    </div>
                  </div>
                  <div className="col-12 col-md-4">
                    <div className="p-2 rounded bg-dark border border-white-10">
                      <span className="text-white-50 d-block" style={{ fontSize: '0.7rem' }}>DIGITAL PKI SIGNATURE</span>
                      <strong className={docResult.has_digital_signature ? 'text-success' : 'text-danger'}>
                        {docResult.has_digital_signature ? '✔ Cryptographically Certified' : '✖ Missing PKI Signature'}
                      </strong>
                    </div>
                  </div>
                  <div className="col-12 col-md-4">
                    <div className="p-2 rounded bg-dark border border-white-10">
                      <span className="text-white-50 d-block" style={{ fontSize: '0.7rem' }}>LEGAL THREAT / EXTORTION</span>
                      <strong className={(docResult.suspicious_clauses?.length > 0 || (docResult.forensic_findings || []).some(f => f.severity === 'critical' || f.severity === 'high')) ? 'text-danger' : 'text-success'}>
                        {docResult.suspicious_clauses?.length > 0 ? `${docResult.suspicious_clauses.length} Flagged Clauses` : (docResult.forensic_findings || []).some(f => f.severity === 'critical' || f.severity === 'high') ? 'Flagged Terms Detected' : 'Clean Contractual Terms'}
                      </strong>
                    </div>
                  </div>
                </div>

                {(docResult.forensic_findings || docResult.indicators || []).length > 0 && (
                  <div className="mb-3">
                    <strong className="text-white-50 d-block mb-1" style={{ fontSize: '0.75rem' }}>EVIDENCE DETECTED</strong>
                    <ul className="mb-0 ps-3 text-white" style={{ fontSize: '0.82rem' }}>
                      {(docResult.forensic_findings || docResult.indicators || []).map((ind, idx) => (
                        <li key={idx} className="mb-1">{ind.message}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="d-flex flex-wrap gap-2 pt-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1"
                    onClick={() => handleExportPdf(
                      `Document Forensic Dossier: ${docResult.file_name}`,
                      docResult.risk_score,
                      docResult.risk_level,
                      `File: ${docResult.file_name}. Tool: ${docResult.software_tool || docResult.detected_software || 'N/A'}. Verdict: ${docResult.summary || docResult.verdict}`,
                      null,
                      null
                    )}
                    disabled={isDownloadingPdf}
                  >
                    {isDownloadingPdf ? <Loader2 size={13} className="spin" /> : <Download size={13} />}
                    Export Evidence PDF
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 6: QR DEBIT TRAP */}
        {activeTab === 'qrtrap' && (
          <div>
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
              <div>
                <h3 className="fs-5 fw-bold text-white mb-1 d-flex align-items-center gap-2">
                  <QrCode size={18} className="text-danger" /> QR Code Reverse Payment Trap Scanner
                </h3>
                <p className="text-white-50 mb-0" style={{ fontSize: '0.82rem' }}>
                  Dissects `upi://pay` payloads, hidden debit parameters, and deceptive "Scan to receive joining bonus" tricks.
                </p>
              </div>
              <div className="d-flex gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary text-white-50"
                  style={{ fontSize: '0.75rem' }}
                  onClick={() => handleQrPreset(
                    'upi://pay?pa=recruiter.instant@okaxis&pn=TCS%20Joining%20Bonus&am=4999&cu=INR&tn=Scan%20to%20credit%20your%20first%20stipend',
                    'Recruiter told candidate: "Scan this QR code in Google Pay to receive your ₹4,999 joining bonus immediately"'
                  )}
                >
                  ⚡ Preset: Bonus Debit Trap
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary text-white-50"
                  style={{ fontSize: '0.75rem' }}
                  onClick={() => handleQrPreset(
                    'upi://pay?pa=credihire.billing@icici&pn=CrediHire%20Technologies&cu=INR',
                    'Corporate merchant transaction on ICICI bank'
                  )}
                >
                  ✔ Preset: Merchant QR
                </button>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                runQrScan();
              }}
              className="mb-3"
            >
              <div className="row g-2 mb-2">
                <div className="col-12 col-md-7">
                  <input
                    type="text"
                    className="form-control py-2 bg-dark text-white border-white-15 rounded-3"
                    placeholder="e.g. upi://pay?pa=hr@okhdfcbank&am=3000&pn=Recruiter"
                    value={qrInput}
                    onChange={(e) => setQrInput(e.target.value)}
                  />
                </div>
                <div className="col-12 col-md-5">
                  <input
                    type="text"
                    className="form-control py-2 bg-dark text-white border-white-15 rounded-3"
                    placeholder="Context: e.g. HR claims scanning will receive stipend"
                    value={qrContext}
                    onChange={(e) => setQrContext(e.target.value)}
                  />
                </div>
              </div>
              <div className="d-flex justify-content-between align-items-center">
                <span className="text-white-50" style={{ fontSize: '0.75rem' }}>
                  Golden Rule: Scanning a QR code ALWAYS sends money out of your bank account; it NEVER receives money!
                </span>
                <button
                  type="submit"
                  className="btn btn-danger px-4 d-flex align-items-center gap-2 fw-semibold"
                  disabled={qrLoading || !qrInput.trim()}
                >
                  {qrLoading ? <Loader2 size={16} className="spin" /> : <QrCode size={16} />}
                  Analyze QR Payload
                </button>
              </div>
            </form>

            {qrError && <div className="alert alert-danger py-2" role="alert">{qrError}</div>}

            {qrResult && (
              <div className="osint-result-box p-3 rounded-3 border border-white-10 mt-3 bg-black bg-opacity-25">
                <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3 pb-3 border-bottom border-white-10">
                  <div>
                    <span className="text-white-50 text-uppercase" style={{ fontSize: '0.7rem' }}>TARGET PAYEE VPA</span>
                    <h4 className="fs-5 text-white mb-0">{qrResult.vpa_payee || qrResult.target_vpa || 'Unknown Payee'}</h4>
                    {qrResult.payee_name && <small className="text-warning">Payee Name: {qrResult.payee_name}</small>}
                  </div>
                  <div className="text-end">
                    <span className="text-white-50" style={{ fontSize: '0.7rem' }}>RISK SCORE</span>
                    <div className={`fs-5 fw-bold ${qrResult.risk_level === 'critical' || qrResult.risk_level === 'high' ? 'text-danger' : qrResult.risk_level === 'medium' ? 'text-warning' : 'text-success'}`}>
                      {qrResult.risk_score} / 100 ({qrResult.risk_level.toUpperCase()})
                    </div>
                  </div>
                </div>

                {(qrResult.is_debit_trap || qrResult.is_reverse_payment_trap) && (
                  <div className="alert alert-danger py-2 d-flex align-items-center gap-2 mb-3" role="alert">
                    <AlertOctagon size={20} className="flex-shrink-0 text-danger" />
                    <span style={{ fontSize: '0.85rem' }}>
                      <strong>CRITICAL DEBIT TRAP DETECTED:</strong> The recruiter claims you will receive money, but this QR code will instantly <strong>DEBIT {qrResult.demanded_amount || 'funds'}</strong> from your bank account when scanned in UPI apps!
                    </span>
                  </div>
                )}

                <div className="row g-2 mb-3">
                  <div className="col-12 col-md-4">
                    <div className="p-2 rounded bg-dark border border-white-10">
                      <span className="text-white-50 d-block" style={{ fontSize: '0.7rem' }}>DEMANDED AMOUNT</span>
                      <strong className="text-danger">
                        {qrResult.demanded_amount ? `${qrResult.demanded_amount.startsWith('₹') ? '' : '₹'}${qrResult.demanded_amount}` : 'Open / Dynamic Amount'}
                      </strong>
                    </div>
                  </div>
                  <div className="col-12 col-md-4">
                    <div className="p-2 rounded bg-dark border border-white-10">
                      <span className="text-white-50 d-block" style={{ fontSize: '0.7rem' }}>TRANSACTION INTENT</span>
                      <strong className="text-warning">Direct UPI Outflow Debit</strong>
                    </div>
                  </div>
                  <div className="col-12 col-md-4">
                    <div className="p-2 rounded bg-dark border border-white-10">
                      <span className="text-white-50 d-block" style={{ fontSize: '0.7rem' }}>REVERSE TRAP STATUS</span>
                      <strong className={(qrResult.is_debit_trap || qrResult.is_reverse_payment_trap) ? 'text-danger' : 'text-success'}>
                        {(qrResult.is_debit_trap || qrResult.is_reverse_payment_trap) ? 'Active Deception' : 'Standard Payment QR'}
                      </strong>
                    </div>
                  </div>
                </div>

                {(qrResult.deception_indicators || qrResult.indicators || []).length > 0 && (
                  <div className="mb-3">
                    <strong className="text-white-50 d-block mb-1" style={{ fontSize: '0.75rem' }}>FORENSIC EVIDENCE</strong>
                    <ul className="mb-0 ps-3 text-white" style={{ fontSize: '0.82rem' }}>
                      {(qrResult.deception_indicators || qrResult.indicators || []).map((ind, idx) => (
                        <li key={idx} className="mb-1">{ind.message}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="d-flex flex-wrap gap-2 pt-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1"
                    onClick={() => handleExportPdf(
                      `QR Debit Trap Dossier: ${qrResult.vpa_payee || qrResult.target_vpa || 'Suspect QR'}`,
                      qrResult.risk_score,
                      qrResult.risk_level,
                      `Payload: ${qrResult.raw_payload}. Payee: ${qrResult.payee_name || 'N/A'}. Verdict: ${qrResult.summary || qrResult.verdict}`,
                      qrResult.demanded_amount,
                      qrResult.vpa_payee || qrResult.target_vpa
                    )}
                    disabled={isDownloadingPdf}
                  >
                    {isDownloadingPdf ? <Loader2 size={13} className="spin" /> : <Download size={13} />}
                    Export Evidence PDF
                  </button>
                  <a
                    href="https://cybercrime.gov.in"
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-sm btn-danger d-inline-flex align-items-center gap-1"
                  >
                    <ShieldAlert size={13} /> Report QR Fraud to 1930 <ExternalLink size={11} />
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 7: MCA CIN & GSTIN */}
        {activeTab === 'cin' && (
          <div>
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
              <div>
                <h3 className="fs-5 fw-bold text-white mb-1 d-flex align-items-center gap-2">
                  <Building size={18} className="text-warning" /> MCA Corporate CIN &amp; GSTIN Validator
                </h3>
                <p className="text-white-50 mb-0" style={{ fontSize: '0.82rem' }}>
                  Validates 21-digit Indian Corporate Identity Numbers (CIN) and 15-digit GSTIN tax identifiers against statutory state registries.
                </p>
              </div>
              <div className="d-flex gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary text-white-50"
                  style={{ fontSize: '0.75rem' }}
                  onClick={() => handleCinPreset('L85110KA1981PLC013115')}
                >
                  ✔ Preset: Infosys CIN
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary text-white-50"
                  style={{ fontSize: '0.75rem' }}
                  onClick={() => handleCinPreset('X99999ZZ2025FAKE000001')}
                >
                  ⚡ Preset: Forged CIN
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary text-white-50"
                  style={{ fontSize: '0.75rem' }}
                  onClick={() => handleCinPreset('07AAAAA0000A1Z5')}
                >
                  ✔ Preset: Delhi GSTIN
                </button>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                runCinScan();
              }}
              className="d-flex gap-2 mb-3"
            >
              <div className="position-relative flex-grow-1">
                <Search size={16} className="position-absolute top-50 start-0 translate-middle-y ms-3 text-white-50" />
                <input
                  type="text"
                  className="form-control ps-5 py-2 bg-dark text-white border-white-15 rounded-3"
                  placeholder="e.g. L85110KA1981PLC013115 or 07AAAAA0000A1Z5"
                  value={cinInput}
                  onChange={(e) => setCinInput(e.target.value)}
                />
              </div>
              <button
                type="submit"
                className="btn btn-warning px-4 d-flex align-items-center gap-2 fw-semibold text-dark"
                disabled={cinLoading || !cinInput.trim()}
              >
                {cinLoading ? <Loader2 size={16} className="spin" /> : <Building size={16} />}
                Verify Registration
              </button>
            </form>

            {cinError && <div className="alert alert-danger py-2" role="alert">{cinError}</div>}

            {cinResult && (
              <div className="osint-result-box p-3 rounded-3 border border-white-10 mt-3 bg-black bg-opacity-25">
                <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3 pb-3 border-bottom border-white-10">
                  <div>
                    <span className="text-white-50 text-uppercase" style={{ fontSize: '0.7rem' }}>TARGET REGISTRATION NUMBER</span>
                    <h4 className="fs-5 text-white mb-0">{cinResult.query_id || cinResult.query}</h4>
                    <small className="text-warning">
                      {(cinResult.id_type === 'CIN' || cinResult.is_cin) ? 'Ministry of Corporate Affairs (CIN)' : (cinResult.id_type === 'GSTIN' || cinResult.is_gstin) ? 'Goods & Services Tax Network (GSTIN)' : 'Statutory Registry Check'}
                    </small>
                  </div>
                  <div className="text-end">
                    <span className="text-white-50" style={{ fontSize: '0.7rem' }}>STATUTORY STATUS</span>
                    <div className={`fs-5 fw-bold ${cinResult.risk_level === 'critical' || cinResult.risk_level === 'high' ? 'text-danger' : cinResult.risk_level === 'medium' ? 'text-warning' : 'text-success'}`}>
                      {cinResult.is_valid_format ? 'VALID REGISTRATION' : 'FORGED / INVALID'} ({cinResult.risk_score}/100)
                    </div>
                  </div>
                </div>

                <div className="row g-2 mb-3">
                  <div className="col-6 col-md-3">
                    <div className="p-2 rounded bg-dark border border-white-10">
                      <span className="text-white-50 d-block" style={{ fontSize: '0.7rem' }}>STATE OF REGISTRATION</span>
                      <strong className="text-white">
                        {cinResult.state_name ? `${cinResult.state_name} (${cinResult.state_code})` : 'Unknown State'}
                      </strong>
                    </div>
                  </div>
                  <div className="col-6 col-md-3">
                    <div className="p-2 rounded bg-dark border border-white-10">
                      <span className="text-white-50 d-block" style={{ fontSize: '0.7rem' }}>INCORPORATION YEAR</span>
                      <strong className="text-white">
                        {cinResult.incorporation_year || 'N/A'}
                      </strong>
                    </div>
                  </div>
                  <div className="col-6 col-md-3">
                    <div className="p-2 rounded bg-dark border border-white-10">
                      <span className="text-white-50 d-block" style={{ fontSize: '0.7rem' }}>ENTITY CLASS</span>
                      <strong className="text-white">
                        {cinResult.entity_class || ((cinResult.id_type === 'GSTIN' || cinResult.is_gstin) ? 'GST Taxpayer' : 'N/A')}
                      </strong>
                    </div>
                  </div>
                  <div className="col-6 col-md-3">
                    <div className="p-2 rounded bg-dark border border-white-10">
                      <span className="text-white-50 d-block" style={{ fontSize: '0.7rem' }}>FORMAT VERIFICATION</span>
                      <strong className={cinResult.is_valid_format ? 'text-success' : 'text-danger'}>
                        {cinResult.is_valid_format ? '✔ MCA/GST Verified' : '✖ Format Rejected'}
                      </strong>
                    </div>
                  </div>
                </div>

                {(cinResult.verification_details || cinResult.indicators || []).length > 0 && (
                  <div className="mb-3">
                    <strong className="text-white-50 d-block mb-1" style={{ fontSize: '0.75rem' }}>FORENSIC OBSERVATIONS</strong>
                    <ul className="mb-0 ps-3 text-white" style={{ fontSize: '0.82rem' }}>
                      {(cinResult.verification_details || cinResult.indicators || []).map((ind, idx) => (
                        <li key={idx} className="mb-1">{ind.message}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="d-flex flex-wrap gap-2 pt-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1"
                    onClick={() => handleExportPdf(
                      `Corporate CIN/GSTIN Dossier: ${cinResult.query_id || cinResult.query}`,
                      cinResult.risk_score,
                      cinResult.risk_level,
                      `Registration: ${cinResult.query_id || cinResult.query}. State: ${cinResult.state_name || 'N/A'}. Verdict: ${cinResult.summary || cinResult.verdict}`,
                      null,
                      null
                    )}
                    disabled={isDownloadingPdf}
                  >
                    {isDownloadingPdf ? <Loader2 size={13} className="spin" /> : <Download size={13} />}
                    Export Evidence PDF
                  </button>
                  <a
                    href="https://www.mca.gov.in/content/mca/global/en/mca/master-data/MDS.html"
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-sm btn-outline-warning d-inline-flex align-items-center gap-1"
                  >
                    <ExternalLink size={13} /> Verify on MCA Master Data Portal
                  </a>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
