"use client";

import { useEffect, useRef, useCallback } from 'react';
import { CAPABILITIES } from '../../lib/data/capabilities';
import { architectureContent } from '../../lib/data/narrativeContent';
import InsightCard from '../insights/InsightCard';
import CodeSnippet from '../CodeSnippet/CodeSnippet';
import { useEducationalContext } from './useEducationalContext';
import { colorMap, dimMap } from '../../lib/data/colorMaps';

const screenTitles = {
  borrower: 'Borrower Portal — Technology Reference',
  officer: 'Loan Officer Dashboard — Technology Reference',
  demo: 'LendFlow AI — Technology Reference',
};

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function SectionHeader({ children }) {
  return (
    <div style={{
      position: 'sticky',
      top: 0,
      zIndex: 2,
      padding: '10px 16px',
      background: 'var(--bg-base)',
      borderBottom: '1px solid var(--border-dim)',
      fontSize: 10,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      color: 'var(--text-dim)',
    }}>
      {children}
    </div>
  );
}

function CapabilitySection({ cap }) {
  const accent = colorMap[cap.colorVar] || colorMap.mongo;
  const dim = dimMap[cap.colorVar] || dimMap.mongo;

  return (
    <InsightCard
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span>{cap.icon}</span>
          <span style={{ color: accent }}>{cap.label}</span>
        </span>
      }
      icon={null}
    >
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
        {cap.oneLiner}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 8 }}>
        {cap.description}
      </div>
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 8,
        background: dim,
        fontSize: 10,
        color: accent,
        fontWeight: 600,
        marginBottom: 8,
      }}>
        Replaces: {cap.replaces}
      </div>
      <CodeSnippet code={cap.code} />
      <div style={{ marginTop: 6, fontSize: 9, color: 'var(--text-dim)' }}>
        {cap.demoScene}
      </div>
    </InsightCard>
  );
}

const agentIcons = { supervisor: '🧠', loanAppAgent: '📋', underwritingAgent: '📊', renewalAgent: '🔄' };

function AgentSection({ agentKey }) {
  const agent = architectureContent.agentDescriptions[agentKey];
  if (!agent) return null;

  return (
    <InsightCard title={agent.name} icon={agentIcons[agentKey] ?? '🤖'}>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 8 }}>
        {agent.responsibilities}
      </div>
      {agent.tools && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 4 }}>Tools</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {agent.tools.map((tool, i) => (
              <span key={i} style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                padding: '2px 6px',
                borderRadius: 8,
                fontSize: 9,
                fontWeight: 600,
                background: dimMap[tool.colorVar] || dimMap.mongo,
                color: colorMap[tool.colorVar] || colorMap.mongo,
                border: `1px solid ${colorMap[tool.colorVar] || colorMap.mongo}22`,
              }}>
                <span style={{ fontSize: 10 }}>{tool.icon}</span>
                {tool.label}
              </span>
            ))}
          </div>
        </div>
      )}
      {agent.collections && (
        <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
          <span style={{ fontWeight: 700 }}>Collections:</span> {agent.collections}
        </div>
      )}
      {agent.capabilities && (
        <div style={{ marginTop: 6 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 4 }}>Capabilities</div>
          <ul style={{ margin: 0, paddingLeft: 14, fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
            {agent.capabilities.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        </div>
      )}
      {agent.productionNote && (
        <div style={{ marginTop: 8, padding: '6px 8px', background: 'var(--bg-raised)', borderRadius: 'var(--radius-sm)', fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.5 }}>
          {agent.productionNote}
        </div>
      )}
    </InsightCard>
  );
}

function HITLSection() {
  const hitl = architectureContent.hitlExplanation;
  return (
    <InsightCard title={hitl.title} icon="🛡">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
        {hitl.tiers.map((t, i) => (
          <div key={i} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 8px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-raised)',
            fontSize: 10,
          }}>
            <span style={{
              fontWeight: 700,
              color: i === 0 ? 'var(--success)' : i === 1 ? 'var(--hitl-amber)' : 'var(--danger)',
              minWidth: 90,
            }}>
              {t.tier}
            </span>
            <span style={{ color: 'var(--text-secondary)' }}>{t.desc}</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 8 }}>
        {hitl.persistence}
      </div>
      <CodeSnippet code={hitl.codeSample} />
    </InsightCard>
  );
}

