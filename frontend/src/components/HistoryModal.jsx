import React, { useState, useMemo } from 'react';
import { 
  X, 
  History, 
  Trash2, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowRight, 
  Clock, 
  Search, 
  FileText,
  ShieldCheck,
  IndianRupee,
  Share2,
  Check,
  Download,
  Filter
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { calculateEstimatedMoneySaved } from '../utils/dashboardStats.js';

export function HistoryModal({ isOpen, onClose, onLoadHistoryItem }) {
  const { user, history, deleteHistoryItem, clearHistory } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all' | 'scam' | 'safe'
  const [copiedReport, setCopiedReport] = useState(false);

  if (!isOpen) return null;

  const totalScans = history.length;
  const scamScans = history.filter(item => item.riskLevel === 'high' || item.riskLevel === 'medium');
  const safeScans = history.filter(item => item.riskLevel === 'low');
  const moneySaved = calculateEstimatedMoneySaved(history);

  const filteredHistory = history.filter(item => {
    if (filterType === 'scam' && (item.riskLevel !== 'high' && item.riskLevel !== 'medium')) return false;
    if (filterType === 'safe' && item.riskLevel !== 'low') return false;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const textMatch = (item.text || item.submittedText || '').toLowerCase().includes(query);
      const headlineMatch = (item.headline || '').toLowerCase().includes(query);
      const fileMatch = item.attachedFile?.name?.toLowerCase().includes(query);
      return textMatch || headlineMatch || fileMatch;
    }
    return true;
  });

  const handleCopySummary = () => {
    const summary = [
      `🛡️ CrediHire Safety Report for ${user?.name || 'Job Seeker'}`,
      `• Total Offers Evaluated: ${totalScans}`,
      `• Job Scams Prevented: ${scamScans.length}`,
      `• Estimated Money Saved: ₹${moneySaved.toLocaleString('en-IN')}`,
      `• Safety Status: Verified Active`,
      `\nProtected by CrediHire (AI Job Scam Intelligence)`
    ].join('\n');

    navigator.clipboard.writeText(summary);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2500);
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-dialog-custom history-modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '720px' }}>
        {/* Header */}
        <div className="modal-header-custom">
          <div className="modal-title-wrap">
            <div className="brand-logo-icon" style={{ width: '32px', height: '32px' }}>
              <ShieldCheck size={18} />
            </div>
            <div>
              <h2 className="modal-title mb-0" style={{ fontSize: '1.2rem' }}>
                User Safety Dashboard
              </h2>
              <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                Personal security analytics and evaluated job scam history
              </span>
            </div>
          </div>
          <button 
            type="button" 
            className="btn-close-modal" 
            onClick={onClose}
            aria-label="Close safety dashboard"
          >
            <X size={20} />
          </button>
        </div>

        {/* Top KPI Metrics Grid */}
        <div className="p-3 border-bottom border-secondary border-opacity-25" style={{ background: 'rgba(10, 15, 29, 0.7)' }}>
          <div className="row g-2 mb-2">
            {/* KPI 1: Estimated Money Saved */}
            <div className="col-12 col-sm-4">
              <div className="p-3 rounded-3 h-100" style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                <span className="text-white-50 d-block mb-1" style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.04em' }}>
                  ESTIMATED MONEY SAVED
                </span>
                <div className="d-flex align-items-center gap-1 text-success fw-bold" style={{ fontSize: '1.35rem' }}>
                  <IndianRupee size={20} />
                  <span>{moneySaved.toLocaleString('en-IN')}</span>
                </div>
                <span className="text-white-50" style={{ fontSize: '0.68rem' }}>
                  Fraud deposits avoided
                </span>
              </div>
            </div>

            {/* KPI 2: Scams Blocked */}
            <div className="col-6 col-sm-4">
              <div className="p-3 rounded-3 h-100" style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                <span className="text-white-50 d-block mb-1" style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.04em' }}>
                  SCAMS BLOCKED
                </span>
                <div className="text-danger fw-bold" style={{ fontSize: '1.35rem' }}>
                  {scamScans.length}
                </div>
                <span className="text-white-50" style={{ fontSize: '0.68rem' }}>
                  High/Medium risk alerts
                </span>
              </div>
            </div>

            {/* KPI 3: Total Scans */}
            <div className="col-6 col-sm-4">
              <div className="p-3 rounded-3 h-100" style={{ background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                <span className="text-white-50 d-block mb-1" style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.04em' }}>
                  TOTAL OFFERS SCANNED
                </span>
                <div className="text-info fw-bold" style={{ fontSize: '1.35rem' }}>
                  {totalScans}
                </div>
                <span className="text-white-50" style={{ fontSize: '0.68rem' }}>
                  Active Candidate: <strong>{user?.name || 'Verified User'}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Action Row: Copy Report / Clear All */}
          <div className="d-flex align-items-center justify-content-between pt-2">
            <button
              type="button"
              className="btn btn-sm btn-outline-light text-white-50 d-inline-flex align-items-center gap-1 border-secondary border-opacity-50"
              style={{ fontSize: '0.74rem', borderRadius: '6px' }}
              onClick={handleCopySummary}
              title="Copy your safety statistics summary"
            >
              {copiedReport ? (
                <>
                  <Check size={12} className="text-success" />
                  <span className="text-success">Summary Copied!</span>
                </>
              ) : (
                <>
                  <Share2 size={12} />
                  <span>Copy Safety Summary</span>
                </>
              )}
            </button>

            {history.length > 0 && (
              <button
                type="button"
                className="btn btn-sm btn-link text-white-50 p-0 text-decoration-none hover-danger d-inline-flex align-items-center gap-1"
                style={{ fontSize: '0.74rem' }}
                onClick={() => {
                  if (window.confirm("Are you sure you want to clear your entire scan history?")) {
                    clearHistory();
                  }
                }}
              >
                <Trash2 size={12} />
                <span>Clear All Scans</span>
              </button>
            )}
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="px-4 py-2 border-bottom border-secondary border-opacity-25 d-flex flex-column flex-sm-row align-items-stretch align-items-sm-center justify-content-between gap-2" style={{ background: 'rgba(8, 12, 24, 0.9)' }}>
          {/* Search Box */}
          <div className="position-relative flex-grow-1">
            <Search size={14} className="position-absolute top-50 translate-middle-y text-white-50" style={{ left: '10px' }} />
            <input
              type="text"
              className="auth-input-field ps-4 py-1"
              style={{ fontSize: '0.8rem', background: 'rgba(255, 255, 255, 0.05)', borderColor: 'rgba(255, 255, 255, 0.1)' }}
              placeholder="Search past scans, keywords, or documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Filter Tabs */}
          <div className="d-flex align-items-center gap-1 flex-shrink-0">
            <button
              type="button"
              className={`btn btn-sm px-2 py-1 rounded-pill ${filterType === 'all' ? 'btn-primary' : 'btn-outline-secondary text-white-50'}`}
              style={{ fontSize: '0.72rem' }}
              onClick={() => setFilterType('all')}
            >
              All ({totalScans})
            </button>
            <button
              type="button"
              className={`btn btn-sm px-2 py-1 rounded-pill ${filterType === 'scam' ? 'btn-danger' : 'btn-outline-secondary text-white-50'}`}
              style={{ fontSize: '0.72rem' }}
              onClick={() => setFilterType('scam')}
            >
              Scams ({scamScans.length})
            </button>
            <button
              type="button"
              className={`btn btn-sm px-2 py-1 rounded-pill ${filterType === 'safe' ? 'btn-success' : 'btn-outline-secondary text-white-50'}`}
              style={{ fontSize: '0.72rem' }}
              onClick={() => setFilterType('safe')}
            >
              Safe ({safeScans.length})
            </button>
          </div>
        </div>

        {/* History Items List */}
        <div className="modal-body-custom pt-3 d-flex flex-column gap-3" style={{ maxHeight: '440px', overflowY: 'auto' }}>
          {filteredHistory.length === 0 ? (
            <div className="text-center py-5">
              <History size={42} className="text-white-50 mb-3" opacity={0.4} />
              <h3 className="text-white h6 mb-1">
                {searchQuery.trim() || filterType !== 'all' ? 'No Matching Scans Found' : 'No Scan History Yet'}
              </h3>
              <p className="text-white-50 mb-3" style={{ fontSize: '0.84rem' }}>
                {searchQuery.trim() || filterType !== 'all' 
                  ? 'Try clearing your search query or switching filters.'
                  : 'Offers and recruiter messages you check while logged in will automatically appear here with risk analytics.'}
              </p>
              {(!searchQuery.trim() && filterType === 'all') && (
                <button
                  type="button"
                  className="btn btn-sm btn-primary px-3 fw-medium"
                  onClick={onClose}
                >
                  Scan an Offer Now
                </button>
              )}
            </div>
          ) : (
            filteredHistory.map((item) => {
              const isHighRisk = item.riskLevel === 'high';
              const isMediumRisk = item.riskLevel === 'medium';
              const isLowRisk = item.riskLevel === 'low';

              return (
                <div key={item.id} className="history-card-item">
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    {/* Risk Badge */}
                    <div className="d-flex align-items-center gap-2">
                      <span className={`history-risk-badge ${item.riskLevel}`}>
                        {isHighRisk || isMediumRisk ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />}
                        <span>{item.riskScore}/100 {item.headline}</span>
                      </span>

                      <span className="history-channel-badge text-uppercase">
                        {item.channel}
                      </span>
                    </div>

                    {/* Timestamp & Delete */}
                    <div className="d-flex align-items-center gap-2">
                      <span className="text-white-50 d-flex align-items-center gap-1" style={{ fontSize: '0.72rem' }}>
                        <Clock size={11} />
                        <span>{item.date}</span>
                      </span>
                      <button
                        type="button"
                        className="btn btn-sm text-white-50 p-0 border-0 bg-transparent hover-danger"
                        title="Delete this scan from history"
                        onClick={() => deleteHistoryItem(item.id)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Attached Document indicator if available */}
                  {item.attachedFile && (
                    <div className="d-flex align-items-center gap-1 mb-2 text-primary" style={{ fontSize: '0.74rem' }}>
                      <FileText size={13} />
                      <span className="fw-semibold text-truncate" style={{ maxWidth: '280px' }}>{item.attachedFile.name}</span>
                      <span className="text-white-50">({item.attachedFile.size})</span>
                    </div>
                  )}

                  {/* Offer Snippet */}
                  <div className="history-text-snippet">
                    "{item.text || item.submittedText}"
                  </div>

                  {/* Warning summary tags */}
                  {item.warningTitles && item.warningTitles.length > 0 && (
                    <div className="d-flex flex-wrap gap-1 mt-2 mb-2">
                      {item.warningTitles.map((title, idx) => (
                        <span key={idx} className="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25" style={{ fontSize: '0.68rem', fontWeight: 500 }}>
                          • {title}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Load Button */}
                  <div className="d-flex justify-content-end mt-2 pt-2 border-top border-secondary border-opacity-10">
                    <button
                      type="button"
                      className="btn-load-history"
                      onClick={() => onLoadHistoryItem(item)}
                    >
                      <span>Load in Dashboard</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
