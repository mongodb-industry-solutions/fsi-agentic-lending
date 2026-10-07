"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { palette } from '@leafygreen-ui/palette';
import { spacing } from '@leafygreen-ui/tokens';
import Icon from '@leafygreen-ui/icon';
import { apiPost } from '../../lib/api';
import styles from './Header.module.css';

const SCREENS = [
  { id: "borrower", label: "Borrower Portal", shortLabel: "Borrower" },
  { id: "officer", label: "Loan Officer", shortLabel: "Officer" },
  { id: "risk", label: "Risk Assessor", shortLabel: "Risk" },
  { id: "renewal", label: "Renewal", shortLabel: "Renewal" },
  { id: "demo", label: "Demo Flow", shortLabel: "Demo" },
];

export default function Header({ activeScreen, onScreenChange, onInfoOpen }) {
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [compact, setCompact] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const cancelBtnRef = useRef(null);

  const checkSession = useCallback(() => {
    setHasSession(!!sessionStorage.getItem('lendflow_demo_session'));
  }, []);

  useEffect(() => {
    checkSession();
    // storage event fires on cross-tab changes; interval catches same-tab writes
    window.addEventListener('storage', checkSession);
    const interval = setInterval(checkSession, 2000);
    const mqCompact = window.matchMedia('(max-width: 768px)');
    const mqNarrow = window.matchMedia('(max-width: 640px)');
    setCompact(mqCompact.matches);
    setNarrow(mqNarrow.matches);
    const onCompact = (e) => setCompact(e.matches);
    const onNarrow = (e) => setNarrow(e.matches);
    mqCompact.addEventListener('change', onCompact);
    mqNarrow.addEventListener('change', onNarrow);
    return () => {
      window.removeEventListener('storage', checkSession);
      clearInterval(interval);
      mqCompact.removeEventListener('change', onCompact);
      mqNarrow.removeEventListener('change', onNarrow);
    };
  }, [checkSession]);

  useEffect(() => {
    if (!showResetModal) return;
    const onKey = (e) => {
      if (e.key === 'Escape' && !resetting) setShowResetModal(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showResetModal, resetting]);

  useEffect(() => {
    if (showResetModal && cancelBtnRef.current) {
      cancelBtnRef.current.focus();
    }
  }, [showResetModal]);

  const handleReset = async () => {
    setResetting(true);
    const result = await apiPost('/demo/reset', {}, { 'X-Demo-Reset': 'confirm' });
    if (!result) {
      console.warn('[LendFlow] Demo reset API call failed, proceeding with local cleanup');
    }
    sessionStorage.removeItem('lendflow_demo_session');
    sessionStorage.removeItem('lendflow_phase');
    sessionStorage.removeItem('lendflow_app_id');
    sessionStorage.removeItem('lendflow_borrower');
    sessionStorage.removeItem('lendflow_theatre_tab');
    sessionStorage.removeItem('lendflow_submitted_apps');
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
        <svg
          width="28"
          height="28"
          viewBox="0 0 256 549"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-label="MongoDB"
          role="img"
          style={{ flexShrink: 0 }}
        >
          <path
            d="M175.622 61.108C152.612 33.807 132.797 6.078 128.749.32a1.03 1.03 0 0 0-1.497 0c-4.048 5.758-23.863 33.487-46.873 60.788C-1.588 155.473-5.14 232.443 22.46 306.678c15.097 40.602 40.244 76.294 73.6 104.399 2.206 1.858 3.578 4.545 3.997 7.32l5.157 74.603h46.573l5.157-74.603c.42-2.775 1.791-5.462 3.997-7.32 33.357-28.105 58.503-63.797 73.6-104.399C262.14 232.443 258.588 155.473 175.622 61.108z"
            fill={palette.green.base}
          />
          <path
            d="M137.092 468.251l-8.376-1.168s1.169-48.728-16.012-52.262c-11.514-11.859 1.683-503.39 48.728 0-3.348 7.404-15.876 12.449-19.31 22.126-3.434 9.677-5.03 31.304-5.03 31.304z"
            fill="#fff"
            fillOpacity="0.25"
          />
        </svg>
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
        {!compact && (
          <a
            href="https://leafy-bank-bian-model.industrysolutions.staging.corp.mongodb.com/bian-data-model?demo=lending"
            aria-label="Open BIAN data model viewer"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
              padding: `${spacing[1]}px ${spacing[3]}px`,
              borderRadius: "var(--radius-sm)",
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.8)",
              fontFamily: "var(--font-display)",
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: 0.2,
              whiteSpace: "nowrap",
              textDecoration: "none",
              cursor: "pointer",
              transition: "all 150ms ease",
            }}
          >
            <Icon glyph="Read" size={12} />
            <span style={{ textDecoration: "underline", textUnderlineOffset: 2 }}>
              Data Model
            </span>
          </a>
        )}
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
              <Icon glyph="Wizard" size={14} />
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
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-modal-title"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg-base)', borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--danger)',
              padding: 24, maxWidth: 360, width: '90%',
              boxShadow: 'var(--shadow-xl)',
              animation: 'modalEnter 0.25s cubic-bezier(0.33, 1, 0.68, 1) both',
            }}
          >
            <div id="reset-modal-title" style={{
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
                ref={cancelBtnRef}
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
