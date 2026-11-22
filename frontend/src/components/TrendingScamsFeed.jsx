import React, { useState, useEffect } from 'react';
import { 
  Flame, 
  AlertTriangle, 
  ArrowRight, 
  ShieldAlert, 
  TrendingUp, 
  Eye, 
  MessageCircle, 
  Send, 
  ExternalLink, 
  Sparkles, 
  Copy, 
  Check, 
  PlusCircle, 
  X,
  IndianRupee,
  Smartphone
} from 'lucide-react';

const INITIAL_TRENDING_SCAMS = [
  {
    id: 'scam-1',
    rank: 1,
    title: 'Telegram YouTube "Like & Earn" Prepaid Task Fraud',
    category: 'telegram',
    channel: 'WhatsApp & Telegram',
    riskScore: 98,
    riskLevel: 'high',
    reportsCount: 3840,
    avgLoss: '₹45,000 - ₹2,50,000',
    tags: ['Prepaid Task', 'Telegram Group', 'Crypto Deposit'],
    modusOperandi: 'Recruiter contacts via WhatsApp offering ₹150 per YouTube video liked. After paying ₹450 as bait, victim is moved to a VIP Telegram group where they are coerced into depositing ₹5,000 to ₹50,000 in "merchant recharge accounts" to withdraw earnings.',
    sampleText: 'Hello! I am HR Sneha from Global Digital Media. We have part-time remote job liking YouTube videos. Earn ₹3000 to ₹8000 daily from phone. Initial 3 tasks pay ₹150 instantly. Join our Telegram manager @TaskDirectorMerchant to claim payment and recharge VIP merchant wallet with ₹5000 to unlock ₹15000 profit.',
    warningSign: 'Legitimate brands never ask you to pay or deposit money to receive job wages.'
  },
  {
    id: 'scam-2',
    rank: 2,
    title: 'Indigo Airlines / Airport Ground Staff Gate Pass Trap',
    category: 'aviation',
    channel: 'Direct SMS & Fake Portals',
    riskScore: 95,
    riskLevel: 'high',
    reportsCount: 2910,
    avgLoss: '₹2,450 - ₹18,000',
    tags: ['Gate Pass Fee', 'Uniform Deposit', 'Aviation Fake Letter'],
    modusOperandi: 'Fraudulent appointment letters on forged airline letterheads are sent via WhatsApp. Demands ₹2,450 for "Airport Security Clearance & RFID Pass" via UPI before the physical interview.',
    sampleText: 'Dear Candidate, Congratulations! You are shortlisted for Indigo Airport Ground Staff Operations at IGI Airport Terminal 3. Monthly Salary: ₹38,500 + Medical. To confirm your interview pass, deposit ₹2,450 refundable Airport Security Gate Pass and Uniform clearance fee to UPI id airportops@upi within 2 hours.',
    warningSign: 'Airlines and airport operators strictly prohibit collecting fees at any recruitment stage.'
  },
  {
    id: 'scam-3',
    rank: 3,
    title: 'Work From Home Notepad / Excel Data Entry Penalty Threat',
    category: 'wfh',
    channel: 'SMS, OLX & Quikr',
    riskScore: 92,
    riskLevel: 'high',
    reportsCount: 2150,
    avgLoss: '₹4,999 - ₹35,000',
    tags: ['Data Entry Scam', 'Fake Legal Notice', 'Agreement Breach'],
    modusOperandi: 'Candidate is promised ₹25,000/week for typing 500 pages with 90% accuracy. Scammers engineer artificial errors or block access, then impersonate high court advocates threatening police arrest unless ₹4,999 "agreement cancellation penalty" is paid.',
    sampleText: 'Notice of Legal Breach: You failed to complete 500 offline notepad data entry pages with 95% accuracy as per online stamp agreement. As per Section 420, case is filed in district court. Pay ₹4,999 NOC cancellation fee immediately to advocate desk or warrant will be dispatched to your home address.',
    warningSign: 'Threatening candidates with court summons or arrest over unfinished typing is 100% extortion.'
  },
  {
    id: 'scam-4',
    rank: 4,
    title: 'HR Recruiter Impersonation & APK Screen Share (OTP Stealer)',
    category: 'hr-impersonation',
    channel: 'WhatsApp Call & APK links',
    riskScore: 99,
    riskLevel: 'high',
    reportsCount: 1820,
    avgLoss: 'Entire Bank Balance',
    tags: ['Malware APK', 'OTP Harvesting', 'AnyDesk Screen Share'],
    modusOperandi: 'Recruiter posing as leading IT firm (TCS, Infosys) schedules a technical round and demands installing an "Assessment_Portal.apk" or AnyDesk to share screen. The app intercepts SMS OTPs and drains linked bank accounts.',
    sampleText: 'Hello candidate, your profile is selected for Senior Associate round. Please download the company verified interview test app from this link: http://tcs-interview-portal.online/assessment.apk. Open app, grant accessibility and SMS permissions for automated proctoring. Do not close background service.',
    warningSign: 'Never install .apk files received from recruiters; authentic employers use browser-based platforms.'
  },
  {
    id: 'scam-5',
    rank: 5,
    title: 'Amazon / Flipkart Product Rating Commission Fraud',
    category: 'ecommerce',
    channel: 'Instagram Sponsored Ads',
    riskScore: 90,
    riskLevel: 'high',
    reportsCount: 1640,
    avgLoss: '₹12,000 - ₹95,000',
    tags: ['Product Rating', 'Mock Wallet', 'Frozen Withdrawal'],
    modusOperandi: 'Victims are asked to boost merchant product rankings by making mock purchases on phishing clones. When attempting to withdraw supposed commissions, victim is told "order combo is pending, recharge ₹20,000 to unfreeze".',
    sampleText: 'Amazon Global Merchant Boost: Work 30 minutes daily reviewing partner products. Earn 20% instant commission on every completed order batch. Register account at http://amz-merchant-boost.vip. Minimum start deposit ₹1,000 to unlock Level 1 review pool.',
    warningSign: 'E-commerce giants never ask users to recharge merchant accounts to complete reviews.'
  }
];

