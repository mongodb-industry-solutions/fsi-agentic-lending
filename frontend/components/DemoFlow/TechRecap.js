"use client";

export default function TechRecap({ elapsedMs, activeFeatures }) {
  const featuresUsed = activeFeatures?.length || 6;

  const stats = [
    { label: 'Total Time', value: `${(elapsedMs / 1000).toFixed(2)}s`, color: 'var(--mongo)' },
    { label: 'Features Used', value: String(featuresUsed), color: 'var(--text-primary)' },
    { label: 'Agent Steps', value: '7', color: 'var(--agent-cyan)' },
    { label: 'Checkpoints', value: '4', color: 'var(--hitl-amber)' },
    { label: 'MongoDB Ops', value: '34', color: 'var(--voyage)' },
    { label: 'Vector Searches', value: '3', color: 'var(--voyage)' },
  ];

  const techStack = [
    { category: 'Data Platform', items: 'MongoDB Atlas — Document Model, Aggregation Framework, $graphLookup, Change Streams, Time Series, Vector Search' },
    { category: 'Orchestration', items: 'LangGraph — Orchestrator-worker pattern, interrupt(), MongoDBSaver checkpoints, MongoDBStore memory' },
    { category: 'Integration', items: 'LangChain — MongoDBAtlasVectorSearch, tool bindings, structured output' },
    { category: 'Observability', items: 'LangSmith — Full trace capture, latency profiling, agent step replay' },
    { category: 'AI Models', items: 'Claude 3.5 Sonnet (reasoning) + voyage-multimodal-3.5 (multimodal embeddings with Matryoshka dimensionality)' },
  ];

  const crossLifecycle = [
    { from: 'Origination', to: 'Decisioning', insight: 'Data created in origination improved decisioning accuracy' },
    { from: 'Decisioning', to: 'Approval', insight: 'Risk signals from decisioning informed HITL routing' },
    { from: 'Management', to: 'Underwriting', insight: 'Payment behavior in management feeds back to underwriting models' },
  ];

  const impactNumbers = [
    { label: 'Auto-decisioning rate', value: '70–83%' },
    { label: 'Document processing', value: 'seconds not hours' },
    { label: 'EWS coverage', value: '100% of portfolio' },
    { label: 'Cost reduction', value: 'up to 96%' },
  ];

  return (
    <div
      style={{
        padding: 24,
        background: 'var(--bg-surface)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-dim)',
      }}
    >
      <h3
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 18,
          fontWeight: 700,
          marginBottom: 16,
        }}
      >
        Demo Complete — Full Technical Summary
      </h3>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
          gap: 12,
          marginBottom: 20,
        }}
      >
        {stats.map((s) => (
          <div key={s.label}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: s.color }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        {techStack.map((t) => (
          <div key={t.category} style={{ display: 'flex', gap: 12, fontSize: 12, lineHeight: 1.5 }}>
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                color: 'var(--mongo)',
                minWidth: 100,
                flexShrink: 0,
              }}
            >
              {t.category}
            </span>
            <span style={{ color: 'var(--text-secondary)' }}>{t.items}</span>
          </div>
        ))}
      </div>

      {/* Cross-Lifecycle Intelligence */}
      <div style={{ padding: 16, background: 'var(--bg-base)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--mongo)', marginBottom: 16 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, color: 'var(--mongo)', marginBottom: 10 }}>
          Cross-Lifecycle Intelligence
        </div>
        {crossLifecycle.map((cl) => (
          <div key={cl.from + cl.to} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 11 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--agent-cyan)', flexShrink: 0 }}>{cl.from}</span>
            <span style={{ color: 'var(--text-dim)' }}>→</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--voyage)', flexShrink: 0 }}>{cl.to}</span>
            <span style={{ color: 'var(--text-secondary)', flex: 1 }}>{cl.insight}</span>
          </div>
        ))}
        <div style={{ fontSize: 12, color: 'var(--mongo)', fontWeight: 700, marginTop: 8 }}>
          One platform. Full lifecycle. Continuous learning.
        </div>
      </div>

      {/* By the Numbers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        {impactNumbers.map((n) => (
          <div key={n.label} style={{ padding: '10px 12px', background: 'var(--mongo-dim)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 4 }}>{n.label}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 800, color: 'var(--mongo)' }}>{n.value}</div>
          </div>
        ))}
      </div>

      <p
        style={{
          fontSize: 14,
          color: 'var(--mongo)',
          fontWeight: 700,
          fontFamily: 'var(--font-display)',
          textAlign: 'center',
          padding: '12px 0',
          borderTop: '1px solid var(--border-dim)',
          marginTop: 8,
        }}
      >
        {featuresUsed} capabilities · 1 platform · Zero data shipping
      </p>
    </div>
  );
}
