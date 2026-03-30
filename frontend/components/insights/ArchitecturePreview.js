"use client";

const FLOW_STEPS = [
  { id: "supervisor", label: "Supervisor" },
  {
    id: "agents",
    label: "Agents",
    subNodes: [
      { id: "appAgent", label: "Application" },
      { id: "underwriter", label: "Underwriter" },
    ],
  },
  { id: "hitlGate", label: "HITL Gate" },
  { id: "decision", label: "Decision" },
];

function FlowArrow() {
  return (
    <div
      aria-hidden
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--text-dim)",
        fontSize: 11,
        padding: "4px 0",
        fontFamily: "var(--font-mono)",
      }}
    >
      ↓
    </div>
  );
}

function NodeBox({ label, highlighted, compact }) {
  return (
    <div
      style={{
        padding: compact ? "6px 10px" : "10px 14px",
        borderRadius: "var(--radius-md)",
        border: highlighted
          ? "1px solid var(--mongo)"
          : "1px solid var(--border-dim)",
        background: highlighted ? "var(--mongo-dim)" : "var(--bg-base)",
        color: highlighted ? "var(--mongo)" : "var(--text-secondary)",
        fontFamily: "var(--font-display)",
        fontSize: compact ? 11 : 12,
        fontWeight: highlighted ? 700 : 600,
        textAlign: "center",
        boxShadow: highlighted ? "0 0 0 1px var(--mongo-glow)" : "none",
        transition: "border-color 0.2s, background 0.2s, box-shadow 0.2s",
      }}
    >
      {label}
    </div>
  );
}

export default function ArchitecturePreview({ highlightAgents = [] }) {
  const hl = new Set(
    Array.isArray(highlightAgents) ? highlightAgents.map(String) : [],
  );

  const agentsGroup = hl.has("agents");

  const isHighlighted = (id) =>
    hl.has(id) || (agentsGroup && (id === "appAgent" || id === "underwriter"));

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        gap: 0,
        padding: 16,
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--border-dim)",
        background: "var(--bg-surface)",
        maxWidth: 320,
      }}
    >
      {FLOW_STEPS.map((step, index) => (
        <div key={step.id}>
          {index > 0 ? <FlowArrow /> : null}
          {step.subNodes ? (
            <div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "var(--text-dim)",
                  fontFamily: "var(--font-display)",
                  textAlign: "center",
                  marginBottom: 8,
                }}
              >
                {step.label}
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                }}
              >
                {step.subNodes.map((sub) => (
                  <NodeBox
                    key={sub.id}
                    label={sub.label}
                    compact
                    highlighted={isHighlighted(sub.id)}
                  />
                ))}
              </div>
            </div>
          ) : (
            <NodeBox
              label={step.label}
              highlighted={isHighlighted(step.id)}
            />
          )}
        </div>
      ))}

      <FlowArrow />

      <div
        style={{
          padding: "12px 14px",
          borderRadius: "var(--radius-md)",
          border: isHighlighted("mongoAtlas")
            ? "1px solid var(--mongo-bright)"
            : "1px solid var(--border-base)",
          background: isHighlighted("mongoAtlas")
            ? "var(--mongo-dim)"
            : "var(--bg-raised)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 12,
            fontWeight: 700,
            color: isHighlighted("mongoAtlas")
              ? "var(--mongo)"
              : "var(--text-primary)",
            letterSpacing: "-0.02em",
          }}
        >
          MongoDB Atlas
        </div>
        <div
          style={{
            marginTop: 4,
            fontFamily: "var(--font-body)",
            fontSize: 10,
            color: "var(--text-dim)",
          }}
        >
          Operational data & retrieval
        </div>
      </div>
    </div>
  );
}
