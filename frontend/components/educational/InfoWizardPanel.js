"use client";

import { useEffect, useRef, useCallback } from 'react';
import Icon from '@leafygreen-ui/icon';
import { spacing } from '@leafygreen-ui/tokens';
import { CAPABILITIES } from '../../lib/data/capabilities';
import { architectureContent } from '../../lib/data/narrativeContent';
import InsightCard from '../insights/InsightCard';
import CodeSnippet from '../CodeSnippet/CodeSnippet';
import { useEducationalContext } from './useEducationalContext';
import { colorMap, dimMap } from '../../lib/data/colorMaps';
import { uiTokens } from '../../lib/uiTokens';

const screenTitles = {
  borrower: 'Borrower Portal — Technology Reference',
  officer: 'Loan Officer Dashboard — Technology Reference',
  risk: 'Business Loan Risk Assessor — Technology Reference',
  demo: 'Agentic Lending — Technology Reference',
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
      padding: `${spacing[200]}px ${spacing[3]}px`,
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
          {cap.glyph && <Icon glyph={cap.glyph} size={14} />}
          <span style={{ color: accent }}>{cap.label}</span>
        </span>
      }
      icon={null}
    >
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: spacing[1] }}>
        {cap.oneLiner}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: spacing[2] }}>
        {cap.description}
      </div>
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: spacing[1],
        padding: `2px ${spacing[2]}px`,
        borderRadius: 8,
        background: dim,
        fontSize: 10,
        color: accent,
        fontWeight: 600,
        marginBottom: spacing[2],
      }}>
        Replaces: {cap.replaces}
      </div>
      <CodeSnippet code={cap.code} />
      <div style={{ marginTop: spacing[150], fontSize: 9, color: 'var(--text-dim)' }}>
        {cap.demoScene}
      </div>
    </InsightCard>
  );
}

const agentGlyphs = {
  supervisor: 'Beaker',
  docVerifier: 'File',
  creditPuller: 'CreditCard',
  loanAppAgent: 'Apps',
  underwritingAgent: 'Charts',
  applicationAgent: 'Sparkle',
};

function AgentSection({ agentKey }) {
  const agent = architectureContent.agentDescriptions[agentKey];
  if (!agent) return null;

  return (
    <InsightCard title={agent.name} icon={<Icon glyph={agentGlyphs[agentKey] ?? 'Apps'} size={14} />}>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: spacing[2] }}>
        {agent.responsibilities}
      </div>
      {agent.tools && (
        <div style={{ marginBottom: spacing[2] }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: spacing[1] }}>Tools</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing[1] }}>
            {agent.tools.map((tool, i) => (
              <span key={i} style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                padding: `2px ${spacing[150]}px`,
                borderRadius: 8,
                fontSize: 9,
                fontWeight: 600,
                background: dimMap[tool.colorVar] || dimMap.mongo,
                color: colorMap[tool.colorVar] || colorMap.mongo,
                border: `1px solid ${colorMap[tool.colorVar] || colorMap.mongo}22`,
              }}>
                {tool.glyph && <Icon glyph={tool.glyph} size={10} />}
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
        <div style={{ marginTop: spacing[150] }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: spacing[1] }}>Capabilities</div>
          <ul style={{ margin: 0, paddingLeft: 14, fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
            {agent.capabilities.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        </div>
      )}
      {agent.productionNote && (
        <div style={{ marginTop: spacing[2], padding: `${spacing[150]}px ${spacing[2]}px`, background: 'var(--bg-raised)', borderRadius: 8, fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.5 }}>
          {agent.productionNote}
        </div>
      )}
    </InsightCard>
  );
}

function InterventionSection() {
  const intv = architectureContent.interventionSystem;
  if (!intv) return null;
  return (
    <InsightCard title={intv.title} icon={<Icon glyph="Warning" size={14} />}>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: spacing[2] }}>
        {intv.description}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[1], marginBottom: spacing[200] }}>
        {intv.types.map((t, i) => (
          <div key={i} style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: spacing[2],
            padding: `${spacing[150]}px ${spacing[2]}px`,
            borderRadius: 8,
            background: 'var(--bg-raised)',
            fontSize: 10,
          }}>
            <span style={{
              fontWeight: 700,
              color: t.severity === 'blocking' ? 'var(--danger)' : 'var(--hitl-amber)',
              minWidth: 62,
              flexShrink: 0,
              fontSize: 9,
              textTransform: 'uppercase',
            }}>
              {t.severity}
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono, monospace)', fontSize: 10 }}>
                {t.type}
              </div>
              <div style={{ color: 'var(--text-dim)', fontSize: 9, marginTop: 1 }}>
                {t.source} — {t.desc}
              </div>
            </div>
          </div>
        ))}
      </div>
      <CodeSnippet code={intv.codeSample} />
    </InsightCard>
  );
}

