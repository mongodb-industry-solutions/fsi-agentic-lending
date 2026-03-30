"use client";

const BORDER_ALPHA = {
  mongo: "rgba(0, 136, 74, 0.15)",
  voyage: "rgba(99, 65, 224, 0.15)",
  "agent-cyan": "rgba(8, 145, 178, 0.15)",
  "tool-blue": "rgba(37, 99, 235, 0.15)",
  "hitl-amber": "rgba(217, 119, 6, 0.15)",
  danger: "rgba(220, 38, 38, 0.15)",
  success: "rgba(5, 150, 105, 0.15)",
};

function resolveColorVar(colorVar) {
  const key = BORDER_ALPHA[colorVar] ? colorVar : "mongo";
  return {
    accent: `var(--${key})`,
    surface: `var(--${key}-dim)`,
    border: BORDER_ALPHA[key],
  };
}

export default function FeatureHighlight({
  icon,
  title,
  description,
  colorVar = "mongo",
}) {
  const { accent, surface, border } = resolveColorVar(colorVar);

  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        padding: "12px 14px",
        borderRadius: "var(--radius-md)",
        border: `1px solid ${border}`,
        background: surface,
      }}
    >
      {icon != null && (
        <span
          style={{
            fontSize: 20,
            lineHeight: 1,
            flexShrink: 0,
            color: accent,
          }}
          aria-hidden
        >
          {icon}
        </span>
      )}
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 13,
            fontWeight: 700,
            color: "var(--text-primary)",
            letterSpacing: "-0.01em",
            marginBottom: description ? 4 : 0,
          }}
        >
          {title}
        </div>
        {description ? (
          <p
            style={{
              margin: 0,
              fontFamily: "var(--font-body)",
              fontSize: 12,
              lineHeight: 1.5,
              color: "var(--text-secondary)",
            }}
          >
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}
