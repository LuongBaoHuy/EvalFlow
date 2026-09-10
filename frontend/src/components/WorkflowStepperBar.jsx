import React from 'react';

const STATUS_CONFIG = {
  APPROVED: {
    bg: 'linear-gradient(135deg, #10b981, #059669)',
    border: '#10b981',
    icon: '✓',
    labelColor: '#10b981',
    connectorColor: '#10b981',
  },
  REJECTED: {
    bg: 'linear-gradient(135deg, #ef4444, #dc2626)',
    border: '#ef4444',
    icon: '✕',
    labelColor: '#ef4444',
    connectorColor: '#ef4444',
  },
  CURRENT: {
    bg: 'linear-gradient(135deg, #6366f1, #4f46e5)',
    border: '#6366f1',
    icon: '⏳',
    labelColor: '#6366f1',
    connectorColor: '#e2e8f0',
  },
  PENDING: {
    bg: 'linear-gradient(135deg, #f59e0b, #d97706)',
    border: '#f59e0b',
    icon: '⏳',
    labelColor: '#f59e0b',
    connectorColor: '#e2e8f0',
  },
  WAITING: {
    bg: '#e2e8f0',
    border: '#cbd5e1',
    icon: '○',
    labelColor: '#94a3b8',
    connectorColor: '#e2e8f0',
  },
};

const statusLabel = {
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
  CURRENT: 'Đang chờ',
  PENDING: 'Đang chờ',
  WAITING: 'Chưa đến',
};

export default function WorkflowStepperBar({ timeline = [], overallStatus }) {
  if (!timeline || timeline.length === 0) return null;

  return (
    <div style={{
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      borderRadius: '16px',
      padding: '28px 32px',
      marginBottom: '28px',
      boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
      border: '1px solid rgba(255,255,255,0.08)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '20px' }}>🔄</span>
          <span style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '15px', letterSpacing: '0.3px' }}>
            Quy trình phê duyệt đa cấp
          </span>
        </div>
        <OverallBadge status={overallStatus} />
      </div>

      {/* Steps */}
      <div style={{ display: 'flex', alignItems: 'flex-start', overflowX: 'auto', gap: '0', paddingBottom: '4px' }}>
        {timeline.map((step, idx) => {
          const cfg = STATUS_CONFIG[step.status] || STATUS_CONFIG.WAITING;
          const isLast = idx === timeline.length - 1;

          return (
            <React.Fragment key={step.step_order}>
              {/* Step node */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '110px', flex: 1 }}>
                {/* Circle */}
                <div style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  background: cfg.bg,
                  border: `2px solid ${cfg.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  boxShadow: step.status === 'CURRENT' || step.status === 'PENDING'
                    ? `0 0 0 6px ${cfg.border}25`
                    : 'none',
                  transition: 'all 0.3s ease',
                  animation: (step.status === 'CURRENT' || step.status === 'PENDING') ? 'pulse-ring 2s infinite' : 'none',
                  position: 'relative',
                }}>
                  <span style={{ fontSize: step.status === 'WAITING' ? '14px' : '16px' }}>
                    {cfg.icon}
                  </span>
                </div>

                {/* Step label */}
                <div style={{ marginTop: '10px', textAlign: 'center', padding: '0 4px' }}>
                  <div style={{
                    color: step.status === 'WAITING' ? '#64748b' : '#f1f5f9',
                    fontWeight: step.status === 'WAITING' ? 400 : 600,
                    fontSize: '12px',
                    lineHeight: '1.3',
                    maxWidth: '100px',
                    wordBreak: 'break-word',
                  }}>
                    {step.step_name}
                  </div>
                  <div style={{
                    marginTop: '4px',
                    fontSize: '10px',
                    fontWeight: 600,
                    color: cfg.labelColor,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}>
                    {statusLabel[step.status] || step.status}
                  </div>

                  {/* Reviewer info */}
                  {step.review?.reviewer_name && (
                    <div style={{
                      marginTop: '4px',
                      fontSize: '10px',
                      color: '#64748b',
                      fontStyle: 'italic',
                    }}>
                      bởi {step.review.reviewer_name}
                    </div>
                  )}
                </div>
              </div>

              {/* Connector line */}
              {!isLast && (
                <div style={{
                  flex: '0 0 40px',
                  height: '2px',
                  background: cfg.connectorColor,
                  marginTop: '22px',
                  borderRadius: '2px',
                  opacity: 0.6,
                  transition: 'background 0.3s ease',
                }} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      <style>{`
        @keyframes pulse-ring {
          0%   { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4); }
          70%  { box-shadow: 0 0 0 10px rgba(99, 102, 241, 0); }
          100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0); }
        }
      `}</style>
    </div>
  );
}

function OverallBadge({ status }) {
  const map = {
    IN_PROGRESS: { label: '⏳ Đang xử lý', bg: '#1e3a5f', color: '#60a5fa', border: '#2563eb' },
    COMPLETED:   { label: '✅ Hoàn tất',   bg: '#064e3b', color: '#34d399', border: '#059669' },
    REJECTED:    { label: '❌ Từ chối',     bg: '#450a0a', color: '#f87171', border: '#dc2626' },
  };
  const cfg = map[status] || map.IN_PROGRESS;
  return (
    <div style={{
      background: cfg.bg,
      color: cfg.color,
      border: `1px solid ${cfg.border}`,
      borderRadius: '20px',
      padding: '4px 14px',
      fontSize: '12px',
      fontWeight: 700,
      letterSpacing: '0.3px',
    }}>
      {cfg.label}
    </div>
  );
}
