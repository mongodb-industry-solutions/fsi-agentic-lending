"use client";

export default function StackCounter({ count = 0, total = 6 }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 16px",
        borderRadius: "var(--radius-md)",
        background: "var(--mongo-dim)",
        border: "1px solid rgba(0,237,100,0.2)",
        fontFamily: "var(--font-display)",
        fontSize: 14,
        fontWeight: 700,
        color: "var(--mongo)",
      }}
    >
      <span>{count}</span>
      <span>of {total} capabilities</span>
      <span style={{ color: "var(--text-dim)", fontWeight: 500 }}>
        → 1 platform
      </span>
    </div>
  );
}
