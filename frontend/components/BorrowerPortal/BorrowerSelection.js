'use client';

import { useState } from 'react';
import { spacing } from '@leafygreen-ui/tokens';

const BORROWER_PROFILES = [
  {
    id: 'marcus-delgado',
    firstName: 'Marcus',
    middleInitial: 'A',
    lastName: 'Delgado',
    email: 'marcus.delgado@email.com',
    phone: '(587) 555-0147',
    sin: '***-***-482',
    address: '4821 Varsity Drive NW, Apt 305, Edmonton, AB T5K 2M4',
    employer: 'TechNova Systems Inc.',
    jobTitle: 'Senior Software Engineer',
    yearsEmployed: '8',
    annualIncome: '128500',
    coApplicantName: 'Sofia Delgado',
    coApplicantIncome: '94200',
    propertyAddress: '4718 Coronation Drive SW, Calgary, AB T3E 4Y2',
    annualPropertyTax: '6815',
    loanAmount: '875000',
    loanPurpose: 'Purchase',
    propertyType: 'Detached Home',
    productType: '5yr Fixed (25yr Amort)',
    downPayment: '175000',
    existingDebt: '1842',
    creditScore: '784',
    seedApplicationId: 'APP-2026-00001',
  },
];

function ActiveCard({ profile, onClick }) {
  return (
    <button
      type="button"
      onClick={() => onClick(profile)}
      style={{
        flex: 1,
        minWidth: 260,
        padding: spacing[5],
        background: 'var(--bg-surface)',
        borderRadius: 8,
        border: '1px solid var(--border-dim)',
        cursor: 'pointer',
        textAlign: 'left',
        transition:
          'border-color 0.25s cubic-bezier(0.33, 1, 0.68, 1), box-shadow 0.25s cubic-bezier(0.33, 1, 0.68, 1)',
        position: 'relative',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--mongo)';
        e.currentTarget.style.boxShadow =
          '0 2px 12px rgba(0, 108, 74, 0.10)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-dim)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* Header */}
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 16,
          color: 'var(--text-primary)',
          marginBottom: spacing[1],
        }}
      >
        {profile.firstName} & {profile.coApplicantName.split(' ')[0]}{' '}
        {profile.lastName}
      </div>

      {/* Product */}
      <div
        style={{
          fontSize: 12,
          color: 'var(--text-secondary)',
          marginBottom: spacing[4],
        }}
      >
        {profile.productType}
      </div>

      {/* Details */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: spacing[2],
        }}
      >
        <DetailRow label="Property" value={profile.propertyAddress} />
        <DetailRow
          label="Loan Amount"
          value={`$${Number(profile.loanAmount).toLocaleString('en-US')}`}
          mono
        />
        <DetailRow
          label="Down Payment"
          value={`$${Number(profile.downPayment).toLocaleString('en-US')}`}
          mono
        />
        <DetailRow
          label="Co-Applicant"
          value={profile.coApplicantName}
        />
      </div>

      {/* Key stats strip */}
      <div
        style={{
          display: 'flex',
          gap: spacing[3],
          marginTop: spacing[3],
          paddingTop: spacing[3],
          borderTop: '1px solid var(--border-dim)',
        }}
      >
        <StatBadge
          label="Combined Income"
          value={`$${(Number(profile.annualIncome) + Number(profile.coApplicantIncome)).toLocaleString('en-US')}`}
        />
        <StatBadge
          label="LTV"
          value={`${Math.round(((Number(profile.loanAmount) - Number(profile.downPayment)) / Number(profile.loanAmount)) * 100)}%`}
        />
        <StatBadge label="Credit Score" value={profile.creditScore} />
      </div>

      {/* Select indicator */}
      <div
        style={{
          marginTop: spacing[4],
          padding: '8px 0',
          borderTop: '1px solid var(--border-dim)',
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          fontSize: 12,
          color: 'var(--mongo)',
          textAlign: 'center',
        }}
      >
        Select Profile
      </div>
    </button>
  );
}

function StatBadge({ label, value }) {
  return (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <div
        style={{
          fontSize: 8,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--text-dim)',
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          fontWeight: 700,
          color: 'var(--mongo)',
        }}
      >
        {value}
      </div>
    </div>
  );
}

function DetailRow({ label, value, mono = false }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <div
        style={{
          fontSize: 9,
          fontWeight: 600,
          color: 'var(--text-dim)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 12,
          fontWeight: mono ? 600 : 500,
          fontFamily: mono ? 'var(--font-mono)' : 'inherit',
          color: 'var(--text-primary)',
          lineHeight: 1.3,
        }}
      >
        {value}
      </div>
    </div>
  );
}

const AI_COMPARISON = [
  {
    before: '45+ days',
    after: '~15 minutes',
    label: 'Processing Time',
  },
  {
    before: '8 manual steps',
    after: '2 interactions',
    label: 'Touchpoints',
  },
  {
    before: '5 common errors',
    after: '0 unresolved',
    label: 'Error Resolution',
  },
];

const DEMO_STEPS = [
  {
    icon: '1',
    label: 'Document Verification',
    desc: 'AI verifies tax notices, bank statements, and pay stubs — resolving issues automatically',
    tech: 'Voyage AI multimodal embeddings for document extraction and cross-referencing',
  },
  {
    icon: '2',
    label: 'Credit & Income Analysis',
    desc: 'Automated credit pulls, income reconciliation, and discrepancy resolution',
    tech: 'MongoDB aggregation pipeline for income reconciliation across data sources',
  },
  {
    icon: '3',
    label: 'Underwriting',
    desc: 'Risk scoring, GDS/TDS calculation, OSFI B-20 stress test, and AI-driven corrections',
    tech: '7-stage aggregation pipeline with Atlas Vector Search for policy RAG',
  },
  {
    icon: '4',
    label: 'Officer Review',
    desc: 'Human-in-the-loop review of AI decisions with full intervention history',
    tech: 'LangGraph interrupt() with MongoDBSaver for stateful checkpointing',
  },
];

