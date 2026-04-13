"use client";

import { useState } from 'react';
import { spacing } from '@leafygreen-ui/tokens';
import { formatCurrency, getAppDisplayName } from './utils';

export function ManualWorkspace({ appDetail, queueData, onApprove, onDecline, addToast }) {
  const [rate, setRate] = useState(4.89);
  const [conditions, setConditions] = useState('');
  const [decided, setDecided] = useState(null);

  const appName = getAppDisplayName(appDetail, queueData);
  const product = appDetail?.product || queueData?.product || '';
  const loanAmount = appDetail?.loan_amount ? formatCurrency(appDetail.loan_amount) : (queueData?.amount || '');

  const handleApprove = () => {
    setDecided('approved');
    onApprove({ mode: 'manual', rate: `${rate.toFixed(3)}%`, conditions });
  };

  const handleDecline = () => {
    setDecided('declined');
    onDecline?.();
    if (addToast) addToast({ type: 'warning', icon: '✕', title: 'Application Declined', message: `${appName} — manually declined by officer.` });
  };

  if (decided === 'approved') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ padding: 20, background: 'var(--success-dim)', borderRadius: 8, border: '1px solid var(--success)', textAlign: 'center', maxWidth: 360 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 4px', fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 800, color: 'var(--success)' }}>&#10003;</div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, color: 'var(--success)' }}>MANUALLY APPROVED</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
            {product} @ {rate.toFixed(3)}% · {appName}
            {conditions && <><br/>Conditions: {conditions}</>}
          </div>
        </div>
      </div>
    );
  }

  if (decided === 'declined') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ padding: 20, background: 'var(--danger-dim)', borderRadius: 8, border: '1px solid var(--danger)', textAlign: 'center', maxWidth: 360 }}>
          <div style={{ fontSize: 24, marginBottom: 4 }}>✕</div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, color: 'var(--danger)' }}>DECLINED</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
            {appName} — {loanAmount} {product}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <div style={{ width: '100%', maxWidth: 460, padding: 20 }}>
        <div style={{
          padding: '8px 10px', marginBottom: 12,
          background: 'var(--bg-raised)', borderRadius: 8,
          border: '1px solid var(--border-dim)',
          fontSize: 10, color: 'var(--hitl-amber)', fontWeight: 600,
        }}>
          Agent activity log paused — manual review in progress
        </div>

        <div style={{
          padding: spacing[3], marginBottom: spacing[3],
          background: 'var(--bg-surface)', borderRadius: 8,
          border: '1px solid var(--border-base)',
        }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, marginBottom: spacing[2] }}>
            {appName}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing[2], marginBottom: spacing[2] }}>
            {[
              { label: 'Amount', value: loanAmount },
              { label: 'Product', value: product },
              { label: 'Credit Score', value: appDetail?.credit_reports?.[0]?.score ?? 'N/A' },
            ].map((item) => (
              <div key={item.label}>
                <div style={{ fontSize: 8, color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 1 }}>{item.label}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600 }}>{item.value || 'N/A'}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing[2] }}>
            {[
              { label: 'Risk Score', value: appDetail?.risk_score != null ? `${appDetail.risk_score}/100` : 'N/A', color: appDetail?.risk_score > 65 ? 'var(--danger)' : appDetail?.risk_score > 50 ? 'var(--hitl-amber)' : undefined },
              { label: 'Risk Tier', value: appDetail?.risk_tier || 'N/A' },
              { label: 'GDS', value: appDetail?.gds_ratio != null ? `${(appDetail.gds_ratio * 100).toFixed(1)}%` : 'N/A' },
              { label: 'TDS', value: appDetail?.tds_ratio != null ? `${(appDetail.tds_ratio * 100).toFixed(1)}%` : 'N/A' },
            ].map((item) => (
              <div key={item.label}>
                <div style={{ fontSize: 8, color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 1 }}>{item.label}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: item.color }}>{item.value || 'N/A'}</div>
              </div>
            ))}
          </div>
          {appDetail?.property && (
            <div style={{ marginTop: spacing[2], display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing[2] }}>
              {[
                { label: 'Property', value: appDetail.property.type || 'N/A' },
                { label: 'Location', value: appDetail.property.city || 'N/A' },
                { label: 'Documents', value: `${appDetail.documents?.length || 0} uploaded` },
              ].map((item) => (
                <div key={item.label}>
                  <div style={{ fontSize: 8, color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 1 }}>{item.label}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600 }}>{item.value}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{
          padding: spacing[3],
          background: 'var(--bg-surface)', borderRadius: 8,
          border: '1px solid var(--border-base)',
        }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
            Officer Decision
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2], marginBottom: 10 }}>
            <label htmlFor="rate-slider" style={{ fontSize: 10, color: 'var(--text-secondary)', whiteSpace: 'nowrap', minWidth: 50 }}>Rate (%):</label>
            <input id="rate-slider" type="range" min={5.0} max={9.0} step={0.125} value={rate}
              aria-label="Interest rate percentage"
              onChange={(e) => setRate(+e.target.value)}
              style={{ flex: 1, accentColor: 'var(--mongo)' }}
            />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--mongo)', minWidth: 55 }}>
              {rate.toFixed(3)}%
            </span>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label htmlFor="conditions-input" style={{ fontSize: 10, color: 'var(--text-secondary)', display: 'block', marginBottom: 3 }}>Conditions:</label>
            <input id="conditions-input" type="text" placeholder="e.g., Require 6-month reserve verification"
              value={conditions} onChange={(e) => setConditions(e.target.value)}
              style={{
                width: '100%', padding: '6px 8px', fontSize: 10, fontFamily: 'var(--font-body)',
                background: 'var(--bg-raised)', border: '1px solid var(--border-dim)',
                borderRadius: 6, color: 'var(--text-primary)', outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: spacing[2] }}>
            <button type="button" onClick={handleApprove} style={{
              flex: 1, padding: 10, borderRadius: 8, border: 'none',
              background: 'var(--mongo)', color: '#fff',
              fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11, cursor: 'pointer',
            }}>
              Approve
            </button>
            <button type="button" onClick={handleDecline} style={{
              flex: 1, padding: 10, borderRadius: 8,
              border: '1px solid var(--danger)', background: 'transparent',
              color: 'var(--danger)', fontFamily: 'var(--font-display)',
              fontWeight: 600, fontSize: 11, cursor: 'pointer',
            }}>
              Decline
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
