"use client";

import { useState } from 'react';
import { spacing } from '@leafygreen-ui/tokens';
import { uiTokens } from '../../lib/uiTokens';

function CollapsibleSection({ title, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderBottom: '1px solid var(--border-dim)' }}>
      <button type="button" onClick={() => setOpen(!open)} onFocus={(e) => { e.currentTarget.style.boxShadow = uiTokens.focusRing; }} onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }} style={{
        width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 0', background: 'none', border: 'none', cursor: 'pointer',
        fontFamily: uiTokens.font, fontWeight: 700, fontSize: 12,
        color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em', outline: 'none',
      }}>
        {title}
        <span style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s ease', fontSize: 10, color: 'var(--text-dim)' }}>▾</span>
      </button>
      <div style={{ maxHeight: open ? 2000 : 0, overflow: 'hidden', transition: 'max-height 0.3s ease' }}>
        {children}
      </div>
    </div>
  );
}

export default function TechRecap({ activeFeatures }) {
  const featuresUsed = activeFeatures?.length || 6;

  const stats = [
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
    { category: 'AI Models', items: 'Claude 3.5 Sonnet (reasoning) + voyage-multimodal-3.5 (multimodal embeddings with Matryoshka dimensionality)' },
  ];

  const crossLifecycle = [
    { from: 'Origination', to: 'Underwriting', insight: 'Data created in origination improved underwriting accuracy' },
    { from: 'Underwriting', to: 'Approval', insight: 'Risk signals from underwriting informed HITL routing' },
    { from: 'Approval', to: 'Closing', insight: 'Decision data drives automated document generation' },
    { from: 'Closing', to: 'Funding', insight: 'Executed contracts trigger instant disbursement' },
    { from: 'Servicing', to: 'Underwriting', insight: 'Payment behavior in servicing feeds back to underwriting models' },
  ];

  const impactNumbers = [
    { label: 'Auto-underwriting rate', value: '70–83%' },
    { label: 'Document processing', value: 'seconds not hours' },
    { label: 'EWS coverage', value: '100% of portfolio' },
    { label: 'Cost reduction', value: 'up to 96%' },
  ];

  return (
    <div
      style={{
        padding: spacing[4],
        background: 'var(--bg-surface)',
        borderRadius: 8,
        border: '1px solid var(--border-dim)',
      }}
    >
      <h3
        style={{
          fontFamily: uiTokens.font,
          fontSize: 18,
          fontWeight: 700,
          marginBottom: spacing[3],
        }}
      >
        Demo Complete — Full Technical Summary
      </h3>

      <CollapsibleSection title="Performance Stats" defaultOpen={true}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
            gap: spacing[3],
            marginBottom: spacing[400],
          }}
        >
          {stats.map((s) => (
            <div key={s.label}>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: spacing[1] }}>{s.label}</div>
              <div style={{ fontFamily: uiTokens.monoFont, fontSize: 20, fontWeight: 700, color: s.color }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Tech Stack" defaultOpen={true}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[2], marginBottom: spacing[400] }}>
          {techStack.map((t) => (
            <div key={t.category} style={{ display: 'flex', gap: spacing[3], fontSize: 12, lineHeight: 1.5 }}>
              <span
                style={{
                  fontFamily: uiTokens.font,
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
      </CollapsibleSection>

      <CollapsibleSection title="Cross-Lifecycle Intelligence" defaultOpen={false}>
        {/* Cross-Lifecycle Intelligence */}
        <div style={{ padding: spacing[3], background: 'var(--bg-base)', borderRadius: 8, border: '1px dashed var(--mongo)', marginBottom: spacing[3] }}>
          {crossLifecycle.map((cl) => (
            <div key={cl.from + cl.to} style={{ display: 'flex', alignItems: 'center', gap: spacing[2], marginBottom: spacing[150], fontSize: 11 }}>
              <span style={{ fontFamily: uiTokens.monoFont, fontWeight: 700, color: 'var(--agent-cyan)', flexShrink: 0 }}>{cl.from}</span>
              <span style={{ color: 'var(--text-dim)' }}>→</span>
              <span style={{ fontFamily: uiTokens.monoFont, fontWeight: 700, color: 'var(--voyage)', flexShrink: 0 }}>{cl.to}</span>
              <span style={{ color: 'var(--text-secondary)', flex: 1 }}>{cl.insight}</span>
            </div>
          ))}
          <div style={{ fontSize: 12, color: 'var(--mongo)', fontWeight: 700, marginTop: spacing[2] }}>
            One platform. Full lifecycle. Continuous learning.
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="By the Numbers" defaultOpen={false}>
        {/* By the Numbers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: spacing[200], marginBottom: spacing[3] }}>
          {impactNumbers.map((n) => (
            <div key={n.label} style={{ padding: `${spacing[200]}px ${spacing[3]}px`, background: 'var(--mongo-dim)', borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: spacing[1] }}>{n.label}</div>
              <div style={{ fontFamily: uiTokens.monoFont, fontSize: 14, fontWeight: 800, color: 'var(--mongo)' }}>{n.value}</div>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      <p
        style={{
          fontSize: 14,
          color: 'var(--mongo)',
          fontWeight: 700,
          fontFamily: uiTokens.font,
          textAlign: 'center',
          padding: `${spacing[3]}px 0`,
          borderTop: '1px solid var(--border-dim)',
          marginTop: spacing[2],
        }}
      >
        {featuresUsed} capabilities · 1 platform · Zero data shipping
      </p>
    </div>
  );
}
