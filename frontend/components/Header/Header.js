"use client";

import { useState, useEffect } from 'react';
import { palette } from '@leafygreen-ui/palette';
import { spacing } from '@leafygreen-ui/tokens';
import Icon from '@leafygreen-ui/icon';
import { apiPost } from '../../lib/api';
import styles from './Header.module.css';

const SCREENS = [
  { id: "borrower", label: "Borrower Portal", shortLabel: "Borrower" },
  { id: "officer", label: "Loan Officer", shortLabel: "Officer" },
  { id: "demo", label: "Demo Flow", shortLabel: "Demo" },
];

export default function Header({ activeScreen, onScreenChange, onInfoOpen }) {
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [compact, setCompact] = useState(false);
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    setHasSession(!!sessionStorage.getItem('lendflow_demo_session'));
    const mqCompact = window.matchMedia('(max-width: 768px)');
    const mqNarrow = window.matchMedia('(max-width: 640px)');
    setCompact(mqCompact.matches);
    setNarrow(mqNarrow.matches);
    const onCompact = (e) => setCompact(e.matches);
    const onNarrow = (e) => setNarrow(e.matches);
    mqCompact.addEventListener('change', onCompact);
    mqNarrow.addEventListener('change', onNarrow);
    return () => {
      mqCompact.removeEventListener('change', onCompact);
      mqNarrow.removeEventListener('change', onNarrow);
    };
  }, []);

  const handleReset = async () => {
    setResetting(true);
    await apiPost('/demo/reset', {}, { 'X-Demo-Reset': 'confirm' });
    sessionStorage.removeItem('lendflow_demo_session');
    setResetting(false);
    setShowResetModal(false);
    window.location.reload();
  };

  return (
    <header
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 200,
        height: 52,
        padding: `0 ${narrow ? spacing[3] : spacing[6]}px`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: palette.green.dark3,
        borderBottom: `1px solid rgba(255,255,255,0.08)`,
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: spacing[3] }}>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: "var(--radius-sm)",
            background: `linear-gradient(135deg, ${palette.green.dark1} 0%, ${palette.green.base} 100%)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: 15,
            color: "#fff",
            position: "relative",
            overflow: "hidden",
          }}
        >
          L
          <span
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.25) 50%, transparent 70%)",
              animation: "logoShine 4s infinite",
            }}
          />
        </div>
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 16,
            letterSpacing: -0.3,
            color: "#fff",
          }}
        >
          Agentic{" "}
          <span style={{ color: palette.green.base }}>Lending</span>
        </span>
      </div>

      <nav
        style={{
          display: "flex",
          alignItems: "center",
          gap: spacing[2],
          position: "absolute",
          left: "50%",
          transform: "translateX(-50%)",
        }}
      >
        {SCREENS.map((screen) => {
          const isActive = activeScreen === screen.id;
          return (
            <button
              key={screen.id}
              type="button"
              className={styles.navPill}
              aria-current={isActive ? "page" : undefined}
              onClick={() => onScreenChange(screen.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: spacing[1],
                padding: `${spacing[2]}px ${spacing[4]}px`,
                minHeight: narrow ? 44 : 34,
                borderRadius: "var(--radius-xl)",
                border: isActive
                  ? `1px solid ${palette.green.base}4d`
                  : "1px solid rgba(255,255,255,0.1)",
                background: isActive
                  ? `${palette.green.base}26`
                  : "rgba(255,255,255,0.06)",
                color: isActive
                  ? palette.green.base
                  : "rgba(255,255,255,0.7)",
                fontFamily: "var(--font-display)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 150ms ease",
              }}
            >
              {compact ? screen.shortLabel : screen.label}
            </button>
          );
        })}
      </nav>

      <div style={{ display: "flex", alignItems: "center", gap: spacing[3] }}>
        {hasSession && (
          <button
            type="button"
            onClick={() => setShowResetModal(true)}
            style={{
              padding: `${spacing[1]}px ${spacing[3]}px`,
              minHeight: 28,
              borderRadius: "var(--radius-sm)",
              border: '1px solid rgba(219, 48, 48, 0.4)',
              background: 'rgba(219, 48, 48, 0.1)',
              color: 'rgba(219, 48, 48, 0.8)',
              fontFamily: 'var(--font-display)',
              fontSize: 10,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 150ms ease',
            }}
            aria-label="Reset demo data"
          >
            Reset Demo
          </button>
        )}
        {onInfoOpen && (
          <>
            {hasSession && (
              <div style={{
                width: 1,
                height: 20,
                background: 'rgba(255,255,255,0.12)',
                flexShrink: 0,
              }} />
            )}
            <button
              type="button"
              onClick={onInfoOpen}
              style={{
                width: 28, height: 28, borderRadius: '50%',
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.7)',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 150ms ease',
              }}
              aria-label="Open technology reference panel"
            >
              <Icon glyph="InfoWithCircle" size={14} />
            </button>
          </>
        )}
      </div>

      {showResetModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'backdropEnter 0.2s ease-out both',
        }}
          onClick={() => !resetting && setShowResetModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg-base)', borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--danger)',
              padding: 24, maxWidth: 360, width: '90%',
              boxShadow: 'var(--shadow-xl)',
              animation: 'modalEnter 0.25s cubic-bezier(0.33, 1, 0.68, 1) both',
            }}
          >
            <div style={{
              fontFamily: 'var(--font-display)', fontWeight: 700,
              fontSize: 16, color: 'var(--text-primary)', marginBottom: 8,
            }}>
              Reset Demo Data?
            </div>
            <div style={{
              fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 20,
            }}>
              This will clear all applications, documents, and conversation history created during this demo session. This action cannot be undone.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={handleReset}
                disabled={resetting}
                style={{
                  flex: 1, padding: '8px 16px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--danger)', background: 'var(--danger-dim)',
                  color: 'var(--danger)', fontFamily: 'var(--font-display)',
                  fontWeight: 700, fontSize: 12, cursor: resetting ? 'default' : 'pointer',
                }}
              >
                {resetting ? 'Resetting...' : 'Yes, Reset'}
              </button>
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                disabled={resetting}
                style={{
                  flex: 1, padding: '8px 16px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-dim)', background: 'var(--bg-surface)',
                  color: 'var(--text-secondary)', fontFamily: 'var(--font-display)',
                  fontWeight: 600, fontSize: 12, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
