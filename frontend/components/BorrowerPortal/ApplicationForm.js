"use client";

import { useState, useEffect, useMemo } from 'react';
import { spacing } from '@leafygreen-ui/tokens';
import TextInput from '@leafygreen-ui/text-input';

function ReadOnlySection({ title, fields, badge }) {
  return (
    <div style={{ marginBottom: spacing[4] }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        marginBottom: spacing[3], paddingBottom: spacing[2],
        borderBottom: '1px solid var(--border-dim)',
      }}>
        <div style={{
          fontFamily: 'var(--font-display)', fontWeight: 700,
          fontSize: 13, color: 'var(--text-primary)',
        }}>
          {title}
        </div>
        {badge && (
          <span style={{
            fontSize: 8, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.05em', padding: '2px 6px', borderRadius: 4,
            background: 'var(--success-dim)', color: 'var(--success)',
          }}>
            Verified
          </span>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: `${spacing[2]}px ${spacing[4]}px` }}>
        {fields.map(({ label, value, span2, mono }) => (
          <div key={label} style={{ gridColumn: span2 ? 'span 2' : undefined }}>
            <div style={{
              fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
              letterSpacing: '0.04em', color: 'var(--text-dim)',
              marginBottom: 2,
            }}>
              {label}
            </div>
            <div style={{
              fontSize: 13,
              fontFamily: mono ? 'var(--font-mono)' : 'var(--font-display)',
              fontWeight: 600,
              color: value ? 'var(--text-primary)' : 'var(--text-dim)',
              lineHeight: 1.4,
            }}>
              {value || 'N/A'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EditableSection({ title, children }) {
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

function Field({ label, value, onChange, type = 'text', span2 = false, readOnly = false, error }) {
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
        state={error ? 'error' : 'none'}
        errorMessage={error || undefined}
      />
    </div>
  );
}

function formatCurrency(value) {
  const num = parseFloat(value);
  if (isNaN(num)) return 'N/A';
  return `$${num.toLocaleString('en-US')}`;
}

export default function ApplicationForm({ onSubmit, borrowerProfile }) {
  const [form, setForm] = useState(borrowerProfile || {});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (borrowerProfile) setForm(borrowerProfile);
  }, [borrowerProfile]);

  const validate = () => {
    const errs = {};
    const purchasePrice = parseFloat(form.loanAmount);
    const downPayment = parseFloat(form.downPayment);
    if (!purchasePrice || purchasePrice <= 0) errs.loanAmount = 'Purchase price is required';
    if (isNaN(downPayment) || downPayment < 0) errs.downPayment = 'Down payment is required';
    else if (purchasePrice && downPayment >= purchasePrice) errs.downPayment = 'Must be less than purchase price';
    return errs;
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setIsSubmitting(true);
    try {
      await onSubmit(form);
    } finally {
      setIsSubmitting(false);
    }
  };

  const update = (field) => (value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => { const next = { ...prev }; delete next[field]; return next; });
  };

  const debtRatio = useMemo(() => {
    const purchasePrice = parseFloat(form.loanAmount || 0);
    const downPayment = parseFloat(form.downPayment || 0);
    const loanAmount = purchasePrice - downPayment;
    const rate = 0.0489;
    const months = 25 * 12;
    const monthlyRate = rate / 12;
    const monthlyPayment = loanAmount > 0
      ? (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1)
      : 0;

    const annualIncome = parseFloat(form.annualIncome || 0) + parseFloat(form.coApplicantIncome || 0);
    const monthlyIncome = annualIncome / 12;
    const existingDebt = parseFloat(form.existingDebt || 0);

    if (monthlyIncome <= 0) return { ratio: 0, monthly: 0, gds: 0 };

    const annualPropertyTax = parseFloat(form.annualPropertyTax || 0);
    const monthlyTax = annualPropertyTax / 12;
    const gds = ((monthlyPayment + monthlyTax) / monthlyIncome) * 100;
    const tds = ((monthlyPayment + monthlyTax + existingDebt) / monthlyIncome) * 100;

    return { ratio: tds, monthly: monthlyPayment, gds };
  }, [form.loanAmount, form.downPayment, form.annualIncome, form.coApplicantIncome, form.existingDebt, form.annualPropertyTax]);

  return (
    <form onSubmit={handleFormSubmit} style={{ flex: 1, overflowY: 'auto', padding: `${spacing[5]}px ${spacing[6]}px` }}>
      <div style={{
        fontFamily: 'var(--font-display)', fontWeight: 800,
        fontSize: 20, marginBottom: 4, color: 'var(--text-primary)',
      }}>
        Loan Application
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 20 }}>
        Borrower identity verified. Adjust loan parameters below.
      </div>

      {/* Read-only: Personal Information */}
      <ReadOnlySection
        title="Personal Information"
        badge
        fields={[
          { label: 'First Name', value: form.firstName },
          { label: 'Last Name', value: form.lastName },
          { label: 'Email', value: form.email },
          { label: 'Phone', value: form.phone },
          { label: 'SIN (masked)', value: form.sin, mono: true },
          { label: 'Address', value: form.address, span2: true },
        ]}
      />

      {/* Read-only: Co-Applicant */}
      {(form.coApplicantName) && (
        <ReadOnlySection
          title="Co-Applicant"
          badge
          fields={[
            { label: 'Co-Applicant Name', value: form.coApplicantName },
            { label: 'Co-Applicant Income', value: formatCurrency(form.coApplicantIncome), mono: true },
          ]}
        />
      )}

      {/* Read-only: Employment */}
      <ReadOnlySection
        title="Employment"
        badge
        fields={[
          { label: 'Employer', value: form.employer },
          { label: 'Job Title', value: form.jobTitle },
          { label: 'Years Employed', value: form.yearsEmployed, mono: true },
          { label: 'Annual Income', value: formatCurrency(form.annualIncome), mono: true },
          { label: 'Credit Score (est.)', value: form.creditScore, mono: true },
        ]}
      />

      {/* Editable: Loan Details */}
      <EditableSection title="Loan Parameters">
        <Field label="Purchase Price ($)" value={form.loanAmount} onChange={update('loanAmount')} error={errors.loanAmount} />
        <Field label="Down Payment ($)" value={form.downPayment} onChange={update('downPayment')} error={errors.downPayment} />
        <Field label="Purpose" value={form.loanPurpose} onChange={update('loanPurpose')} />
        <Field label="Property Type" value={form.propertyType} onChange={update('propertyType')} />
        <Field label="Product Type" value={form.productType} onChange={update('productType')} />
        <Field label="Annual Property Tax ($)" value={form.annualPropertyTax} onChange={update('annualPropertyTax')} />
        <Field label="Property Address" value={form.propertyAddress} onChange={update('propertyAddress')} span2 />
      </EditableSection>

      {/* Editable: Financial */}
      <EditableSection title="Financial Summary">
        <Field label="Existing Monthly Debt ($)" value={form.existingDebt} onChange={update('existingDebt')} />
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6 }}>
          <div>
            <div style={{ fontSize: 9, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 1 }}>
              EST. MONTHLY PAYMENT
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
              ${debtRatio.monthly > 0 ? Math.round(debtRatio.monthly).toLocaleString('en-US') : '—'}
            </div>
          </div>
          <div style={{
            display: 'flex', gap: spacing[4], paddingTop: 4,
            borderTop: '1px solid var(--border-dim)',
          }}>
            <div>
              <div style={{ fontSize: 9, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 1 }}>
                GDS
              </div>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700,
                color: debtRatio.gds > 39 ? 'var(--danger)' : debtRatio.gds > 32 ? 'var(--hitl-amber)' : 'var(--mongo)',
              }}>
                {debtRatio.gds > 0 ? `${debtRatio.gds.toFixed(1)}%` : '—'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 1 }}>
                TDS
              </div>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700,
                color: debtRatio.ratio > 44 ? 'var(--danger)' : debtRatio.ratio > 37 ? 'var(--hitl-amber)' : 'var(--mongo)',
              }}>
                {debtRatio.ratio > 0 ? `${debtRatio.ratio.toFixed(1)}%` : '—'}
              </div>
            </div>
          </div>
        </div>
      </EditableSection>

      <button
        type="submit"
        disabled={isSubmitting}
        style={{
          width: '100%', padding: 14,
          borderRadius: 'var(--radius-md)', border: 'none',
          background: 'var(--mongo)', color: '#fff',
          fontFamily: 'var(--font-display)', fontWeight: 700,
          fontSize: 14, cursor: 'pointer', marginTop: 8,
          position: 'relative',
          opacity: isSubmitting ? 0.85 : 1,
          pointerEvents: isSubmitting ? 'none' : 'auto',
        }}
      >
        {isSubmitting && (
          <span style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{
              width: 14, height: 14,
              border: '2px solid rgba(255,255,255,0.3)',
              borderTopColor: '#fff', borderRadius: '50%',
              animation: 'spin 0.6s linear infinite',
            }} />
          </span>
        )}
        <span style={{ visibility: isSubmitting ? 'hidden' : 'visible' }}>
          Submit Application
        </span>
      </button>
    </form>
  );
}
