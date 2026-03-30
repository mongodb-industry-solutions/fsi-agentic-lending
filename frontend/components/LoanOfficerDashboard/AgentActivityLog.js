"use client";

import { useState, useEffect, useMemo } from 'react';
import { apiSSE } from '../../lib/api';

const ACTIVITY_TEMPLATES = [
  {
    agent: 'Supervisor',
    category: 'supervisor',
    action: 'Routing to Loan Application Agent',
    op: 'db.loanApplications.insertOne()',
    latency: '4ms',
    icon: '🧭',
    reasoning: 'Application MD-00001 classified as standard origination. Loan Application Agent selected based on product type (5yr Fixed) and document completeness (14/14 required docs present).',
    details: {
      input: '{ applicantId: "MD-00001", product: "5YR_FIXED_25", docs: 14 }',
      output: '{ routed: true, target: "loanAppAgent", priority: "standard" }',
      tokens: 142,
      model: 'gpt-4o-mini',
    },
  },
  {
    agent: 'Loan App Agent',
    category: 'loanapp',
    action: 'Multi-document ingestion started',
    op: 'watch(loanApplications)',
    latency: '—',
    icon: '📝',
    reasoning: 'Initiating Change Stream listener on loanApplications collection to track document processing events in real-time. This enables reactive pipeline orchestration.',
    details: {
      input: '{ collection: "loanApplications", pipeline: [{ $match: { appId: "MD-00001" } }] }',
      output: '{ streamId: "cs_78342_01", status: "listening" }',
      tokens: 0,
      model: 'n/a (system)',
    },
  },
  {
    agent: 'Voyage AI',
    category: 'loanapp',
    action: 'Multimodal embedding: CRA tax notice image + text',
    op: 'voyage-multimodal-3.5.embed()',
    latency: '38ms',
    icon: '🧬',
    reasoning: 'CRA tax notice selected for multimodal processing because it contains both structured text fields (employer, income) and visual layout cues (box positions) that improve extraction accuracy by 12% vs text-only.',
    details: {
      input: '{ docType: "CRA_NOA", pages: 2, mode: "image+text", year: 2025 }',
      output: '{ vectors: 2, dimensions: 1024, fields: ["employer", "income", "tax_owing"] }',
      tokens: 856,
      model: 'voyage-multimodal-3.5',
    },
  },
  {
    agent: 'Loan App Agent',
    category: 'loanapp',
    action: 'Credit bureau pull: Equifax',
    op: 'db.creditReports.findOne()',
    latency: '2ms',
    icon: '📋',
    reasoning: 'Selected Equifax as primary Canadian bureau per policy §2.1.3. Cached report found — last refreshed 4 hours ago, within 24h freshness policy.',
    details: {
      input: '{ sin_hash: "sha256:a8f2...", bureau: "equifax" }',
      output: '{ score: 784, tradelines: 10, inquiries_6mo: 3, derogatory: 0 }',
      tokens: 0,
      model: 'n/a (API)',
    },
  },
  {
    agent: 'Voyage AI',
    category: 'loanapp',
    action: 'Multimodal embedding: Bank Statement pages',
    op: 'voyage-multimodal-3.5.embed()',
    latency: '42ms',
    icon: '🧬',
    reasoning: 'Bank statement requires multimodal processing for table extraction across 4 pages. Column alignment detected via vision encoder improves transaction categorization accuracy.',
    details: {
      input: '{ docType: "bank_statement", pages: 4, mode: "image+text", months: 3 }',
      output: '{ vectors: 4, dimensions: 1024, transactions: 247 }',
      tokens: 3421,
      model: 'voyage-multimodal-3.5',
    },
  },
  {
    agent: 'Loan App Agent',
    category: 'loanapp',
    action: 'Open banking data enrichment via Plaid',
    op: 'db.loanApplications.updateOne()',
    latency: '3ms',
    icon: '🏦',
    reasoning: 'Plaid data cross-referenced against bank statement to validate stated income. 12-month average monthly deposit ($18,150) aligns within 3% of reported combined income ($18,558/mo).',
    details: {
      input: '{ plaidToken: "access-sandbox-...", months: 12 }',
      output: '{ avg_monthly_income: 18150, recurring_expenses: 9420, savings_rate: 0.48 }',
      tokens: 0,
      model: 'n/a (API)',
    },
  },
  {
    agent: 'Loan App Agent',
    category: 'loanapp',
    action: 'Cross-validation complete. Profile assembled.',
    op: 'db.checkpoints.insert()',
    latency: '6ms',
    icon: '📝',
    reasoning: 'All data sources reconciled. No discrepancies found between T4 income ($222,700), Plaid deposits ($217,800 annualized), and stated income ($222,700). Profile ready for underwriting.',
    details: {
      input: '{ sources: ["CRA_NOA", "bank_stmt", "credit", "plaid"], appId: "MD-00001" }',
      output: '{ profile: "assembled", discrepancies: 0, checkpoint: "cp_78342_01" }',
      tokens: 218,
      model: 'gpt-4o-mini',
    },
  },
  {
    agent: 'Supervisor',
    category: 'supervisor',
    action: 'Routing to Underwriting Agent',
    op: 'state.transition()',
    latency: '1ms',
    icon: '🧭',
    reasoning: 'Origination phase complete with zero discrepancies. Routing to Underwriting Agent for risk assessment. Standard flow — no expedited or manual override flags present.',
    details: {
      input: '{ from: "origination", checkpoint: "cp_78342_01" }',
      output: '{ to: "underwriting", agent: "underwriterAgent" }',
      tokens: 86,
      model: 'gpt-4o-mini',
    },
  },
  {
    agent: 'Underwriting Agent',
    category: 'underwriting',
    action: 'Aggregation pipeline: 7-stage risk scoring',
    op: 'db.riskScores.aggregate()',
    latency: '18ms',
    icon: '📊',
    reasoning: 'Executed 7-stage pipeline: GDS (31.2% — moderate), LTV (80.0% — acceptable), credit depth (10 tradelines, 9yr history — strong), cash flow (positive, 48% savings rate — strong), employment stability (8yr+ current — excellent), collateral ($875K appraised — sufficient), comparable analysis (median Calgary rate 4.79%).',
    details: {
      input: '{ pipeline: "7_stage_risk", appId: "MD-00001" }',
      output: '{ gds: 0.312, ltv: 80.0, credit_depth: "strong", cashflow: "positive", score: 72 }',
      tokens: 0,
      model: 'n/a (aggregation)',
    },
  },
  {
    agent: 'Underwriting Agent',
    category: 'underwriting',
    action: 'Policy RAG via Atlas Vector Search',
    op: 'db.policies.$vectorSearch()',
    latency: '12ms',
    icon: '🔎',
    reasoning: 'Queried institutional policy base with risk profile vector. Top 3 matches: §4.2.1 (hard inquiry threshold), §3.1.4 (property value >$500K review), §3.2.1 (GDS boundary with activity flags). All three triggered review conditions.',
    details: {
      input: '{ query_vector: "[risk_profile_embed]", k: 5, index: "policy_vectors" }',
      output: '{ matches: 3, policies: ["§4.2.1", "§3.1.4", "§3.2.1"], action: "escalate" }',
      tokens: 1204,
      model: 'gpt-4o',
    },
  },
  {
    agent: 'Underwriting Agent',
    category: 'underwriting',
    action: '$graphLookup fraud scan: 3-hop, 2847 entities',
    op: 'db.entities.$graphLookup()',
    latency: '24ms',
    icon: '🕸',
    reasoning: 'Graph traversal found 2,847 linked entities within 3 hops. No known fraud indicators detected. Highest-risk connection: shared address with 2 other recent applicants (flagged low — common multi-unit property).',
    details: {
      input: '{ startWith: "MD-00001", maxDepth: 3, connectFrom: "entity_links" }',
      output: '{ entities: 2847, fraud_signals: 0, risk_connections: 1, risk_level: "low" }',
      tokens: 0,
      model: 'n/a ($graphLookup)',
    },
  },
  {
    agent: 'Underwriting Agent',
    category: 'underwriting',
    action: 'Cash flow analysis complete. Score: 72 (B+)',
    op: 'db.riskScores.insertOne()',
    latency: '4ms',
    icon: '🧠',
    reasoning: 'Final composite score: 72/100 (B+ tier). Score depressed from A-range primarily by 3 hard inquiries in 6 months (§4.2.1 penalty: -8pts). Without inquiry penalty, projected score would be 80 (A-). Recommended rate: 4.89% (B+ base + 12.5bps inquiry surcharge).',
    details: {
      input: '{ factors: ["gds", "ltv", "credit", "cashflow", "employment", "collateral", "comps"] }',
      output: '{ score: 72, tier: "B+", rate: "4.89%", monthly: "$4,047" }',
      tokens: 342,
      model: 'gpt-4o',
    },
  },
  {
    agent: 'HITL Gate',
    category: 'hitl',
    action: 'interrupt() triggered — pending officer review',
    op: 'db.checkpoints.insert()',
    latency: '6ms',
    icon: '✋',
    reasoning: 'Three policy rules triggered mandatory human review: (1) §4.2.1 — 3 hard inquiries in 180 days, (2) §3.1.4 — property value exceeding $500K, (3) §3.2.1 — GDS at 31.2% with recent credit activity. Workflow state persisted to checkpoint for seamless resume after officer decision.',
    details: {
      input: '{ triggers: ["§4.2.1", "§3.1.4", "§3.2.1"], score: 72, amount: 875000 }',
      output: '{ checkpoint: "cp_78342_02", status: "awaiting_human", queue: "officer_review" }',
      tokens: 0,
      model: 'n/a (system)',
    },
  },
];

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'supervisor', label: 'Supervisor' },
  { id: 'loanapp', label: 'Loan App' },
  { id: 'underwriting', label: 'Underwriting' },
  { id: 'hitl', label: 'HITL' },
];

