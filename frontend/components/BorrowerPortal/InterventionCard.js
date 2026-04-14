"use client";

import { useState, useEffect } from 'react';
import { spacing } from '@leafygreen-ui/tokens';
import { apiPost } from '../../lib/api';

const DOC_TYPE_LABELS = {
  government_id: 'Government ID',
  employment_letter: 'Employment Letter',
  paystubs: 'Pay Stubs',
  income_tax: 'CRA Tax Notices',
  bank_statements: 'Bank Statements',
  purchase_agreement: 'Purchase Agreement',
  investment_statements: 'Investment Statements',
  other_property_docs: 'Property Docs',
  mortgage_application: 'Mortgage Application',
  utility_bills: 'Utility Bills',
  credit_report: 'Credit Report',
  car_loan_statement: 'Car Loan Statement',
  property_tax: 'Property Tax',
  property_inspection: 'Property Inspection',
};

export function InterventionCard({ intervention, onResolve, resolving, applicationId }) {
  const isResolved = intervention._resolved;
  const ctx = intervention.borrower_context || {};
  const [elapsed, setElapsed] = useState(0);
  const [uploading, setUploading] = useState(null);
  const [uploadedTypes, setUploadedTypes] = useState([]);

  useEffect(() => {
    if (isResolved) return;
    const createdAt = intervention.created_at ? new Date(intervention.created_at).getTime() : Date.now();
    const tick = () => setElapsed(Date.now() - createdAt);
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [intervention.created_at, isResolved]);

  const isUrgent = !isResolved && elapsed > 30000;

  const missingDocTypes = (intervention.type === 'missing_document' || intervention.type === 'document_processing_error')
    ? (ctx.document_types_accepted || [])
    : [];

  const handleDemoUpload = async (docType) => {
    if (!applicationId || uploading) return;
    setUploading(docType);
    try {
      const result = await apiPost(`/applications/${applicationId}/documents/demo-upload/${docType}`, {});
      if (result && !result.error) {
        setUploadedTypes(prev => [...prev, docType]);
      }
    } catch (err) {
      console.warn('[InterventionCard] demo upload failed:', err);
    }
    setUploading(null);
  };

  return (
    <div style={{
      margin: `${spacing[2]}px 0`,
      padding: spacing[3],
      background: isResolved ? 'var(--success-dim)' : 'var(--hitl-amber-dim)',
      borderRadius: 8,
      border: `1px solid ${isResolved ? 'var(--success)' : 'var(--hitl-amber)'}`,
      borderLeft: `3px solid ${isResolved ? 'var(--success)' : 'var(--hitl-amber)'}`,
      transition: 'all 300ms cubic-bezier(0.33, 1, 0.68, 1)',
      animation: isUrgent
        ? 'cardEnter 0.3s cubic-bezier(0.4, 0, 0.2, 1) both, urgencyPulse 2s ease-in-out infinite'
        : 'cardEnter 0.3s cubic-bezier(0.4, 0, 0.2, 1) both',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{
          fontSize: 8, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.05em',
          padding: '2px 6px', borderRadius: 4,
          background: isResolved ? 'var(--success)' : 'var(--hitl-amber)',
          color: '#FFFFFF',
        }}>
          {isResolved ? 'Resolved' : intervention.status || 'Action Required'}
        </span>
        {isUrgent && (
          <span style={{
            fontSize: 8, fontWeight: 700, fontFamily: 'var(--font-mono)',
            color: 'var(--hitl-amber)', animation: 'pulse 1.5s infinite',
          }}>
            Pending {Math.floor(elapsed / 1000)}s
          </span>
        )}
        <span style={{
          fontSize: 9, color: 'var(--text-dim)', fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: '0.03em',
        }}>
          {intervention.type?.replace(/_/g, ' ') || 'Intervention'}
        </span>
      </div>

      {ctx.summary && (
        <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5, marginBottom: 4 }}>
          {ctx.summary}
        </div>
      )}
      {ctx.action_required && !isResolved && (
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: 8 }}>
          {ctx.action_required}
        </div>
      )}

      {/* Upload buttons for missing document types */}
      {!isResolved && missingDocTypes.length > 0 && applicationId && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {missingDocTypes.map((docType) => {
            const alreadyUploaded = uploadedTypes.includes(docType);
            const isUploading = uploading === docType;
            return (
              <button
                key={docType}
                type="button"
                onClick={() => handleDemoUpload(docType)}
                disabled={isUploading || alreadyUploaded}
                style={{
                  padding: '5px 12px', borderRadius: 6,
                  border: alreadyUploaded ? '1px solid var(--success)' : '1px solid var(--mongo)',
                  background: alreadyUploaded ? 'var(--success-dim)' : 'var(--mongo-dim)',
                  color: alreadyUploaded ? 'var(--success)' : 'var(--mongo)',
                  fontSize: 11, fontWeight: 600,
                  fontFamily: 'var(--font-display)',
                  cursor: isUploading || alreadyUploaded ? 'default' : 'pointer',
                  opacity: isUploading ? 0.6 : 1,
                  display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                {alreadyUploaded ? '\u2713' : isUploading ? '' : '\u2191'}
                {isUploading
                  ? 'Uploading...'
                  : alreadyUploaded
                    ? `${DOC_TYPE_LABELS[docType] || docType} Uploaded`
                    : `Upload ${DOC_TYPE_LABELS[docType] || docType}`}
              </button>
            );
          })}
        </div>
      )}

      {!isResolved && (
        <button
          type="button"
          onClick={() => onResolve(intervention._id)}
          disabled={resolving}
          style={{
            padding: '4px 12px', borderRadius: 6,
            border: '1px solid var(--hitl-amber)',
            background: 'var(--bg-base)',
            color: 'var(--hitl-amber)',
            fontSize: 11, fontWeight: 600,
            fontFamily: 'var(--font-display)',
            cursor: resolving ? 'default' : 'pointer',
            opacity: resolving ? 0.6 : 1,
            transition: 'background 150ms ease',
          }}
          onMouseEnter={(e) => { if (!resolving) e.currentTarget.style.background = 'var(--hitl-amber-dim)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-base)'; }}
        >
          {resolving ? 'Resolving...' : 'Acknowledge'}
        </button>
      )}
    </div>
  );
}
