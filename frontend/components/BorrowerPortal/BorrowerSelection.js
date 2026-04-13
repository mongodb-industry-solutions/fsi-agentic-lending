"use client";

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
        transition: 'border-color 0.25s cubic-bezier(0.33, 1, 0.68, 1), box-shadow 0.25s cubic-bezier(0.33, 1, 0.68, 1)',
        position: 'relative',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--mongo)';
        e.currentTarget.style.boxShadow = '0 2px 12px rgba(0, 108, 74, 0.10)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-dim)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* Header */}
      <div style={{
        fontFamily: 'var(--font-display)',
        fontWeight: 700,
        fontSize: 16,
        color: 'var(--text-primary)',
        marginBottom: spacing[1],
      }}>
        {profile.firstName} & {profile.coApplicantName.split(' ')[0]} {profile.lastName}
      </div>

      {/* Product */}
      <div style={{
        fontSize: 12,
        color: 'var(--text-secondary)',
        marginBottom: spacing[4],
      }}>
        {profile.productType}
      </div>

      {/* Details */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[2] }}>
        <DetailRow label="Property" value={profile.propertyAddress} />
        <DetailRow label="Loan Amount" value={`$${Number(profile.loanAmount).toLocaleString('en-US')}`} mono />
        <DetailRow label="Down Payment" value={`$${Number(profile.downPayment).toLocaleString('en-US')}`} mono />
        <DetailRow label="Co-Applicant" value={profile.coApplicantName} />
      </div>

      {/* Select indicator */}
      <div style={{
        marginTop: spacing[4],
        padding: '8px 0',
        borderTop: '1px solid var(--border-dim)',
        fontFamily: 'var(--font-display)',
        fontWeight: 600,
        fontSize: 12,
        color: 'var(--mongo)',
        textAlign: 'center',
      }}>
        Select Profile
      </div>
    </button>
  );
}

function DetailRow({ label, value, mono = false }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <div style={{
        fontSize: 9,
        fontWeight: 600,
        color: 'var(--text-dim)',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 12,
        fontWeight: mono ? 600 : 500,
        fontFamily: mono ? 'var(--font-mono)' : 'inherit',
        color: 'var(--text-primary)',
        lineHeight: 1.3,
      }}>
        {value}
      </div>
    </div>
  );
}

function PlaceholderCard() {
  return (
    <div style={{
      flex: 1,
      minWidth: 260,
      padding: spacing[5],
      borderRadius: 8,
      border: '2px dashed var(--border-dim)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 240,
    }}>
      <div style={{
        fontFamily: 'var(--font-display)',
        fontWeight: 600,
        fontSize: 13,
        color: 'var(--text-dim)',
      }}>
        Coming Soon
      </div>
    </div>
  );
}

export default function BorrowerSelection({ onSelect }) {
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing[6],
      background: 'var(--bg-void)',
      minHeight: 'calc(100vh - 52px)',
    }}>
      {/* Title */}
      <div style={{
        fontFamily: 'var(--font-display)',
        fontWeight: 800,
        fontSize: 24,
        color: 'var(--text-primary)',
        marginBottom: spacing[2],
      }}>
        Select Borrower Profile
      </div>
      <div style={{
        fontSize: 13,
        color: 'var(--text-secondary)',
        marginBottom: spacing[6],
      }}>
        Choose a borrower profile to begin the application process.
      </div>

      {/* Card grid */}
      <div style={{
        display: 'flex',
        gap: spacing[4],
        maxWidth: 960,
        width: '100%',
        flexWrap: 'wrap',
        justifyContent: 'center',
      }}>
        {BORROWER_PROFILES.map((profile) => (
          <ActiveCard key={profile.id} profile={profile} onClick={onSelect} />
        ))}
        <PlaceholderCard />
        <PlaceholderCard />
      </div>
    </div>
  );
}

export { BORROWER_PROFILES };
