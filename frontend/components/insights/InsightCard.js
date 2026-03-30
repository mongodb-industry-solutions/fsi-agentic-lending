"use client";

import { useState, useCallback } from "react";

export default function InsightCard({
  title,
  icon,
  children,
  defaultExpanded = false,
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const toggle = useCallback(() => {
    setExpanded((v) => !v);
  }, []);

  return (
    <div
      style={{
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--border-dim)",
        background: "var(--bg-surface)",
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={expanded}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 14px",
          border: "none",
          background: expanded ? "var(--bg-raised)" : "transparent",
          cursor: "pointer",
          fontFamily: "var(--font-display)",
          textAlign: "left",
          transition: "background 0.2s ease",
        }}
      >
        {icon != null && (
          <span
            style={{
              fontSize: 18,
              lineHeight: 1,
              flexShrink: 0,
            }}
            aria-hidden
          >
            {icon}
          </span>
        )}
        <span
          style={{
            flex: 1,
            fontSize: 14,
            fontWeight: 700,
            color: "var(--text-primary)",
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </span>
        <span
          style={{
            fontSize: 12,
            color: "var(--text-dim)",
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.25s ease",
            flexShrink: 0,
          }}
          aria-hidden
        >
          ▼
        </span>
      </button>
      {expanded && (
        <div
          style={{
            padding: "0 14px 14px",
            borderTop: "1px solid var(--border-dim)",
            animation: "slideDown 0.3s ease-out",
          }}
        >
          <div
            style={{
              paddingTop: 12,
              fontFamily: "var(--font-body)",
              fontSize: 13,
              lineHeight: 1.55,
              color: "var(--text-secondary)",
            }}
          >
            {children}
          </div>
        </div>
      )}
    </div>
  );
}
