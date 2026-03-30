"use client";

import { APPLICANT, DOCUMENTS } from '../../../lib/data/applicant';

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
        padding: 16,
        background: 'var(--bg-surface)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-dim)',
        marginBottom: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: 'linear-gradient(135deg,#1a3a2a,#0d2818)',
            border: '1px solid var(--mongo)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
          }}
        >
          👤
        </div>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>
            {APPLICANT.name}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)' }}>
            {APPLICANT.id}
          </div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 3 }}>
            Loan Amount
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--mongo)' }}>
            {APPLICANT.loanAmount}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 3 }}>
            Product
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{APPLICANT.product}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 3 }}>
            Equifax
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--mongo)' }}>
            {APPLICANT.equifax}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 3 }}>
            GDS
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{APPLICANT.gds}</div>
        </div>
      </div>
      <div style={{ marginTop: 12, fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 8 }}>
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
              gap: 10,
              padding: '8px 0',
              borderBottom: '1px solid var(--border-dim)',
              fontSize: 12,
            }}
          >
            <span style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--bg-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {d.icon}
            </span>
            <span style={{ flex: 1, fontWeight: 500 }}>{d.name}</span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                fontWeight: 600,
                padding: '2px 6px',
                borderRadius: 4,
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
