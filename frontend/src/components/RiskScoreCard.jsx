
import React from 'react';
import { AlertTriangle, AlertCircle, CheckCircle2, HelpCircle, Lock } from 'lucide-react';

export function RiskScoreCard({
  riskScore = 85,
  riskLevel = 'high',
  headline,
  summary,
  isScoreHidden = false,
  onOpenAuth
}) {
  // Normalize risk level to handle uppercase and lowercase API values
  const normalizedRiskLevel = String(riskLevel).toLowerCase();

  const radius = 36;
  const strokeWidth = 7.5;
  const totalArcAngle = 260;
  const totalCircumference = 2 * Math.PI * radius;
  const arcLength = totalCircumference * (totalArcAngle / 360);

  const progressRatio = Math.min(Math.max(riskScore / 100, 0), 1);
  const filledLength = Math.max(arcLength * progressRatio, 0.001);

  // Risk-level configuration
  const riskConfig = {
    critical: {
      label: 'Critical Risk',
      color: '#FF4058',
      icon: AlertTriangle
    },
    high: {
      label: 'High Risk',
      color: '#FF4058',
      icon: AlertTriangle
    },
    medium: {
      label: 'Medium Risk',
      color: '#FFB547',
      icon: AlertCircle
    },
    low: {
      label: 'Low Risk',
      color: '#24D18B',
      icon: CheckCircle2
    },
    insufficient: {
      label: 'Insufficient Evidence',
      color: '#94A3B8',
      icon: HelpCircle
    }
  };

  const config = riskConfig[normalizedRiskLevel] || riskConfig.low;
  const strokeColor = config.color;
  const IconComponent = config.icon;

  return (
    <div className="risk-score-overview-box">
      <div
        className="risk-circle-wrapper"
        aria-label={isScoreHidden ? "Risk percentage score is hidden. Please signin/signup to view." : `Risk score: ${riskScore} out of 100`}
      >
        <svg
          className="risk-circle-svg"
          viewBox="0 0 96 96"
          style={{ transform: 'rotate(140deg)' }}
        >
          <circle
            className="risk-circle-bg"
            cx="48"
            cy="48"
            r={radius}
            strokeWidth={strokeWidth}
            strokeDasharray={`${arcLength} ${totalCircumference}`}
            strokeDashoffset={0}
            strokeLinecap="round"
          />

          <circle
            className="risk-circle-progress"
            cx="48"
            cy="48"
            r={radius}
            strokeWidth={strokeWidth}
            stroke={isScoreHidden ? 'rgba(255, 181, 71, 0.3)' : strokeColor}
            strokeDasharray={isScoreHidden ? `0 ${totalCircumference}` : `${filledLength} ${totalCircumference}`}
            strokeDashoffset={0}
            strokeLinecap="round"
            style={{
              filter: isScoreHidden ? 'none' : `drop-shadow(0 0 6px ${strokeColor}88)`,
              transition: 'stroke-dasharray 0.8s ease-out, stroke 0.3s ease'
            }}
          />
        </svg>

        {isScoreHidden ? (
          <div className="risk-circle-text score-locked" title="Please signin/signup to view risk percentage score">
            <Lock size={20} className="text-warning mb-1" />
            <span className="score-locked-tag">Locked</span>
          </div>
        ) : (
          <div className="risk-circle-text">
            <span className="score-number">{riskScore}</span>
            <span className="score-max">/ 100</span>
          </div>
        )}
      </div>

      <div className="risk-text-status">
        {isScoreHidden ? (
          <div className="score-hidden-notice">
            <div className="risk-level-heading warning d-flex align-items-center gap-2 mb-1">
              <Lock size={20} className="text-warning flex-shrink-0" />
              <span style={{ color: '#FFB547' }}>Score Hidden</span>
            </div>
            <div className="risk-level-subtext text-white-50 mb-2" style={{ fontSize: '0.84rem' }}>
              Risk percentage score is protected. Please sign in or create an account to view the exact score.
            </div>
            <button
              type="button"
              className="btn btn-sm btn-warning d-inline-flex align-items-center gap-1.5 fw-semibold px-3 py-1.5"
              onClick={() => onOpenAuth && onOpenAuth('signin')}
              style={{ borderRadius: '6px', fontSize: '0.82rem' }}
            >
              <Lock size={13} />
              <span>Please signin/signup</span>
            </button>
          </div>
        ) : (
          <>
            <div className={`risk-level-heading ${normalizedRiskLevel}`}>
              <IconComponent size={22} strokeWidth={2.5} />
              <span>{headline || config.label}</span>
            </div>

            <div className={`risk-level-subtext ${normalizedRiskLevel}`}>
              {summary || 'This appears to be a scam.'}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
