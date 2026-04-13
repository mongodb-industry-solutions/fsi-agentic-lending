"use client";

import ApplicantCard from './ApplicantCard';
import WhatIfSliders from './WhatIfSliders';

export default function ContextPanel({ panel, stepIndex }) {
  if (panel === 'explain') {
    return <WhatIfSliders />;
  }
  if (panel === 'fraud') {
    return (
      <div style={{ padding: 12, background: 'var(--bg-surface)', borderRadius: 8, fontSize: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>$graphLookup result</div>
        <div style={{ color: 'var(--success)' }}>CLEAR ✓</div>
        <div style={{ color: 'var(--text-secondary)', marginTop: 4 }}>2,847 entities scanned, 0 suspicious links.</div>
      </div>
    );
  }
  if (panel === 'streaming') {
    return (
      <div style={{ padding: 12, background: 'var(--bg-surface)', borderRadius: 8, fontSize: 11, color: 'var(--text-secondary)' }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Change Stream events</div>
        <div>insert → loanApplications · update → doc_validated · insert → riskScores</div>
      </div>
    );
  }
  return <ApplicantCard stepIndex={stepIndex} />;
}
