"use client";

const SCREENS = [
  { id: "borrower", label: "Borrower Portal", icon: "👤" },
  { id: "officer", label: "Loan Officer", icon: "🏦" },
  { id: "demo", label: "Demo Flow", icon: "▶" },
];

const STATUS_CHIPS = [
  { label: "Atlas", on: true },
  { label: "LangGraph", on: true },
  { label: "LangSmith", on: true },
];

export default function Header({ activeScreen, onScreenChange }) {
  return (
    <header
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 200,
        height: 52,
        padding: "0 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "var(--bg-header)",
        backdropFilter: "blur(16px)",
        borderBottom: "1px solid var(--border-dim)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
          }}
        >
          Lend<em style={{ fontStyle: "normal", color: "var(--mongo)" }}>Flow</em>{" "}
          AI
        </span>
      </div>

      <nav
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
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
              border: "1px solid var(--border-dim)",
              background:
                activeScreen === screen.id
                  ? "var(--mongo-dim)"
                  : "var(--bg-raised)",
              color:
                activeScreen === screen.id
                  ? "var(--mongo)"
                  : "var(--text-dim)",
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

      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {STATUS_CHIPS.map((chip) => (
          <span
            key={chip.label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              color: "var(--text-dim)",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: chip.on ? "var(--mongo)" : "var(--danger)",
                boxShadow: chip.on ? "0 0 6px var(--mongo-glow)" : "none",
              }}
            />
            {chip.label}
          </span>
        ))}
      </div>
    </header>
  );
}