function GenerativeUISection() {
  const genUI = architectureContent.generativeUI;
  if (!genUI) return null;
  return (
    <InsightCard title={genUI.title} icon={<Icon glyph="Wizard" size={14} />}>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: spacing[2] }}>
        {genUI.description}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[1] }}>
        {genUI.components.map((c, i) => (
          <div key={i} style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing[2],
            padding: `${spacing[150]}px ${spacing[2]}px`,
            borderRadius: 8,
            background: 'var(--bg-raised)',
            fontSize: 10,
          }}>
            <div style={{ flex: 1 }}>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</span>
              <span style={{ color: 'var(--text-secondary)', marginLeft: spacing[1] }}>{c.desc}</span>
            </div>
            {c.interactive && (
              <span style={{
                padding: `1px ${spacing[150]}px`,
                borderRadius: 6,
                background: dimMap['agent-cyan'] || 'var(--agent-cyan-dim)',
                color: colorMap['agent-cyan'] || 'var(--agent-cyan)',
                fontSize: 8,
                fontWeight: 700,
                textTransform: 'uppercase',
                flexShrink: 0,
              }}>
                Interactive
              </span>
            )}
          </div>
        ))}
      </div>
    </InsightCard>
  );
}

function HITLSection() {
  const hitl = architectureContent.hitlExplanation;
  if (!hitl) return null;
  return (
    <InsightCard title={hitl.title} icon={<Icon glyph="Lock" size={14} />}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[150], marginBottom: spacing[200] }}>
        {hitl.tiers.map((t, i) => (
          <div key={i} style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing[2],
            padding: `${spacing[150]}px ${spacing[2]}px`,
            borderRadius: 8,
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
      {hitl.officerActions && (
        <div style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: spacing[2] }}>
          {hitl.officerActions}
        </div>
      )}
      <div style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: spacing[2] }}>
        {hitl.persistence}
      </div>
      <CodeSnippet code={hitl.codeSample} />
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
          boxShadow: uiTokens.shadowElevated,
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
          gap: spacing[2],
          padding: `${spacing[3]}px ${spacing[3]}px`,
          borderBottom: '1px solid var(--border-dim)',
          flexShrink: 0,
        }}>
          <Icon glyph="University" size={16} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: uiTokens.font, fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
              {title}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
              MongoDB capabilities and architecture
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            onFocus={(e) => { e.currentTarget.style.boxShadow = uiTokens.focusRing; }}
            onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
            aria-label="Close panel"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-dim)',
              fontSize: 18,
              padding: spacing[1],
              lineHeight: 1,
              outline: 'none',
            }}
          >
            ×
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          {/* Stack overview */}
          <SectionHeader>Stack Overview</SectionHeader>
          <div style={{ padding: `${spacing[3]}px ${spacing[3]}px` }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: spacing[1] }}>
              {architectureContent.pageTitle}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {architectureContent.pageIntro}
            </div>
          </div>

          {/* MongoDB Capabilities */}
          <SectionHeader>MongoDB Capabilities ({CAPABILITIES.length})</SectionHeader>
          <div style={{ padding: `${spacing[2]}px ${spacing[3]}px`, display: 'flex', flexDirection: 'column', gap: spacing[2] }}>
            {CAPABILITIES.map((cap) => (
              <div key={cap.id} data-section={cap.id}>
                <CapabilitySection cap={cap} />
              </div>
            ))}
          </div>

          {/* Agents */}
          <SectionHeader>AI Agents</SectionHeader>
          <div style={{ padding: `${spacing[2]}px ${spacing[3]}px`, display: 'flex', flexDirection: 'column', gap: spacing[2] }}>
            {Object.keys(architectureContent.agentDescriptions).map((key) => (
              <div key={key} data-section={key}>
                <AgentSection agentKey={key} />
              </div>
            ))}
          </div>

          {/* Interventions */}
          <SectionHeader>Intervention System</SectionHeader>
          <div style={{ padding: `${spacing[2]}px ${spacing[3]}px` }} data-section="interventions">
            <InterventionSection />
          </div>

          {/* Generative UI */}
          <SectionHeader>Generative UI</SectionHeader>
          <div style={{ padding: `${spacing[2]}px ${spacing[3]}px` }} data-section="generativeUI">
            <GenerativeUISection />
          </div>

          {/* HITL */}
          <SectionHeader>Human-in-the-Loop</SectionHeader>
          <div style={{ padding: `${spacing[2]}px ${spacing[3]}px` }} data-section="hitl">
            <HITLSection />
          </div>

        </div>

        {/* Footer */}
        <div style={{
          padding: `${spacing[200]}px ${spacing[3]}px`,
          borderTop: '1px solid var(--border-dim)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>
            Agentic Lending Educational Panel
          </span>
          <button
            type="button"
            onClick={() => {
              resetAll();
              onClose();
            }}
            onFocus={(e) => { e.currentTarget.style.boxShadow = uiTokens.focusRing; }}
            onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
            style={{
              padding: `${spacing[1]}px ${spacing[200]}px`,
              borderRadius: 8,
              border: '1px solid var(--border-dim)',
              background: 'transparent',
              color: 'var(--text-dim)',
              fontSize: 10,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              outline: 'none',
            }}
          >
            Reset Tour
          </button>
        </div>
      </aside>
    </>
  );
}
