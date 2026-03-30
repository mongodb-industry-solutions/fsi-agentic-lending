"use client";

const colorMap = {
  mongo: "var(--mongo)",
  voyage: "var(--voyage)",
  "agent-cyan": "var(--agent-cyan)",
  "tool-blue": "var(--tool-blue)",
  "hitl-amber": "var(--hitl-amber)",
  danger: "var(--danger)",
  success: "var(--success)",
};

const dimMap = {
  mongo: "var(--mongo-dim)",
  voyage: "var(--voyage-dim)",
  "agent-cyan": "var(--agent-cyan-dim)",
  "tool-blue": "var(--tool-blue-dim)",
  "hitl-amber": "var(--hitl-amber-dim)",
  danger: "var(--danger-dim)",
  success: "var(--success-dim)",
};

const borderMap = {
  mongo: "rgba(0,237,100,0.15)",
  voyage: "rgba(124,92,252,0.15)",
  "agent-cyan": "rgba(34,211,238,0.15)",
  "tool-blue": "rgba(59,130,246,0.15)",
  "hitl-amber": "rgba(245,158,11,0.15)",
  danger: "rgba(239,68,68,0.15)",
  success: "rgba(16,185,129,0.15)",
};

export default function FeatureBadge({
  icon,
  label,
  colorVar = "mongo",
  active = false,
  small = false,
}) {
  const color = colorMap[colorVar] || colorMap.mongo;
  const bg = dimMap[colorVar] || dimMap.mongo;
  const border = borderMap[colorVar] || borderMap.mongo;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: small ? 4 : 6,
        padding: small ? "2px 8px" : "4px 10px",
        margin: 2,
        borderRadius: "var(--radius-sm)",
        fontSize: small ? 10 : 11,
        fontWeight: 600,
        background: active ? bg : "var(--bg-overlay)",
        color: active ? color : "var(--text-dim)",
        border: `1px solid ${active ? border : "var(--border-dim)"}`,
        opacity: active ? 1 : 0.7,
        transition: "all 0.3s",
      }}
    >
      <span style={{ fontSize: small ? 12 : 14 }}>{icon}</span>
      {label}
    </span>
  );
}