export default function AgentActivityLog({ onEvent, applicationId }) {
  const [entries, setEntries] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // SSE connection for live agent events when applicationId is provided
  useEffect(() => {
    if (!applicationId) {
      setEntries([]);
      return;
    }

    setEntries([]); // Clear entries for new application

    const source = apiSSE(
      `/agent/${applicationId}/stream`,
      (event) => {
        if (event.type === 'agent_step') {
          const liveEntry = {
            id: `live-${Date.now()}-${Math.random()}`,
            agent: event.agent || 'System',
            category: (event.agent || '').toLowerCase().includes('underwrit') ? 'underwriting'
              : (event.agent || '').toLowerCase().includes('supervisor') ? 'supervisor'
              : (event.agent || '').toLowerCase().includes('hitl') ? 'hitl'
              : 'loanapp',
            action: event.action || '',
            op: '', // Live events don't have a separate op field
            latency: '\u2014',
            icon: event.agent === 'underwriter' ? '\ud83d\udcca' : event.agent === 'supervisor' ? '\ud83e\udded' : '\ud83d\udcdd',
            reasoning: event.detail || '',
            details: null,
            time: new Date(event.timestamp || Date.now()).toLocaleTimeString(),
            isLive: true,
          };
          setEntries((prev) => {
            const next = [liveEntry, ...prev];
            return next.length > 100 ? next.slice(0, 100) : next;
          });
          if (onEvent) onEvent(liveEntry);
        }
        if (event.type === 'complete') {
          console.log('[AgentActivityLog] Pipeline complete');
        }
      }
    );

    return () => source?.close();
  }, [applicationId]); // eslint-disable-line react-hooks/exhaustive-deps

  // If no applicationId, show empty state
  if (!applicationId) {
    return (
      <div style={{
        width: 360,
        borderLeft: '1px solid var(--border-dim)',
        background: 'var(--bg-base)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        flexShrink: 0,
      }}>
        <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border-dim)' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13 }}>
            Agent Activity Log
          </div>
        </div>
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-dim)', fontSize: 11, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          Select a live application to view agent activity
        </div>
      </div>
    );
  }

  const filtered = useMemo(() => {
    let result = entries;
    if (activeFilter !== 'all') {
      result = result.filter((e) => e.category === activeFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) => e.action.toLowerCase().includes(q) || e.agent.toLowerCase().includes(q) || e.op.toLowerCase().includes(q)
      );
    }
    return result;
  }, [entries, activeFilter, searchQuery]);

  const costSummary = useMemo(() => {
    let totalTokens = 0;
    let totalLatencyMs = 0;
    let llmCalls = 0;
    let apiCalls = 0;
    let sysCalls = 0;
    entries.forEach((e) => {
      if (e.details) {
        totalTokens += e.details.tokens || 0;
        const model = e.details.model || '';
        if (model.startsWith('gpt') || model.startsWith('voyage')) llmCalls++;
        else if (model.includes('API')) apiCalls++;
        else sysCalls++;
      }
      const ms = parseInt(e.latency, 10);
      if (!isNaN(ms)) totalLatencyMs += ms;
    });
    const costUsd = (totalTokens / 1_000_000) * 8.5;
    return { totalTokens, totalLatencyMs, costUsd, llmCalls, apiCalls, sysCalls };
  }, [entries]);

  return (
    <div style={{
      width: 360,
      borderLeft: '1px solid var(--border-dim)',
      background: 'var(--bg-base)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border-dim)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13 }}>
            Agent Activity Log
          </div>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, fontWeight: 600, color: 'var(--success)' }}>
            <span style={{
              width: 5, height: 5, borderRadius: '50%',
              background: 'var(--success)',
              boxShadow: '0 0 6px var(--success)',
              animation: 'pulse 1.5s infinite',
            }} />
            Live
          </span>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2, marginBottom: 8 }}>
          {entries.length} agent actions · {filtered.length} shown
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search actions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '5px 8px',
            fontSize: 10,
            fontFamily: 'var(--font-body)',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-dim)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-primary)',
            outline: 'none',
            marginBottom: 8,
          }}
        />

        {/* Filter pills */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setActiveFilter(f.id)}
              style={{
                padding: '3px 8px',
                fontSize: 9,
                fontWeight: activeFilter === f.id ? 700 : 500,
                fontFamily: 'var(--font-display)',
                borderRadius: 10,
                border: 'none',
                background: activeFilter === f.id ? 'var(--agent-cyan-dim)' : 'var(--bg-raised)',
                color: activeFilter === f.id ? 'var(--agent-cyan)' : 'var(--text-dim)',
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Entries */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
        {filtered.map((entry) => {
          const isExpanded = expandedId === entry.id;
          return (
            <div
              key={entry.id}
              style={{
                marginBottom: 6,
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-sm)',
                border: `1px solid ${isExpanded ? 'var(--agent-cyan)' : 'var(--border-dim)'}`,
                animation: 'slideDown 0.3s ease-out',
                transition: 'border-color 0.2s',
              }}
            >
              {/* Summary row */}
              <div
                style={{ padding: '8px 10px', cursor: 'pointer' }}
                onClick={() => setExpandedId(isExpanded ? null : entry.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                  <span style={{ fontWeight: 600, fontSize: 11, color: 'var(--text-primary)' }}>
                    {entry.icon} {entry.agent}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-dim)' }}>
                      {entry.time}
                    </span>
                    <span style={{
                      fontSize: 10,
                      color: 'var(--text-dim)',
                      transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)',
                      transition: 'transform 0.2s',
                      display: 'inline-block',
                    }}>
                      ▾
                    </span>
                  </div>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 3 }}>
                  {entry.action}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--agent-cyan)' }}>
                    {entry.op}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--mongo)', fontWeight: 700 }}>
                    {entry.latency}
                  </span>
                </div>
              </div>

              {/* Expanded detail panel */}
              {isExpanded && (
                <div style={{
                  padding: '0 10px 10px',
                  borderTop: '1px solid var(--border-dim)',
                  marginTop: 0,
                }}>
                  {/* Reasoning */}
                  <div style={{ marginTop: 8 }}>
                    <div style={{
                      fontSize: 9,
                      fontWeight: 700,
                      color: 'var(--agent-cyan)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: 4,
                    }}>
                      Reasoning
                    </div>
                    <div style={{
                      fontSize: 10,
                      color: 'var(--text-secondary)',
                      lineHeight: 1.5,
                      padding: '6px 8px',
                      background: 'var(--bg-raised)',
                      borderRadius: 'var(--radius-sm)',
                      borderLeft: '2px solid var(--agent-cyan)',
                    }}>
                      {entry.reasoning}
                    </div>
                  </div>

                  {/* Details grid */}
                  {entry.details && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{
                        fontSize: 9,
                        fontWeight: 700,
                        color: 'var(--text-dim)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        marginBottom: 4,
                      }}>
                        Details
                      </div>
                      <div style={{
                        padding: '6px 8px',
                        background: 'var(--bg-raised)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 9,
                        fontFamily: 'var(--font-mono)',
                      }}>
                        <div style={{ marginBottom: 4 }}>
                          <span style={{ color: 'var(--text-dim)' }}>input: </span>
                          <span style={{ color: 'var(--text-secondary)', wordBreak: 'break-all' }}>{entry.details.input}</span>
                        </div>
                        <div style={{ marginBottom: 4 }}>
                          <span style={{ color: 'var(--text-dim)' }}>output: </span>
                          <span style={{ color: 'var(--text-secondary)', wordBreak: 'break-all' }}>{entry.details.output}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
                          <span>
                            <span style={{ color: 'var(--text-dim)' }}>tokens: </span>
                            <span style={{ color: 'var(--voyage)', fontWeight: 600 }}>{entry.details.tokens}</span>
                          </span>
                          <span>
                            <span style={{ color: 'var(--text-dim)' }}>model: </span>
                            <span style={{ color: 'var(--tool-blue)', fontWeight: 600 }}>{entry.details.model}</span>
                          </span>
                          <span>
                            <span style={{ color: 'var(--text-dim)' }}>latency: </span>
                            <span style={{ color: 'var(--mongo)', fontWeight: 600 }}>{entry.latency}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {entries.length === 0 && (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-dim)', fontSize: 12 }}>
            Waiting for agent activity...
          </div>
        )}
        {entries.length > 0 && filtered.length === 0 && (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-dim)', fontSize: 11 }}>
            No actions match current filters.
          </div>
        )}
      </div>

      {/* Cost summary footer */}
      {entries.length > 0 && (
        <div style={{
          padding: '8px 16px',
          borderTop: '1px solid var(--border-dim)',
          background: 'var(--bg-surface)',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 6,
        }}>
          <div>
            <div style={{ fontSize: 8, color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>Tokens</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--voyage)' }}>
              {costSummary.totalTokens.toLocaleString()}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 8, color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>Est. Cost</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--mongo)' }}>
              ${costSummary.costUsd.toFixed(4)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 8, color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>Latency</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--agent-cyan)' }}>
              {costSummary.totalLatencyMs}ms
            </div>
          </div>
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, fontSize: 9, color: 'var(--text-dim)' }}>
            <span><span style={{ fontWeight: 700, color: 'var(--tool-blue)' }}>{costSummary.llmCalls}</span> LLM</span>
            <span><span style={{ fontWeight: 700, color: 'var(--agent-cyan)' }}>{costSummary.apiCalls}</span> API</span>
            <span><span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>{costSummary.sysCalls}</span> System</span>
          </div>
        </div>
      )}
    </div>
  );
}
