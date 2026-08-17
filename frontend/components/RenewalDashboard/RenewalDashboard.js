"use client";

import { useState, useEffect, useCallback } from "react";
import { palette } from "@leafygreen-ui/palette";
import { spacing } from "@leafygreen-ui/tokens";
import Icon from "@leafygreen-ui/icon";
import { apiGet, apiPost } from "../../lib/api";

const fmtCurrency = (n) =>
  typeof n === "number" ? `$${Math.round(n).toLocaleString("en-CA")}` : "—";
const fmtRate = (r) => (typeof r === "number" ? `${(r * 100).toFixed(2)}%` : "—");
const fmtDate = (iso) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-CA", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
};

const STATUS_META = {
  due: { label: "Due for renewal", color: "var(--hitl-amber)", dim: "var(--hitl-amber-dim)" },
  offer_sent: { label: "Offer sent", color: "var(--agent-cyan)", dim: "var(--agent-cyan-dim)" },
  renewed: { label: "Renewed", color: "var(--success)", dim: "var(--success-dim)" },
};

function Avatar({ name, color }) {
  const initials = (name || "?")
    .split(/[&\s]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: "50%",
        background: color,
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-display)",
        fontWeight: 700,
        fontSize: 13,
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}

const AVATAR_COLORS = ["#00684A", "#016BF8", "#5C6C75", "#B45309", "#7C3AED"];

function TermRow({ label, value, strong, accent }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "5px 0" }}>
      <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{label}</span>
      <span
        style={{
          fontSize: strong ? 15 : 13,
          fontWeight: strong ? 700 : 500,
          color: accent || "var(--text-primary)",
          fontFamily: "var(--font-display)",
        }}
      >
        {value}
      </span>
    </div>
  );
}

