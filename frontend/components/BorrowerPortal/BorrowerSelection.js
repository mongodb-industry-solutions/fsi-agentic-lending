'use client';

import { useState } from 'react';
import { spacing } from '@leafygreen-ui/tokens';
import Avatar from 'boring-avatars';

const AVATAR_COLORS = {
  'marcus-delgado': ['#00684A', '#00ED64', '#023430', '#E3FCF7', '#004D3A'],
  'jane-doe':       ['#6341e0', '#8B6CE7', '#4A2DB3', '#EDE8FC', '#7B5FD4'],
  'john-smith':     ['#d97706', '#F59E0B', '#B45309', '#FEF3C7', '#D69E2E'],
  'bob-johnson':    ['#DB3030', '#EF4444', '#991B1B', '#FEE2E2', '#C53030'],
  'sarah-williams': ['#0891b2', '#06B6D4', '#155E75', '#CFFAFE', '#0E7490'],
};

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
    pipelineHint: 'Officer Review',
    narrative: 'Strong finances but $875K purchase exceeds the $500K auto-approval threshold — triggers mandatory officer review.',
    riskFactors: ['Purchase > $500K', 'Excellent credit offsets risk', 'Expect: Officer approves as-is'],
  },
  {
    id: 'jane-doe',
    firstName: 'Jane',
    middleInitial: 'M',
    lastName: 'Doe',
    email: 'jane.doe@email.com',
    phone: '(604) 555-0231',
    sin: '***-***-719',
    address: '2150 Marine Drive, Apt 804, West Vancouver, BC V7V 1K4',
    employer: 'Pacific Coast Medical Group',
    jobTitle: 'Nurse Practitioner',
    yearsEmployed: '6',
    annualIncome: '95000',
    coApplicantName: 'John Doe',
    coApplicantIncome: '70000',
    propertyAddress: '1438 Garden Terrace, Burnaby, BC V5A 3G2',
    annualPropertyTax: '3950',
    loanAmount: '425000',
    loanPurpose: 'Purchase',
    propertyType: 'Townhouse',
    productType: '5yr Fixed (25yr Amort)',
    downPayment: '85000',
    existingDebt: '650',
    creditScore: '798',
    seedApplicationId: 'APP-2026-00002',
    pipelineHint: 'Auto-Approve',
    narrative: 'Clean credit, low ratios, and purchase under $500K — qualifies for fully autonomous approval with no officer intervention.',
    riskFactors: ['All ratios well under limits', 'Both scores > 750', 'Expect: ~15s end-to-end'],
  },
  {
    id: 'john-smith',
    firstName: 'John',
    middleInitial: 'R',
    lastName: 'Smith',
    email: 'john.smith@email.com',
    phone: '(416) 555-0384',
    sin: '***-***-256',
    address: '88 Harbour Street, Unit 1207, Toronto, ON M5J 2L4',
    employer: 'Meridian Creative Agency',
    jobTitle: 'Marketing Manager',
    yearsEmployed: '2',
    annualIncome: '108000',
    coApplicantName: '',
    coApplicantIncome: '0',
    propertyAddress: '55 Bremner Blvd, Unit 3402, Toronto, ON M5J 0A6',
    annualPropertyTax: '4200',
    loanAmount: '490000',
    loanPurpose: 'Purchase',
    propertyType: 'Condo',
    productType: '5yr Fixed (25yr Amort)',
    downPayment: '98000',
    existingDebt: '400',
    creditScore: '695',
    seedApplicationId: 'APP-2026-00003',
    pipelineHint: 'Borderline',
    narrative: 'Borderline 695 credit score and elevated stress-test ratios push risk to Tier C — requires officer judgment call.',
    riskFactors: ['Credit 695 (borderline)', 'Stress GDS > 36% threshold', 'Expect: Officer modifies terms'],
  },
  {
    id: 'bob-johnson',
    firstName: 'Bob',
    middleInitial: 'T',
    lastName: 'Johnson',
    email: 'bob.johnson@email.com',
    phone: '(905) 555-0672',
    sin: '***-***-903',
    address: '312 Lakeshore Road E, Oakville, ON L6J 1J6',
    employer: 'Great Lakes Logistics Ltd.',
    jobTitle: 'Operations Coordinator',
    yearsEmployed: '3',
    annualIncome: '85000',
    coApplicantName: 'Alice Johnson',
    coApplicantIncome: '50000',
    propertyAddress: '27 Chartwell Crescent, Oakville, ON L6J 3Z8',
    annualPropertyTax: '9200',
    loanAmount: '1200000',
    loanPurpose: 'Purchase',
    propertyType: 'Detached Home',
    productType: '5yr Fixed (25yr Amort)',
    downPayment: '240000',
    existingDebt: '3070',
    creditScore: '648',
    seedApplicationId: 'APP-2026-00004',
    pipelineHint: 'Decline',
    narrative: 'High debt load on modest income causes stress test failure (GDS exceeds limit) — automatic decline by policy.',
    riskFactors: ['High-risk credit (648/612)', 'Stress GDS fails 39% limit', 'Expect: Immediate decline'],
  },
  {
    id: 'sarah-williams',
    firstName: 'Sarah',
    middleInitial: 'K',
    lastName: 'Williams',
    email: 'sarah.williams@email.com',
    phone: '(613) 555-0892',
    sin: '***-***-641',
    address: '45 Sparks Street, Unit 1504, Ottawa, ON K1P 5A5',
    employer: 'Shopify Inc.',
    jobTitle: 'Senior Data Analyst',
    yearsEmployed: '4',
    annualIncome: '115000',
    coApplicantName: '',
    coApplicantIncome: '0',
    propertyAddress: '280 Metcalfe Street, Unit 801, Ottawa, ON K2P 1R7',
    annualPropertyTax: '3800',
    loanAmount: '455000',
    loanPurpose: 'Purchase',
    propertyType: 'Condo',
    productType: '5yr Fixed (25yr Amort)',
    downPayment: '91000',
    existingDebt: '350',
    creditScore: '760',
    seedApplicationId: 'APP-2026-00005',
    pipelineHint: 'Doc Issue \u2192 Fix \u2192 Approve',
    narrative: 'Strong finances but incomplete documentation \u2014 AI detects missing pay stubs, pauses processing, and guides resolution via chat before approving.',
    riskFactors: ['Missing pay stubs blocks pipeline', 'Strong credit (760)', 'Expect: Upload \u2192 re-evaluate \u2192 auto-approve'],
  },
];