function LangSmithSection() {
  const ls = architectureContent.langsmithDescription;
  return (
    <InsightCard title={ls.title} icon="🔍">
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 10 }}>
        {ls.body}
      </div>
      <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 6 }}>
        Trace Waterfall
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {ls.traceSteps.map((step, i) => (
          <div key={i} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '3px 6px',
            borderRadius: 4,
            background: i % 2 === 0 ? 'var(--bg-raised)' : 'transparent',
            fontSize: 10,
          }}>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', width: 14, textAlign: 'right', flexShrink: 0 }}>
              {i + 1}
            </span>
            <span style={{ flex: 1, color: 'var(--text-secondary)' }}>{step.label}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: typeof step.ms === 'number' ? 'var(--mongo)' : 'var(--hitl-amber)', fontSize: 9 }}>
              {typeof step.ms === 'number' ? `${step.ms}ms` : step.ms}
            </span>
          </div>
        ))}
      </div>
    </InsightCard>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Panel                                                         */
/* ------------------------------------------------------------------ */

export default function InfoWizardPanel({ isOpen, onClose, activeScreen = 'demo', scrollToSection }) {
  const panelRef = useRef(null);
  const { resetAll } = useEducationalContext();

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      panelRef.current?.focus();
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  useEffect(() => {
    if (!isOpen) return;
    const panel = panelRef.current;
    if (!panel) return;
    const trap = (e) => {
      if (e.key !== 'Tab') return;
      const focusable = panel.querySelectorAll(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    panel.addEventListener('keydown', trap);
    return () => panel.removeEventListener('keydown', trap);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && scrollToSection && panelRef.current) {
      const el = panelRef.current.querySelector(`[data-section="${scrollToSection}"]`);
      if (el) {
        const PANEL_TRANSITION_MS = 300;
        setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), PANEL_TRANSITION_MS + 50);
      }
    }
  }, [isOpen, scrollToSection]);

  const title = screenTitles[activeScreen] || screenTitles.demo;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 998,
          background: 'rgba(0,0,0,0.20)',
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 0.3s ease',
        }}
      />

      {/* Panel */}
      <aside
        ref={panelRef}
        role="dialog"
        aria-label={title}
        aria-modal={isOpen ? "true" : undefined}
        aria-hidden={!isOpen}
        tabIndex={-1}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          zIndex: 999,
          width: 400,
          maxWidth: '100vw',
          background: 'var(--bg-base)',
          borderLeft: '1px solid var(--border-base)',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.08)',
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s ease',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-dim)',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 16 }}>📖</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
              {title}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
              MongoDB capabilities and architecture
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-dim)',
              fontSize: 18,
              padding: 4,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          {/* Stack overview */}
          <SectionHeader>Stack Overview</SectionHeader>
          <div style={{ padding: '12px 16px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
              {architectureContent.pageTitle}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {architectureContent.pageIntro}
            </div>
          </div>

          {/* MongoDB Capabilities */}
          <SectionHeader>MongoDB Capabilities ({CAPABILITIES.length})</SectionHeader>
          <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {CAPABILITIES.map((cap) => (
              <div key={cap.id} data-section={cap.id}>
                <CapabilitySection cap={cap} />
              </div>
            ))}
          </div>

          {/* Agents */}
          <SectionHeader>AI Agents</SectionHeader>
          <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Object.keys(architectureContent.agentDescriptions).map((key) => (
              <div key={key} data-section={key}>
                <AgentSection agentKey={key} />
              </div>
            ))}
          </div>

          {/* HITL */}
          <SectionHeader>Human-in-the-Loop</SectionHeader>
          <div style={{ padding: '8px 12px' }} data-section="hitl">
            <HITLSection />
          </div>

          {/* LangSmith */}
          <SectionHeader>Observability</SectionHeader>
          <div style={{ padding: '8px 12px' }} data-section="langsmith">
            <LangSmithSection />
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '10px 16px',
          borderTop: '1px solid var(--border-dim)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>
            LendFlow AI Educational Panel
          </span>
          <button
            type="button"
            onClick={() => {
              resetAll();
              onClose();
            }}
            style={{
              padding: '4px 10px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-dim)',
              background: 'transparent',
              color: 'var(--text-dim)',
              fontSize: 10,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            Reset Tour
          </button>
        </div>
      </aside>
    </>
  );
}
