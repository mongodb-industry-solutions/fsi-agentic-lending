"use client";

import { useState } from 'react';
import { spacing } from '@leafygreen-ui/tokens';
import TextInput from '@leafygreen-ui/text-input';

const INITIAL_DATA = {
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
};

function FormSection({ title, children }) {
  return (
    <div style={{ marginBottom: spacing[5] }}>
      <div style={{
        fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13,
        color: 'var(--text-primary)', marginBottom: spacing[3], paddingBottom: spacing[2],
        borderBottom: '1px solid var(--border-dim)',
      }}>
        {title}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing[3] }}>
        {children}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', span2 = false, readOnly = false }) {
  const fieldId = `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '')}`;
  return (
    <div style={{ gridColumn: span2 ? 'span 2' : undefined }}>
      <TextInput
        id={fieldId}
        label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={readOnly}
        type={type}
        sizeVariant="small"
      />
    </div>
  );
}

export default function ApplicationForm({ onSubmit }) {
  const [form, setForm] = useState(INITIAL_DATA);

  const update = (field) => (value) => setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: `${spacing[5]}px ${spacing[6]}px` }}>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, marginBottom: 4, color: 'var(--text-primary)' }}>
        Loan Application
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 20 }}>
        Complete your application below. All fields are pre-verified.
      </div>


      <FormSection title="Personal Information">
        <Field label="First Name" value={form.firstName} onChange={update('firstName')} />
        <Field label="Last Name" value={form.lastName} onChange={update('lastName')} />
        <Field label="Email" value={form.email} onChange={update('email')} type="email" />
        <Field label="Phone" value={form.phone} onChange={update('phone')} />
        <Field label="SIN (masked)" value={form.sin} onChange={update('sin')} readOnly />
        <Field label="Address" value={form.address} onChange={update('address')} span2 />
      </FormSection>

      <FormSection title="Co-Applicant">
        <Field label="Co-Applicant Name" value={form.coApplicantName} onChange={update('coApplicantName')} />
        <Field label="Co-Applicant Income ($)" value={form.coApplicantIncome} onChange={update('coApplicantIncome')} />
      </FormSection>

      <FormSection title="Employment">
        <Field label="Employer" value={form.employer} onChange={update('employer')} />
        <Field label="Job Title" value={form.jobTitle} onChange={update('jobTitle')} />
        <Field label="Years Employed" value={form.yearsEmployed} onChange={update('yearsEmployed')} />
        <Field label="Annual Income ($)" value={form.annualIncome} onChange={update('annualIncome')} />
      </FormSection>

      <FormSection title="Loan Details">
        <Field label="Purchase Price ($)" value={form.loanAmount} onChange={update('loanAmount')} />
        <Field label="Down Payment ($)" value={form.downPayment} onChange={update('downPayment')} />
        <Field label="Purpose" value={form.loanPurpose} onChange={update('loanPurpose')} />
        <Field label="Property Type" value={form.propertyType} onChange={update('propertyType')} />
        <Field label="Product Type" value={form.productType} onChange={update('productType')} />
        <Field label="Credit Score (est.)" value={form.creditScore} onChange={update('creditScore')} readOnly />
        <Field label="Property Address" value={form.propertyAddress} onChange={update('propertyAddress')} span2 />
        <Field label="Annual Property Tax ($)" value={form.annualPropertyTax} onChange={update('annualPropertyTax')} />
      </FormSection>

      <FormSection title="Financial Summary">
        <Field label="Existing Monthly Debt ($)" value={form.existingDebt} onChange={update('existingDebt')} />
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2 }}>EST. DEBT RATIO</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 800, color: 'var(--mongo)' }}>
            {((parseFloat(form.existingDebt || 0) + 4047) / ((parseFloat(form.annualIncome || 0) + parseFloat(form.coApplicantIncome || 0)) / 12) * 100).toFixed(1)}%
          </div>
        </div>
      </FormSection>

      <button
        type="button"
        onClick={() => onSubmit(form)}
        style={{
          width: '100%',
          padding: 14,
          borderRadius: 'var(--radius-md)',
          border: 'none',
          background: 'var(--mongo)',
          color: '#fff',
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 14,
          cursor: 'pointer',
          marginTop: 8,
        }}
      >
        Submit Application
      </button>
    </div>
  );
}