function ActiveCard({ profile, onClick, colors, submissionStatus }) {
  const isSubmitted = !!submissionStatus;
  return (
    <button
      type="button"
      onClick={() => onClick(profile)}
      style={{
        flex: '0 0 auto',
        width: 200,
        padding: `${spacing[3]}px ${spacing[2]}px`,
        background: 'var(--bg-surface)',
        borderRadius: 10,
        border: isSubmitted ? '1px solid var(--mongo)' : '1px solid var(--border-dim)',
        cursor: 'pointer',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: spacing[2],
        transition: 'var(--transition-base)',
        position: 'relative',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--mongo)';
        e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 108, 74, 0.12)';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = isSubmitted ? 'var(--mongo)' : 'var(--border-dim)';
        e.currentTarget.style.boxShadow = isSubmitted ? '0 2px 8px rgba(0, 108, 74, 0.08)' : 'none';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {/* Submission status pill */}
      {isSubmitted && (() => {
        const STATUS_PILL = {
          approved: { label: 'Approved', bg: 'var(--success-dim)', color: 'var(--success)' },
          declined: { label: 'Declined', bg: 'var(--danger-dim)', color: 'var(--danger)' },
          review: { label: 'In Review', bg: 'var(--hitl-amber-dim)', color: 'var(--hitl-amber)' },
          action_required: { label: 'Action Req.', bg: 'var(--hitl-amber-dim)', color: 'var(--hitl-amber)' },
          error: { label: 'Error', bg: 'var(--danger-dim)', color: 'var(--danger)' },
        };
        const pill = STATUS_PILL[submissionStatus] || { label: 'Tracking', bg: 'var(--mongo-dim)', color: 'var(--mongo)' };
        return (
          <div style={{
            position: 'absolute', top: 6, right: 6,
            padding: '2px 6px', borderRadius: 4,
            fontSize: 8, fontWeight: 700, fontFamily: 'var(--font-mono)',
            textTransform: 'uppercase', letterSpacing: '0.04em',
            background: pill.bg, color: pill.color,
          }}>
            {pill.label}
          </div>
        );
      })()}

      {/* Avatar */}
      <Avatar
        size={48}
        name={`${profile.firstName} ${profile.lastName}`}
        variant="beam"
        colors={colors}
      />

      {/* Name */}
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 14,
          color: 'var(--text-primary)',
          lineHeight: 1.2,
        }}
      >
        {profile.coApplicantName
          ? `${profile.firstName} & ${profile.coApplicantName.split(' ')[0]}`
          : `${profile.firstName} ${profile.lastName}`}
      </div>

      {/* Pipeline hint badge */}
      {profile.pipelineHint && (
        <div
          style={{
            padding: '3px 10px',
            borderRadius: 4,
            fontSize: 9,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            fontFamily: 'var(--font-mono)',
            background: profile.pipelineHint === 'Auto-Approve'
              ? 'var(--success-dim)'
              : profile.pipelineHint === 'Decline'
                ? 'var(--danger-dim)'
                : 'var(--hitl-amber-dim)',
            color: profile.pipelineHint === 'Auto-Approve'
              ? 'var(--success)'
              : profile.pipelineHint === 'Decline'
                ? 'var(--danger)'
                : 'var(--hitl-amber)',
          }}
        >
          {profile.pipelineHint}
        </div>
      )}

      {/* Divider + stats */}
      <div
        style={{
          width: '100%',
          paddingTop: spacing[2],
          borderTop: '1px solid var(--border-dim)',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-dim)', marginBottom: 2 }}>
            Loan
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
            ${Number(profile.loanAmount).toLocaleString('en-US')}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-dim)', marginBottom: 2 }}>
            Credit
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
            {profile.creditScore}
          </div>
        </div>
      </div>
    </button>
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
        width: '100%',
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

export default function BorrowerSelection({ onSelect, submittedApps = {} }) {
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

      {/* Card row — single line, horizontal scroll on narrow viewports */}
      <div
        style={{
          display: 'flex',
          gap: spacing[3],
          maxWidth: 1200,
          width: '100%',
          flexWrap: 'nowrap',
          justifyContent: 'center',
          overflowX: 'auto',
          paddingBottom: spacing[2],
        }}
      >
        {BORROWER_PROFILES.map((profile) => (
          <ActiveCard
            key={profile.id}
            profile={profile}
            onClick={onSelect}
            colors={AVATAR_COLORS[profile.id]}
            submissionStatus={submittedApps[profile.id]?.lastKnownStatus || null}
          />
        ))}
      </div>

      {/* Demo info section */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          maxWidth: 720,
          width: '100%',
          marginTop: spacing[5],
        }}
      >
        <DemoFlowCard />
      </div>
    </div>
  );
}

export { BORROWER_PROFILES };
