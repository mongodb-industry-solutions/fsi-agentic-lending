"use client";

import Icon from '@leafygreen-ui/icon';
import { palette } from '@leafygreen-ui/palette';
import { spacing } from '@leafygreen-ui/tokens';
import { APPLICANT, DOCUMENTS } from '../../../lib/data/applicant';
import { uiTokens } from '../../../lib/uiTokens';

function docStatusForStep(stepIndex, docId) {
  if (stepIndex < 0) return 'pending';
  const order = ['doc-employment', 'doc-bank', 'doc-credit', 'doc-tax'];
  const idx = order.indexOf(docId);
  if (idx < 0) return 'pending';
  if (stepIndex >= 5) return 'verified';
  if (stepIndex >= 2 && idx < 2) return 'processing';
  if (stepIndex >= 3 && idx < 3) return 'processing';
  if (stepIndex >= 4) return 'verified';
  return 'pending';
}

export default function ApplicantCard({ stepIndex }) {
  return (
    <div
      style={{
        padding: spacing[3],
        background: 'var(--bg-surface)',
        borderRadius: 8,
        border: '1px solid var(--border-dim)',
        marginBottom: spacing[3],
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing[3], marginBottom: spacing[300] }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 8,
            background: `linear-gradient(135deg, ${palette.green.dark3}, ${palette.green.dark3}cc)`,
            border: '1px solid var(--mongo)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
          }}
        >
          <Icon glyph="Person" size={20} fill={palette.white} />
        </div>
        <div>
          <div style={{ fontFamily: uiTokens.font, fontWeight: 700, fontSize: 15 }}>
            {APPLICANT.name}
          </div>
          <div style={{ fontFamily: uiTokens.monoFont, fontSize: 11, color: 'var(--text-dim)' }}>
            {APPLICANT.id}
          </div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing[200] }}>
        <div>
          <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: spacing[100] }}>
            Purchase Price
          </div>
          <div style={{ fontFamily: uiTokens.monoFont, fontSize: 12, color: 'var(--mongo)' }}>
            {APPLICANT.purchasePrice}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: spacing[100] }}>
            Product
          </div>
          <div style={{ fontFamily: uiTokens.monoFont, fontSize: 12 }}>{APPLICANT.product}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: spacing[100] }}>
            Equifax
          </div>
          <div style={{ fontFamily: uiTokens.monoFont, fontSize: 12, color: 'var(--mongo)' }}>
            {APPLICANT.equifax}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: spacing[100] }}>
            GDS
          </div>
          <div style={{ fontFamily: uiTokens.monoFont, fontSize: 12 }}>{APPLICANT.gds}</div>
        </div>
      </div>
      <div style={{ marginTop: spacing[3], fontFamily: uiTokens.font, fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', marginBottom: spacing[2] }}>
        Documents {DOCUMENTS.filter((d) => docStatusForStep(stepIndex, d.id) === 'verified').length}/4
      </div>
      {DOCUMENTS.map((d) => {
        const status = docStatusForStep(stepIndex, d.id);
        return (
          <div
            key={d.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing[200],
              padding: `${spacing[2]}px 0`,
              borderBottom: '1px solid var(--border-dim)',
              fontSize: 12,
            }}
          >
            <span style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--bg-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon glyph={d.glyph || 'File'} size={14} />
            </span>
            <span style={{ flex: 1, fontWeight: 500 }}>{d.name}</span>
            <span
              style={{
                fontFamily: uiTokens.monoFont,
                fontSize: 10,
                fontWeight: 600,
                padding: `2px ${spacing[150]}px`,
                borderRadius: 8,
                background:
                  status === 'verified'
                    ? 'var(--success-dim)'
                    : status === 'processing'
                      ? 'var(--agent-cyan-dim)'
                      : 'var(--hitl-amber-dim)',
                color:
                  status === 'verified'
                    ? 'var(--success)'
                    : status === 'processing'
                      ? 'var(--agent-cyan)'
                      : 'var(--hitl-amber)',
              }}
            >
              {status === 'verified' ? 'Verified' : status === 'processing' ? 'Processing' : 'Pending'}
            </span>
          </div>
        );
      })}
    </div>
  );
}