export default function RenewalDashboard({ active = true }) {
  const [renewals, setRenewals] = useState([]);
  const [scanMeta, setScanMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [signing, setSigning] = useState(false);
  const [docOpen, setDocOpen] = useState(false);

  const fetchRenewals = useCallback(async () => {
    setLoading(true);
    const res = await apiGet("/renewals");
    if (res) {
      setRenewals(res.renewals || []);
      setScanMeta({ scanned_at: res.scanned_at, window_days: res.window_days, due_count: res.due_count });
      setSelectedId((prev) => prev || (res.renewals?.[0]?.renewal_id ?? null));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (active) fetchRenewals();
  }, [active, fetchRenewals]);

  const selected = renewals.find((r) => r.renewal_id === selectedId) || null;

  const patchSelected = (updated) => {
    setRenewals((prev) => prev.map((r) => (r.renewal_id === updated.renewal_id ? updated : r)));
  };

  const handleGenerate = async () => {
    if (!selected) return;
    setGenerating(true);
    const res = await apiPost(`/renewals/${selected.renewal_id}/offer`, {});
    if (res) patchSelected(res);
    setGenerating(false);
  };

  const handleSign = async () => {
    if (!selected) return;
    setSigning(true);
    const res = await apiPost(`/renewals/${selected.renewal_id}/sign`, {});
    if (res && !res.error) patchSelected(res);
    setSigning(false);
  };

  return (
    <div style={{ minHeight: "calc(100vh - 52px)", background: "var(--bg-void)", padding: spacing[5] }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: spacing[4], gap: spacing[3], flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: spacing[2] }}>
              <div
                style={{
                  width: 34, height: 34, borderRadius: "var(--radius-md)",
                  background: "var(--agent-cyan-dim)", border: "1px solid var(--agent-cyan)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <Icon glyph="Refresh" size={18} fill="var(--agent-cyan)" />
              </div>
              <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>
                Renewal Agent
              </h1>
            </div>
            <p style={{ margin: "6px 0 0 0", fontSize: 13, color: "var(--text-secondary)", maxWidth: 620, lineHeight: 1.5 }}>
              The agent scans the portfolio for loans maturing in the next 3 months, drafts a personalized
              renewal offer, and auto-renews the loan the moment the borrower e-signs.
            </p>
          </div>
          <button
            type="button"
            onClick={fetchRenewals}
            disabled={loading}
            style={{
              display: "flex", alignItems: "center", gap: spacing[1],
              padding: `${spacing[2]}px ${spacing[3]}px`,
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--agent-cyan)",
              background: "var(--agent-cyan-dim)",
              color: "var(--agent-cyan)",
              fontFamily: "var(--font-display)", fontSize: 12, fontWeight: 600,
              cursor: loading ? "default" : "pointer", whiteSpace: "nowrap",
            }}
          >
            <Icon glyph="MagnifyingGlass" size={14} />
            {loading ? "Scanning…" : "Re-scan portfolio"}
          </button>
        </div>

        {scanMeta && (
          <div style={{ marginBottom: spacing[4], fontSize: 12, color: "var(--text-dim)", fontFamily: "var(--font-mono, monospace)" }}>
            Renewal Agent found <span style={{ color: "var(--hitl-amber)", fontWeight: 700 }}>{scanMeta.due_count}</span> loan
            {scanMeta.due_count === 1 ? "" : "s"} maturing within {scanMeta.window_days} days · scanned {fmtDate(scanMeta.scanned_at)}
          </div>
        )}

        <div style={{ display: "flex", gap: spacing[4], alignItems: "flex-start", flexWrap: "wrap" }}>
          {/* Queue */}
          <div style={{ flex: "1 1 340px", minWidth: 300, display: "flex", flexDirection: "column", gap: spacing[2] }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 2 }}>
              Renewal Queue
            </div>
            {renewals.length === 0 && !loading && (
              <div style={{ padding: spacing[4], border: "1px dashed var(--border-dim)", borderRadius: "var(--radius-md)", color: "var(--text-dim)", fontSize: 13, textAlign: "center" }}>
                No loans due for renewal.
              </div>
            )}
            {renewals.map((r, i) => {
              const meta = STATUS_META[r.status] || STATUS_META.due;
              const isSel = r.renewal_id === selectedId;
              return (
                <button
                  key={r.renewal_id}
                  type="button"
                  onClick={() => setSelectedId(r.renewal_id)}
                  style={{
                    textAlign: "left", cursor: "pointer",
                    padding: spacing[3], borderRadius: "var(--radius-md)",
                    border: isSel ? "1px solid var(--mongo)" : "1px solid var(--border-dim)",
                    background: isSel ? "var(--bg-raised)" : "var(--bg-surface)",
                    boxShadow: isSel ? "var(--shadow-sm)" : "none",
                    transition: "var(--transition-fast)",
                    display: "flex", flexDirection: "column", gap: spacing[2],
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: spacing[2] }}>
                    <Avatar name={r.borrower_name} color={AVATAR_COLORS[i % AVATAR_COLORS.length]} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {r.borrower_name}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-dim)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {r.property_address}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: "var(--radius-xl)", background: meta.dim, color: meta.color, fontWeight: 700 }}>
                      {meta.label}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                      Matures {fmtDate(r.maturity_date)}
                      {typeof r.days_to_maturity === "number" && r.status !== "renewed" && (
                        <span style={{ color: "var(--hitl-amber)", fontWeight: 700 }}> · {r.days_to_maturity}d</span>
                      )}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Detail */}
          <div style={{ flex: "2 1 560px", minWidth: 320 }}>
            {!selected ? (
              <div style={{ padding: spacing[6], border: "1px solid var(--border-dim)", borderRadius: "var(--radius-md)", color: "var(--text-dim)", textAlign: "center", background: "var(--bg-surface)" }}>
                Select a loan from the queue to run the Renewal Agent.
              </div>
            ) : (
              <RenewalDetail
                renewal={selected}
                generating={generating}
                signing={signing}
                onGenerate={handleGenerate}
                onSign={handleSign}
                onViewDoc={() => setDocOpen(true)}
              />
            )}
          </div>
        </div>
      </div>

      {docOpen && selected && (
        <div
          onClick={() => setDocOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 910, background: "rgba(0,0,0,0.6)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: spacing[4],
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "var(--bg-base)", borderRadius: "var(--radius-lg)", width: "min(820px, 92vw)", height: "88vh", display: "flex", flexDirection: "column", overflow: "hidden", border: "1px solid var(--border-base)" }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: spacing[3], borderBottom: "1px solid var(--border-dim)" }}>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>
                Renewal Agreement — {selected.borrower_name}
              </span>
              <button type="button" onClick={() => setDocOpen(false)} style={{ cursor: "pointer", background: "none", border: "none", color: "var(--text-secondary)", display: "flex" }}>
                <Icon glyph="X" size={18} />
              </button>
            </div>
            <iframe
              title="Renewal document"
              src={`/api/backend/renewals/${selected.renewal_id}/document.pdf`}
              style={{ flex: 1, border: "none", width: "100%", background: "#fff" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function RenewalDetail({ renewal, generating, signing, onGenerate, onSign, onViewDoc }) {
  const offer = renewal.offer;
  const isRenewed = renewal.status === "renewed";

  const panel = {
    background: "var(--bg-surface)",
    border: "1px solid var(--border-dim)",
    borderRadius: "var(--radius-md)",
    padding: spacing[4],
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing[3] }}>
      {/* Loan summary */}
      <div style={panel}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: spacing[2] }}>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, color: "var(--text-primary)" }}>
            {renewal.borrower_name}
          </span>
          <span style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--font-mono, monospace)" }}>{renewal.renewal_id}</span>
        </div>
        <TermRow label="Property" value={renewal.property_address} />
        <TermRow label="Outstanding balance" value={fmtCurrency(renewal.loan_amount)} />
        <TermRow label="Maturity date" value={fmtDate(renewal.maturity_date)} accent="var(--hitl-amber)" />
      </div>

      {/* Step 1 — agent runs */}
      {renewal.status === "due" && (
        <div style={panel}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: spacing[3], lineHeight: 1.5 }}>
            This loan's 5-year term is maturing. Run the Renewal Agent to generate a personalized offer and draft the renewal agreement.
          </div>
          <button
            type="button"
            onClick={onGenerate}
            disabled={generating}
            style={{
              display: "flex", alignItems: "center", gap: spacing[2],
              padding: `${spacing[2]}px ${spacing[4]}px`, borderRadius: "var(--radius-sm)",
              border: "none", background: "var(--mongo)", color: "#fff",
              fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13,
              cursor: generating ? "default" : "pointer",
            }}
          >
            <Icon glyph="Sparkle" size={16} />
            {generating ? "Renewal Agent working…" : "Run Renewal Agent"}
          </button>
        </div>
      )}

      {/* Agent reasoning */}
      {(offer?.steps?.length > 0) && (
        <div style={panel}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: "var(--agent-cyan)", marginBottom: spacing[2], display: "flex", alignItems: "center", gap: 6 }}>
            <Icon glyph="Sparkle" size={13} fill="var(--agent-cyan)" /> Renewal Agent reasoning
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: spacing[2] }}>
            {offer.steps.map((step, i) => (
              <div key={i} style={{ display: "flex", gap: spacing[2], fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.45 }}>
                <span style={{ color: "var(--agent-cyan)", fontWeight: 700 }}>{i + 1}.</span>
                <span>{step}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Offer — old vs new */}
      {offer && (
        <div style={panel}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: "var(--text-dim)", marginBottom: spacing[3] }}>
            Renewal Offer
          </div>
          <div style={{ display: "flex", gap: spacing[3], flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 200px", padding: spacing[3], borderRadius: "var(--radius-md)", background: "var(--bg-base)", border: "1px solid var(--border-dim)" }}>
              <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: spacing[2], fontWeight: 600 }}>CURRENT (MATURING)</div>
              <TermRow label="Rate" value={fmtRate(offer.current_rate)} />
              <TermRow label="Monthly payment" value={fmtCurrency(offer.current_payment)} />
            </div>
            <div style={{ flex: "1 1 200px", padding: spacing[3], borderRadius: "var(--radius-md)", background: "var(--mongo-dim)", border: "1px solid var(--mongo)" }}>
              <div style={{ fontSize: 11, color: "var(--mongo)", marginBottom: spacing[2], fontWeight: 700 }}>RENEWED (OFFERED)</div>
              <TermRow label="Rate" value={fmtRate(offer.new_rate)} strong accent="var(--mongo)" />
              <TermRow label="Monthly payment" value={fmtCurrency(offer.new_payment)} strong />
            </div>
          </div>
          <div style={{ marginTop: spacing[3], padding: spacing[3], borderRadius: "var(--radius-md)", background: "var(--bg-base)", borderLeft: `3px solid ${offer.payment_delta <= 0 ? "var(--success)" : "var(--hitl-amber)"}` }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: offer.payment_delta <= 0 ? "var(--success)" : "var(--hitl-amber)", marginBottom: 4 }}>
              {offer.payment_delta <= 0
                ? `Saves ${fmtCurrency(Math.abs(offer.payment_delta))} / month`
                : `Increases ${fmtCurrency(Math.abs(offer.payment_delta))} / month`}
            </div>
            <div style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>{offer.rationale}</div>
          </div>

          <div style={{ display: "flex", gap: spacing[2], marginTop: spacing[3], flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={onViewDoc}
              style={{
                display: "flex", alignItems: "center", gap: spacing[1],
                padding: `${spacing[2]}px ${spacing[3]}px`, borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border-base)", background: "var(--bg-base)",
                color: "var(--text-primary)", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 12,
                cursor: "pointer",
              }}
            >
              <Icon glyph="File" size={14} /> View renewal document
            </button>
            {!isRenewed && (
              <button
                type="button"
                onClick={onSign}
                disabled={signing}
                style={{
                  display: "flex", alignItems: "center", gap: spacing[1],
                  padding: `${spacing[2]}px ${spacing[4]}px`, borderRadius: "var(--radius-sm)",
                  border: "none", background: "var(--mongo)", color: "#fff",
                  fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12,
                  cursor: signing ? "default" : "pointer",
                }}
              >
                <Icon glyph="Edit" size={14} />
                {signing ? "Signing…" : "Send to borrower & e-sign"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Renewed confirmation */}
      {isRenewed && (
        <div style={{ ...panel, borderColor: "var(--success)", background: "var(--success-dim)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: spacing[2], marginBottom: spacing[2] }}>
            <Icon glyph="CheckmarkWithCircle" size={20} fill="var(--success)" />
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--success)" }}>
              Loan renewed
            </span>
          </div>
          <div style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: spacing[2] }}>
            {renewal.signature?.signer_name} e-signed on {fmtDate(renewal.signature?.signed_at)}. The loan auto-renewed
            at {fmtRate(renewal.current_rate)} and now matures {fmtDate(renewal.maturity_date)}.
          </div>
        </div>
      )}
    </div>
  );
}
