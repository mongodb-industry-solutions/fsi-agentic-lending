"use client";

const variantStyles = {
  info: {
    color: "var(--agent-cyan)",
    bg: "var(--agent-cyan-dim)",
    border: "rgba(8, 145, 178, 0.2)",
  },
  success: {
    color: "var(--success)",
    bg: "var(--success-dim)",
    border: "rgba(5, 150, 105, 0.2)",
  },
  warning: {
    color: "var(--hitl-amber)",
    bg: "var(--hitl-amber-dim)",
    border: "rgba(217, 119, 6, 0.2)",
  },
  mongo: {
    color: "var(--mongo)",
    bg: "var(--mongo-dim)",
    border: "rgba(0, 136, 74, 0.2)",
  },
};

export default function ContextBanner({
  icon,
  children,
  variant = "info",
}) {
  const v = variantStyles[variant] || variantStyles.info;

  return (
    <div
      role="note"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "10px 14px",
        borderRadius: "var(--radius-md)",
        border: `1px solid ${v.border}`,
        background: v.bg,
        color: "var(--text-primary)",
      }}
    >
      {icon != null && (
        <span
          style={{
            fontSize: 16,
            lineHeight: 1.4,
            flexShrink: 0,
            color: v.color,
          }}
          aria-hidden
        >
          {icon}
        </span>
      )}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          fontFamily: "var(--font-body)",
          fontSize: 13,
          lineHeight: 1.5,
          color: "var(--text-secondary)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
