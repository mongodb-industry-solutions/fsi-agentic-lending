"use client";

export default function CodeSnippet({ code }) {
  return (
    <pre
      style={{
        margin: 0,
        padding: 12,
        borderRadius: "var(--radius-md)",
        background: "var(--bg-raised)",
        border: "1px solid var(--border-dim)",
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        lineHeight: 1.7,
        color: "var(--text-secondary)",
        overflow: "auto",
      }}
    >
      <code>{code}</code>
    </pre>
  );
}
