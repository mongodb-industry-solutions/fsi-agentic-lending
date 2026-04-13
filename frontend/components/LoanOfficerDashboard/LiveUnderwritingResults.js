export function LiveUnderwritingResults({ data }) {
  if (!data || Object.keys(data).length === 0) return null;

  const hasOrigination = data.documents_verified != null || data.primary_credit_score != null;
  const hasDecisioning = data.risk_score != null;

  if (!hasOrigination && !hasDecisioning) return null;

  const getRiskColor = (score) => {
    if (score == null) return 'var(--text-dim)';
    if (score <= 30) return 'var(--success)';
    if (score <= 50) return 'var(--mongo)';
    if (score <= 65) return 'var(--hitl-amber)';
    return 'var(--danger)';
  };

  return (
    <div style={{
      position: 'absolute', top: 12, right: 12, zIndex: 10,
      padding: '10px 12px', width: 220,
      background: 'var(--bg-overlay-alpha)',
      backdropFilter: 'blur(8px)',
      borderRadius: 8,
      border: '1px solid var(--agent-cyan)',
      animation: 'slideDown 0.3s ease-out',
    }}>
      <div style={{
        fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px',
        color: 'var(--agent-cyan)', marginBottom: 8,
      }}>
        Live Results
      </div>

      {hasOrigination && !hasDecisioning && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {data.document_count != null && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9 }}>
              <span style={{ color: 'var(--text-dim)' }}>Documents</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)' }}>
                {data.document_count} {data.documents_verified ? '\u2713' : ''}
              </span>
            </div>
          )}
          {data.primary_credit_score != null && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9 }}>
              <span style={{ color: 'var(--text-dim)' }}>Credit Score</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: data.primary_credit_score >= 680 ? 'var(--success)' : 'var(--hitl-amber)' }}>
                {data.primary_credit_score}
              </span>
            </div>
          )}
          {data.extraction_summary && (
            <div style={{ fontSize: 8, color: 'var(--text-secondary)', lineHeight: 1.4, marginTop: 2 }}>
              {data.extraction_summary.slice(0, 100)}
            </div>
          )}
        </div>
      )}

      {hasDecisioning && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 2 }}>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 800,
              color: getRiskColor(data.risk_score),
              lineHeight: 1,
            }}>
              {data.risk_score}
            </span>
            <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>/ 100</span>
            {data.risk_tier && (
              <span style={{
                fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
                background: data.risk_score <= 30 ? 'var(--success-dim)' : data.risk_score <= 50 ? 'var(--mongo-dim)' : data.risk_score <= 65 ? 'var(--hitl-amber-dim)' : 'var(--danger-dim)',
                color: getRiskColor(data.risk_score),
              }}>
                {data.risk_tier}
              </span>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
            {data.gds_ratio != null && (
              <div style={{ fontSize: 9 }}>
                <span style={{ color: 'var(--text-dim)' }}>GDS </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: data.gds_ratio > 0.39 ? 'var(--danger)' : 'var(--text-primary)' }}>
                  {(data.gds_ratio * 100).toFixed(1)}%
                </span>
              </div>
            )}
            {data.tds_ratio != null && (
              <div style={{ fontSize: 9 }}>
                <span style={{ color: 'var(--text-dim)' }}>TDS </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: data.tds_ratio > 0.44 ? 'var(--danger)' : 'var(--text-primary)' }}>
                  {(data.tds_ratio * 100).toFixed(1)}%
                </span>
              </div>
            )}
          </div>
          {data.stress_rate != null && data.stress_gds != null && data.stress_tds != null && (
            <div style={{ fontSize: 9, marginTop: 2 }}>
              <span style={{ color: 'var(--text-dim)' }}>Stress Test </span>
              <span style={{
                fontFamily: 'var(--font-mono)', fontWeight: 700,
                color: (data.stress_gds > 0.39 || data.stress_tds > 0.44) ? 'var(--danger)' : 'var(--success)',
              }}>
                {(data.stress_gds > 0.39 || data.stress_tds > 0.44) ? 'FAIL' : 'PASS'}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-dim)', marginLeft: 4 }}>
                @ {(data.stress_rate * 100).toFixed(2)}%
              </span>
            </div>
          )}
          {data.decision && (
            <div style={{
              fontSize: 9, fontWeight: 700, marginTop: 4, padding: '3px 6px',
              borderRadius: 4,
              background: data.decision === 'approve' ? 'var(--success-dim)' : data.decision === 'decline' ? 'var(--danger-dim)' : 'var(--hitl-amber-dim)',
              color: data.decision === 'approve' ? 'var(--success)' : data.decision === 'decline' ? 'var(--danger)' : 'var(--hitl-amber)',
              textTransform: 'uppercase',
            }}>
              {data.decision === 'escalate' ? 'Escalated to HITL' : data.decision}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
