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
  Sparkles
} from 'lucide-react';
import {
  analyzeDomainIntel,
  analyzeForwardedMessage,
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
      <div className="osint-tabs d-flex justify-content-center gap-2 mb-4">
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
          <QrCode size={16} /> UPI &amp; Payment Inspector
        </button>
        <button
          type="button"
          className={`osint-tab-btn ${activeTab === 'forward' ? 'active' : ''}`}
          onClick={() => setActiveTab('forward')}
        >
          <Smartphone size={16} /> WhatsApp / Telegram Forward
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
      </div>
    </section>
  );
}