const COMMUNITY_STORAGE_KEY = 'credihire_community_scams';

export function TrendingScamsFeed({ onTestScam }) {
  const [activeCategory, setActiveCategory] = useState('all');
  const [copiedId, setCopiedId] = useState(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [scams, setScams] = useState(() => {
    try {
      const stored = localStorage.getItem(COMMUNITY_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return [...parsed, ...INITIAL_TRENDING_SCAMS];
        }
      }
    } catch {}
    return INITIAL_TRENDING_SCAMS;
  });

  // Report form state
  const [reportTitle, setReportTitle] = useState('');
  const [reportChannel, setReportChannel] = useState('WhatsApp');
  const [reportText, setReportText] = useState('');
  const [reportDemandedFee, setReportDemandedFee] = useState('');
  const [reportSuccess, setReportSuccess] = useState(false);

  const categories = [
    { id: 'all', label: 'All Live Alerts' },
    { id: 'telegram', label: 'Telegram & WhatsApp Tasks' },
    { id: 'aviation', label: 'Airport & Aviation' },
    { id: 'wfh', label: 'Work From Home' },
    { id: 'hr-impersonation', label: 'HR Impersonation & APK' },
    { id: 'ecommerce', label: 'E-commerce Rating' }
  ];

  const filteredScams = scams.filter(s => {
    if (activeCategory === 'all') return true;
    return s.category === activeCategory;
  });

  const handleCopyText = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleReportSubmit = (e) => {
    e.preventDefault();
    if (!reportTitle.trim() || !reportText.trim()) return;

    const newReport = {
      id: 'community-' + Date.now().toString(36),
      rank: 'Community',
      title: reportTitle.trim(),
      category: 'community',
      channel: reportChannel,
      riskScore: 94,
      riskLevel: 'high',
      reportsCount: 1,
      avgLoss: reportDemandedFee.trim() ? `Demanded: ₹${reportDemandedFee.trim()}` : 'Under Review',
      tags: ['Community Verified', reportChannel, 'Fresh Alert'],
      modusOperandi: `Candidate submitted report: ${reportTitle.trim()}. Suspicious recruiter demand identified.`,
      sampleText: reportText.trim(),
      warningSign: 'Verify independently before transferring funds or sharing credentials.'
    };

    const updated = [newReport, ...scams];
    setScams(updated);
    try {
      const communityOnly = updated.filter(s => s.id.startsWith('community-'));
      localStorage.setItem(COMMUNITY_STORAGE_KEY, JSON.stringify(communityOnly));
    } catch {}

    setReportSuccess(true);
    setTimeout(() => {
      setReportSuccess(false);
      setIsReportModalOpen(false);
      setReportTitle('');
      setReportText('');
      setReportDemandedFee('');
    }, 1500);
  };

  return (
    <section className="trending-scams-section py-5" id="trending-scams-radar">
      <div className="container">
        {/* Section Header */}
        <div className="d-flex flex-column flex-md-row align-items-start align-items-md-center justify-content-between mb-4 pb-2 border-bottom border-secondary border-opacity-25 gap-3">
          <div>
            <div className="d-inline-flex align-items-center gap-2 px-3 py-1 rounded-pill mb-2" style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.35)' }}>
              <span className="scam-radar-pulse"></span>
              <span className="text-danger fw-bold" style={{ fontSize: '0.74rem', letterSpacing: '0.04em' }}>
                LIVE SCAM RADAR • INDIA
              </span>
            </div>
            <h2 className="text-white h3 fw-bold mb-1 d-flex align-items-center gap-2">
              <span>Trending Job Scams in India</span>
              <Flame size={24} className="text-danger" />
            </h2>
            <p className="text-white-50 mb-0" style={{ fontSize: '0.86rem' }}>
              Real-time recruitment fraud patterns reported across WhatsApp, Telegram, and SMS. Test any alert directly in CrediHire.
            </p>
          </div>

          <button
            type="button"
            className="btn btn-outline-danger btn-sm d-inline-flex align-items-center gap-2 py-2 px-3 fw-semibold flex-shrink-0"
            style={{ borderRadius: '8px', fontSize: '0.82rem' }}
            onClick={() => setIsReportModalOpen(true)}
          >
            <PlusCircle size={15} />
            <span>Report a Scam You Encountered</span>
          </button>
        </div>

        {/* Category Filter Pills */}
        <div className="d-flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-thin">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`btn btn-sm text-nowrap rounded-pill px-3 py-1 fw-medium transition-all ${
                activeCategory === cat.id
                  ? 'btn-danger text-white shadow-sm'
                  : 'btn-outline-secondary text-white-50 border-opacity-25'
              }`}
              style={{ fontSize: '0.78rem' }}
              onClick={() => setActiveCategory(cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Scam Cards Grid */}
        <div className="row g-3">
          {filteredScams.map((scam) => (
            <div key={scam.id} className="col-12 col-lg-6">
              <div className="trending-scam-card p-4 h-100 rounded-3 d-flex flex-column justify-content-between position-relative">
                {/* Top Row: Rank, Risk Badge, Channel */}
                <div>
                  <div className="d-flex align-items-center justify-content-between mb-3 gap-2">
                    <div className="d-flex align-items-center gap-2">
                      <span className="badge bg-danger bg-opacity-25 text-danger border border-danger border-opacity-50 px-2 py-1" style={{ fontSize: '0.72rem', fontWeight: 700 }}>
                        {typeof scam.rank === 'number' ? `#${scam.rank} TRENDING` : scam.rank}
                      </span>
                      <span className="badge bg-dark text-white-50 border border-secondary border-opacity-25 px-2 py-1" style={{ fontSize: '0.72rem' }}>
                        <Smartphone size={11} className="me-1 d-inline" />
                        {scam.channel}
                      </span>
                    </div>

                    <span className="text-danger fw-bold d-flex align-items-center gap-1" style={{ fontSize: '0.8rem' }}>
                      <AlertTriangle size={13} />
                      {scam.riskScore}/100 Risk
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-white h6 fw-bold mb-2">
                    {scam.title}
                  </h3>

                  {/* Modus Operandi */}
                  <p className="text-white-50 mb-3" style={{ fontSize: '0.8rem', lineHeight: '1.45' }}>
                    {scam.modusOperandi}
                  </p>

                  {/* Tags */}
                  <div className="d-flex flex-wrap gap-1 mb-3">
                    {scam.tags.map((tag, idx) => (
                      <span key={idx} className="badge bg-secondary bg-opacity-10 text-white-50 border border-secondary border-opacity-20" style={{ fontSize: '0.68rem' }}>
                        • {tag}
                      </span>
                    ))}
                  </div>

                  {/* Real Sample Message Box */}
                  <div className="p-2 mb-3 rounded" style={{ background: 'rgba(0, 0, 0, 0.45)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <div className="d-flex align-items-center justify-content-between mb-1">
                      <span className="text-white-50 fw-semibold" style={{ fontSize: '0.68rem', letterSpacing: '0.04em' }}>
                        ACTUAL SCAM MESSAGE INTERCEPTED:
                      </span>
                      <button
                        type="button"
                        className="btn btn-sm btn-link text-white-50 p-0 text-decoration-none"
                        style={{ fontSize: '0.7rem' }}
                        onClick={() => handleCopyText(scam.id, scam.sampleText)}
                        title="Copy scam message text"
                      >
                        {copiedId === scam.id ? (
                          <span className="text-success d-flex align-items-center gap-1">
                            <Check size={11} /> Copied
                          </span>
                        ) : (
                          <span className="d-flex align-items-center gap-1">
                            <Copy size={11} /> Copy Text
                          </span>
                        )}
                      </button>
                    </div>
                    <p className="mb-0 text-white text-opacity-75 fst-italic" style={{ fontSize: '0.75rem', lineHeight: '1.4' }}>
                      "{scam.sampleText}"
                    </p>
                  </div>

                  {/* Key Warning Sign */}
                  <div className="d-flex align-items-start gap-2 mb-3 text-warning" style={{ fontSize: '0.74rem' }}>
                    <ShieldAlert size={14} className="flex-shrink-0 mt-1" />
                    <span><strong>Safety Rule:</strong> {scam.warningSign}</span>
                  </div>
                </div>

                {/* Footer: Reported Loss */}
                <div className="d-flex align-items-center justify-content-between pt-3 border-top border-secondary border-opacity-25 mt-2 gap-2 flex-wrap">
                  <div>
                    <span className="text-white-50 d-block" style={{ fontSize: '0.68rem' }}>AVG. REPORTED LOSS</span>
                    <span className="text-white fw-bold d-flex align-items-center gap-1" style={{ fontSize: '0.84rem' }}>
                      <IndianRupee size={12} className="text-danger" />
                      {scam.avgLoss}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Community Report Modal */}
      {isReportModalOpen && (
        <div className="modal-overlay" onClick={() => setIsReportModalOpen(false)} role="dialog" aria-modal="true">
          <div className="modal-dialog-custom" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-header-custom">
              <div className="modal-title-wrap">
                <div className="brand-logo-icon bg-danger bg-opacity-25 text-danger" style={{ width: '32px', height: '32px' }}>
                  <ShieldAlert size={18} />
                </div>
                <div>
                  <h2 className="modal-title mb-0" style={{ fontSize: '1.15rem' }}>
                    Report a Job Scam
                  </h2>
                  <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                    Protect thousands of Indian job seekers by reporting fake job offers
                  </span>
                </div>
              </div>
              <button 
                type="button" 
                className="btn-close-modal" 
                onClick={() => setIsReportModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body-custom pt-3">
              {reportSuccess ? (
                <div className="text-center py-4">
                  <Check size={42} className="text-success mb-2" />
                  <h3 className="text-white h6 mb-1">Scam Reported Successfully!</h3>
                  <p className="text-white-50 small mb-0">
                    Thank you! Your report has been added to the community radar to alert other job seekers.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleReportSubmit} className="d-flex flex-column gap-3">
                  <div>
                    <label className="auth-label">Scam Title / Company Claimed</label>
                    <input
                      type="text"
                      className="auth-input-field"
                      placeholder="e.g. Fake Air India ground staff interview letter"
                      value={reportTitle}
                      onChange={(e) => setReportTitle(e.target.value)}
                      required
                    />
                  </div>

                  <div className="row g-2">
                    <div className="col-6">
                      <label className="auth-label">Platform Received</label>
                      <select
                        className="auth-input-field"
                        value={reportChannel}
                        onChange={(e) => setReportChannel(e.target.value)}
                      >
                        <option value="WhatsApp">WhatsApp</option>
                        <option value="Telegram">Telegram</option>
                        <option value="Direct SMS">Direct SMS</option>
                        <option value="Email">Email</option>
                        <option value="LinkedIn">LinkedIn</option>
                        <option value="Instagram">Instagram</option>
                      </select>
                    </div>

                    <div className="col-6">
                      <label className="auth-label">Demanded Fee (₹)</label>
                      <input
                        type="text"
                        className="auth-input-field"
                        placeholder="e.g. 2500"
                        value={reportDemandedFee}
                        onChange={(e) => setReportDemandedFee(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="auth-label">Scam Message or Offer Text</label>
                    <textarea
                      className="auth-input-field"
                      rows={4}
                      placeholder="Paste the recruiter message, payment demand, or UPI ID..."
                      value={reportText}
                      onChange={(e) => setReportText(e.target.value)}
                      required
                    />
                  </div>

                  <div className="d-flex justify-content-end gap-2 pt-2">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm px-3"
                      onClick={() => setIsReportModalOpen(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-danger btn-sm px-4 fw-semibold"
                    >
                      Publish to Community Radar
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
