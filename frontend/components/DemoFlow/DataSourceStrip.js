"use client";

const SCENE_DATA_SOURCES = {
  origination: {
    structured: [
      { label: 'Borrower Profile', icon: '👤' },
    ],
    unstructured: [
      { label: 'Borrower Documents', icon: '📄' },
      { label: 'Comm Logs', icon: '💬' },
      { label: 'IDs Verification', icon: '🪪' },
      { label: 'Application Form', icon: '📋' },
    ],
  },
  decisioning: {
    structured: [
      { label: 'Lending Ratios', icon: '📊' },
      { label: 'Finance Data', icon: '💹' },
    ],
    unstructured: [
      { label: 'Financial Scores', icon: '🏦' },
      { label: 'Credit Reports', icon: '📑' },
      { label: '3rd Party Social Media', icon: '🌐' },
    ],
  },
  approval: {
    structured: [
      { label: 'Risk Assessment', icon: '🎯' },
      { label: 'Aggregated Score', icon: '📈' },
    ],
    unstructured: [
      { label: 'Guidelines & Regulation', icon: '📜' },
      { label: 'Underwriting Policies', icon: '⚖️' },
    ],
  },
  funding: {
    structured: [
      { label: 'Approved Terms', icon: '✅' },
      { label: 'Contract Data', icon: '📋' },
    ],
    unstructured: [
      { label: 'Committed Rates/Offers', icon: '🔒' },
      { label: 'Regulatory Disclosures', icon: '📜' },
    ],
  },
  management: {
    structured: [
      { label: 'Credit & Payments History', icon: '💳' },
      { label: 'Payment Records', icon: '📒' },
    ],
    unstructured: [
      { label: 'Published Rates/Offers', icon: '📰' },
      { label: 'Renewal Contract', icon: '📝' },
    ],
  },
};

function Pill({ item, status }) {
  const processing = status === 'processing';
  const ingested = status === 'ingested';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 8px',
        borderRadius: 12,
        fontSize: 9,
        fontWeight: 600,
        background: ingested
          ? item._type === 'structured' ? 'rgba(0,237,100,0.08)' : 'rgba(59,130,246,0.08)'
          : 'var(--bg-raised)',
        color: ingested
          ? item._type === 'structured' ? 'var(--mongo)' : 'var(--tool-blue)'
          : 'var(--text-dim)',
        border: `1px solid ${
          ingested
            ? item._type === 'structured' ? 'rgba(0,237,100,0.2)' : 'rgba(59,130,246,0.2)'
            : 'var(--border-dim)'
        }`,
        transition: 'all 0.4s ease-out',
        animation: processing ? 'pulse 1.2s infinite' : undefined,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ fontSize: 10 }}>{item.icon}</span>
      {item.label}
      {ingested && <span style={{ fontSize: 8, marginLeft: 2 }}>✓</span>}
    </span>
  );
}

export default function DataSourceStrip({ sceneKey, sceneStep, totalSteps }) {
  const sources = SCENE_DATA_SOURCES[sceneKey];
  if (!sources) return null;

  const progress = totalSteps > 0 ? Math.min(sceneStep / (totalSteps - 1), 1) : 0;

  const getStatus = (idx, total) => {
    if (sceneStep < 0) return 'pending';
    const threshold = (idx / total) * 0.8;
    if (progress >= threshold + 0.2) return 'ingested';
    if (progress >= threshold) return 'processing';
    return 'pending';
  };

  const structuredItems = sources.structured.map((s) => ({ ...s, _type: 'structured' }));
  const unstructuredItems = sources.unstructured.map((s) => ({ ...s, _type: 'unstructured' }));

  return (
    <div
      style={{
        display: 'flex',
        gap: 16,
        padding: '8px 16px',
        borderBottom: '1px solid var(--border-dim)',
        background: 'var(--bg-base)',
        flexWrap: 'wrap',
        alignItems: 'center',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--mongo)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Structured
        </span>
        {structuredItems.map((item, i) => (
          <Pill key={item.label} item={item} status={getStatus(i, structuredItems.length)} />
        ))}
      </div>
      <div style={{ width: 1, height: 20, background: 'var(--border-dim)' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--tool-blue)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Unstructured
        </span>
        {unstructuredItems.map((item, i) => (
          <Pill key={item.label} item={item} status={getStatus(i, unstructuredItems.length)} />
        ))}
      </div>
    </div>
  );
}