function HowAIHelpsStrip() {
  return (
    <div
      style={{
        display: 'flex',
        gap: spacing[3],
        justifyContent: 'center',
        marginBottom: spacing[5],
        flexWrap: 'wrap',
      }}
    >
      {AI_COMPARISON.map((item) => (
        <div
          key={item.label}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing[3],
            padding: `${spacing[2]}px ${spacing[3]}px`,
            background: 'var(--bg-surface)',
            borderRadius: 8,
            border: '1px solid var(--border-dim)',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontSize: 8,
                textTransform: 'uppercase',
                color: 'var(--text-dim)',
                fontWeight: 600,
                marginBottom: 2,
              }}
            >
              Traditional
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--danger)',
                textDecoration: 'line-through',
              }}
            >
              {item.before}
            </div>
          </div>
          <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>
            {'\u2192'}
          </span>
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontSize: 8,
                textTransform: 'uppercase',
                color: 'var(--text-dim)',
                fontWeight: 600,
                marginBottom: 2,
              }}
            >
              Agentic Lending Platform
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--mongo)',
              }}
            >
              {item.after}
            </div>
          </div>
          <div
            style={{
              fontSize: 8,
              fontWeight: 600,
              color: 'var(--text-dim)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              borderLeft: '1px solid var(--border-dim)',
              paddingLeft: spacing[2],
            }}
          >
            {item.label}
          </div>
        </div>
      ))}
    </div>
  );
}

function DemoFlowCard() {
  const [expandedStep, setExpandedStep] = useState(null);

  return (
    <div
      style={{
        flex: 1,
        minWidth: 260,
        maxWidth: 420,
        padding: spacing[5],
        borderRadius: 8,
        border: '1px solid var(--border-dim)',
        background: 'var(--bg-surface)',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 14,
          color: 'var(--text-primary)',
          marginBottom: 4,
        }}
      >
        What this demo covers
      </div>
      <div
        style={{
          fontSize: 11,
          color: 'var(--text-secondary)',
          lineHeight: 1.5,
          marginBottom: spacing[4],
        }}
      >
        A complete AI-assisted mortgage application powered by MongoDB
        and multi-agent AI. Click each step to see the technology.
      </div>
      <div
        style={{ display: 'flex', flexDirection: 'column', gap: 0 }}
      >
        {DEMO_STEPS.map((step, idx) => (
          <div key={step.icon}>
            <button
              type="button"
              onClick={() =>
                setExpandedStep(expandedStep === idx ? null : idx)
              }
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
                width: '100%',
                textAlign: 'left',
                font: 'inherit',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: `${spacing[2]}px 0`,
                position: 'relative',
              }}
            >
              <div
                style={{
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background:
                      expandedStep === idx
                        ? 'var(--mongo)'
                        : 'var(--mongo-dim)',
                    color:
                      expandedStep === idx ? '#fff' : 'var(--mongo)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    fontWeight: 700,
                    flexShrink: 0,
                    transition: 'all 200ms ease',
                  }}
                >
                  {step.icon}
                </div>
                {idx < DEMO_STEPS.length - 1 && (
                  <div
                    style={{
                      width: 2,
                      height: 12,
                      background: 'var(--mongo-dim)',
                      marginTop: 2,
                    }}
                  />
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 600,
                    fontSize: 12,
                    color: 'var(--text-primary)',
                    marginBottom: 1,
                  }}
                >
                  {step.label}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: 'var(--text-dim)',
                    lineHeight: 1.4,
                  }}
                >
                  {step.desc}
                </div>
              </div>
            </button>
            {expandedStep === idx && (
              <div
                style={{
                  marginLeft: 32,
                  padding: '6px 10px',
                  background: 'var(--mongo-dim)',
                  borderRadius: 6,
                  border: '1px solid var(--mongo)',
                  marginBottom: spacing[2],
                  animation:
                    'thinkingFade 200ms cubic-bezier(0.33, 1, 0.68, 1) both',
                }}
              >
                <div
                  style={{
                    fontSize: 8,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--mongo)',
                    fontFamily: 'var(--font-display)',
                    marginBottom: 2,
                  }}
                >
                  Powered By
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: 'var(--text-secondary)',
                    lineHeight: 1.4,
                  }}
                >
                  {step.tech}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BorrowerSelection({ onSelect }) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing[6],
        background: 'var(--bg-void)',
        minHeight: 'calc(100vh - 52px)',
      }}
    >
      {/* Title */}
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: 24,
          color: 'var(--text-primary)',
          marginBottom: spacing[2],
        }}
      >
        Select Borrower Profile
      </div>
      <div
        style={{
          fontSize: 13,
          color: 'var(--text-secondary)',
          marginBottom: spacing[6],
        }}
      >
        Choose a borrower profile to begin the application process.
      </div>

      {/* How AI Helps strip */}
      <HowAIHelpsStrip />

      {/* Card grid */}
      <div
        style={{
          display: 'flex',
          gap: spacing[4],
          maxWidth: 960,
          width: '100%',
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}
      >
        {BORROWER_PROFILES.map((profile) => (
          <ActiveCard
            key={profile.id}
            profile={profile}
            onClick={onSelect}
          />
        ))}
        <DemoFlowCard />
      </div>
    </div>
  );
}

export { BORROWER_PROFILES };
