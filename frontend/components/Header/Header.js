"use client";

import { useState, useEffect } from 'react';
import { spacing } from '@leafygreen-ui/tokens';
import { apiGet } from '../../lib/api';

const SCREENS = [
  { id: "borrower", label: "Borrower Portal", icon: "👤" },
  { id: "officer", label: "Loan Officer", icon: "🏦" },
  { id: "demo", label: "Demo Flow", icon: "▶" },
];

export default function Header({ activeScreen, onScreenChange, onInfoOpen }) {
  const [backendHealth, setBackendHealth] = useState(null);

  useEffect(() => {
    const check = async () => {
      const result = await apiGet('/');
      setBackendHealth(result);
    };
    check();
    const interval = setInterval(check, 15000);
    return () => clearInterval(interval);
  }, []);

  const isBackendUp = backendHealth?.status === 'ok';
  const isMongoUp = backendHealth?.mongodb === 'connected';

  const statusChips = [
    { label: "Atlas", on: isMongoUp },
    { label: "LangGraph", on: isBackendUp },
    { label: "LangSmith", on: isBackendUp },
  ];
  return (
    <header
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 200,
        height: 52,
        padding: `0 ${spacing[6]}px`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "#023430",
        backdropFilter: "none",
        borderBottom: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: spacing[3] }}>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background:
              "linear-gradient(135deg, var(--mongo) 0%, var(--mongo-bright) 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: 16,
            color: "#ffffff",
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
            color: "#FFFFFF",
          }}
        >
          Lend<em style={{ fontStyle: "normal", color: "#00ED64" }}>Flow</em>{" "}
          AI
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
        {SCREENS.map((screen) => (
          <button
            key={screen.id}
            type="button"
            aria-current={activeScreen === screen.id ? "page" : undefined}
            onClick={() => onScreenChange(screen.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 14px",
              borderRadius: 20,
              border: "1px solid rgba(255,255,255,0.1)",
              background:
                activeScreen === screen.id
                  ? "rgba(0, 237, 100, 0.15)"
                  : "rgba(255,255,255,0.08)",
              color:
                activeScreen === screen.id
                  ? "#00ED64"
                  : "rgba(255,255,255,0.7)",
              fontFamily: "var(--font-display)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.3s",
            }}
          >
            <span style={{ fontSize: 13 }}>{screen.icon}</span>
            {screen.label}
          </button>
        ))}
      </nav>

      <div style={{ display: "flex", alignItems: "center", gap: spacing[4] }}>
        {onInfoOpen && (
          <button
            type="button"
            onClick={onInfoOpen}
            style={{
              width: 28, height: 28, borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.7)', fontFamily: 'var(--font-display)',
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            aria-label="Open technology reference panel"
          >
            i
          </button>
        )}
        {statusChips.map((chip) => (
          <span
            key={chip.label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              color: "rgba(255,255,255,0.6)",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: chip.on ? "#00ED64" : "#DB3030",
                boxShadow: chip.on ? "0 0 6px rgba(0,237,100,0.4)" : "none",
              }}
            />
            {chip.label}
          </span>
        ))}
      </div>
    </header>
  );
}
