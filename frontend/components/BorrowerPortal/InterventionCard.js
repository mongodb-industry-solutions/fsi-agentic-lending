"use client";

import { useState, useEffect, useRef } from 'react';
import { spacing } from '@leafygreen-ui/tokens';
import { apiPost } from '../../lib/api';
import DocumentViewer from '../DocumentViewer';

// Don't show interventions until at least this long after creation
const MIN_DISPLAY_DELAY_MS = 8000;

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

const UPLOAD_STEPS = [
  { key: 'uploading', label: 'Upload' },
  { key: 'extracting', label: 'Extract' },
  { key: 'processing', label: 'Process' },
];

function StepIndicator({ currentStep }) {
  const stepIndex = UPLOAD_STEPS.findIndex(s => s.key === currentStep);
  if (stepIndex < 0) return null;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 4,
      marginTop: 4, paddingLeft: 2,
    }}>
      {UPLOAD_STEPS.map((step, i) => (
        <div key={step.key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: i <= stepIndex ? 'var(--mongo)' : 'var(--border-dim)',
            transition: 'background 300ms ease',
          }} />
          <span style={{
            fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 600,
            color: i <= stepIndex ? 'var(--mongo)' : 'var(--text-dim)',
            transition: 'color 300ms ease',
          }}>
            {step.label}
          </span>
          {i < UPLOAD_STEPS.length - 1 && (
            <div style={{
              width: 12, height: 1,
              background: i < stepIndex ? 'var(--mongo)' : 'var(--border-dim)',
              transition: 'background 300ms ease',
            }} />
          )}
        </div>
      ))}
    </div>
  );
}

export function InterventionCard({ intervention, onResolve, resolving, applicationId, onDocumentUploaded }) {
  const isResolved = intervention._resolved;
  const ctx = intervention.borrower_context || {};
  const [elapsed, setElapsed] = useState(0);
  const [uploadStatus, setUploadStatus] = useState({});
  const [uploadedTypes, setUploadedTypes] = useState([]);
  const [uploadedDocIds, setUploadedDocIds] = useState({});
  const [viewingDocId, setViewingDocId] = useState(null);
  const [visible, setVisible] = useState(isResolved);
  const [autoResolving, setAutoResolving] = useState(false);
  const timersRef = useRef({});
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  // Delayed visibility -- don't show until MIN_DISPLAY_DELAY_MS after creation
  useEffect(() => {
    if (isResolved) { setVisible(true); return; }
    const createdAt = intervention.created_at ? new Date(intervention.created_at).getTime() : Date.now();
    const age = Date.now() - createdAt;
    if (age >= MIN_DISPLAY_DELAY_MS) {
      setVisible(true);
    } else {
      const timer = setTimeout(() => setVisible(true), MIN_DISPLAY_DELAY_MS - age);
      return () => clearTimeout(timer);
    }
  }, [intervention.created_at, isResolved]);

  // Urgency is measured from when the card is first shown (not from created_at)
  // so a resumed/old application doesn't instantly read as hours-overdue.
  const shownAtRef = useRef(Date.now());
  useEffect(() => {
    if (isResolved) return;
    const tick = () => setElapsed(Date.now() - shownAtRef.current);
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [isResolved]);

  const isMissingDoc = intervention.type === 'missing_document' || intervention.type === 'document_processing_error';
  const isReupload = intervention.type === 'document_processing_error';
  const isInfoOnly = intervention.type === 'credit_data_unavailable'
    || intervention.type === 'credit_score_required';
  const isIncomeIssue = intervention.type === 'income_data_required';
  // Advisory escalation — the app is with a loan officer; the borrower has
  // nothing to do. Render calm and informational, never urgent.
  const isAdvisory = intervention.type === 'additional_info_required';
  // "Calm" bucket: no borrower action, no urgency timer, no Acknowledge-as-action.
  const isCalm = isInfoOnly || isIncomeIssue || isAdvisory;
  const isUrgent = !isResolved && !isCalm && elapsed > 30000;
  const missingDocTypes = isMissingDoc ? (ctx.document_types_accepted || []) : [];
  const allDocsUploaded = isMissingDoc && missingDocTypes.length > 0
    && missingDocTypes.every(t => uploadedTypes.includes(t));

  // Auto-resolve after all required docs are uploaded
  useEffect(() => {
    if (allDocsUploaded && !isResolved && !autoResolving) {
      setAutoResolving(true);
      const resolveTimer = setTimeout(() => {
        if (mountedRef.current) onResolve(intervention._id);
      }, 1500);
      // Fallback: reset autoResolving if resolve didn't complete within 5s
      const fallbackTimer = setTimeout(() => {
        if (mountedRef.current) setAutoResolving(false);
      }, 5000);
      return () => { clearTimeout(resolveTimer); clearTimeout(fallbackTimer); };
    }
  }, [allDocsUploaded, isResolved, autoResolving, onResolve, intervention._id]);

  // Cleanup simulated progress timers on unmount
  useEffect(() => {
    return () => {
      Object.values(timersRef.current).forEach(t => {
        clearTimeout(t.extract);
        clearTimeout(t.process);
      });
    };
  }, []);

  const handleDemoUpload = async (docType) => {
    if (!applicationId || uploadStatus[docType] === 'uploading' || uploadStatus[docType] === 'extracting'
        || uploadStatus[docType] === 'processing' || uploadedTypes.includes(docType)) return;

    setUploadStatus(prev => ({ ...prev, [docType]: 'uploading' }));

    // Simulated progress timers
    const extractTimer = setTimeout(() => {
      setUploadStatus(prev => ({ ...prev, [docType]: 'extracting' }));
    }, 1200);
    const processTimer = setTimeout(() => {
      setUploadStatus(prev => ({ ...prev, [docType]: 'processing' }));
    }, 3000);
    timersRef.current[docType] = { extract: extractTimer, process: processTimer };

    try {
      const result = await apiPost(`/applications/${applicationId}/documents/demo-upload/${docType}`, {});
      clearTimeout(extractTimer);
      clearTimeout(processTimer);
      if (!mountedRef.current) return;
      if (result && !result.error) {
        setUploadStatus(prev => ({ ...prev, [docType]: 'done' }));
        setUploadedTypes(prev => [...prev, docType]);
        if (result._id) setUploadedDocIds(prev => ({ ...prev, [docType]: result._id }));
        if (onDocumentUploaded) onDocumentUploaded(result);
      } else {
        setUploadStatus(prev => ({ ...prev, [docType]: 'error' }));
      }
    } catch (err) {
      clearTimeout(extractTimer);
      clearTimeout(processTimer);
      if (!mountedRef.current) return;
      console.warn('[InterventionCard] demo upload failed:', err);
      setUploadStatus(prev => ({ ...prev, [docType]: 'error' }));
    }
  };

  if (!visible) return null;

  const getButtonLabel = (docType) => {
    const status = uploadStatus[docType];
    const label = DOC_TYPE_LABELS[docType] || docType;
    const verb = isReupload ? 'Re-upload' : 'Upload';
    switch (status) {
      case 'uploading': return `${verb === 'Re-upload' ? 'Re-uploading' : 'Uploading'}...`;
      case 'extracting': return 'Extracting data...';
      case 'processing': return 'Processing...';
      case 'done': return `${label} Uploaded`;
      case 'error': return `${verb} Failed \u2014 Retry`;
      default: return `${verb} ${label}`;
    }
  };

  const getButtonIcon = (docType) => {
    const status = uploadStatus[docType];
    if (status === 'done') return '\u2713';
    if (status === 'error') return '\u21BB';
    if (status === 'uploading' || status === 'extracting' || status === 'processing') return '';
    return '\u2191';
  };

  const isInProgress = (docType) => {
    const s = uploadStatus[docType];
    return s === 'uploading' || s === 'extracting' || s === 'processing';
  };

  const cardColor = isResolved ? 'var(--success)' : isCalm ? 'var(--tool-blue)' : 'var(--hitl-amber)';
  const cardBg = isResolved ? 'var(--success-dim)' : isCalm ? 'var(--tool-blue-dim)' : 'var(--hitl-amber-dim)';

  return (
    <>
      <div style={{
        margin: `${spacing[2]}px 0`,
        padding: spacing[3],
        background: cardBg,
        borderRadius: 8,
        border: `1px solid ${cardColor}`,
        borderLeft: `3px solid ${cardColor}`,
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
            background: cardColor,
            color: '#FFFFFF',
          }}>
            {isResolved ? 'Resolved' : isCalm ? 'Information' : intervention.status || 'Action Required'}
          </span>
          {isUrgent && (
            <span style={{
              fontSize: 8, fontWeight: 700, fontFamily: 'var(--font-mono)',
              color: 'var(--hitl-amber)', animation: 'pulse 1.5s infinite',
            }}>
              Pending
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

        {/* Upload buttons for missing/error document types */}
        {!isResolved && isMissingDoc && missingDocTypes.length > 0 && applicationId && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
            {isReupload && (
              <div style={{
                fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.4,
                marginBottom: 2,
              }}>
                The original document could not be processed. Please re-upload a clear PDF.
              </div>
            )}
            {missingDocTypes.map((docType) => {
              const alreadyUploaded = uploadedTypes.includes(docType);
              const inProgress = isInProgress(docType);
              const isError = uploadStatus[docType] === 'error';
              return (
                <div key={docType}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => handleDemoUpload(docType)}
                      disabled={inProgress || (alreadyUploaded && !isError)}
                      style={{
                        padding: '5px 12px', borderRadius: 6,
                        border: alreadyUploaded
                          ? '1px solid var(--success)'
                          : isError
                            ? '1px solid var(--danger)'
                            : '1px solid var(--mongo)',
                        background: alreadyUploaded
                          ? 'var(--success-dim)'
                          : isError
                            ? 'var(--danger-dim)'
                            : 'var(--mongo-dim)',
                        color: alreadyUploaded
                          ? 'var(--success)'
                          : isError
                            ? 'var(--danger)'
                            : 'var(--mongo)',
                        fontSize: 11, fontWeight: 600,
                        fontFamily: 'var(--font-display)',
                        cursor: inProgress || (alreadyUploaded && !isError) ? 'default' : 'pointer',
                        opacity: inProgress ? 0.8 : 1,
                        display: 'flex', alignItems: 'center', gap: 4,
                        transition: 'all 200ms ease',
                      }}
                    >
                      {inProgress && (
                        <span style={{
                          display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
                          border: '2px solid currentColor', borderTopColor: 'transparent',
                          animation: 'spin 0.8s linear infinite',
                          flexShrink: 0,
                        }} />
                      )}
                      {!inProgress && getButtonIcon(docType)}
                      {getButtonLabel(docType)}
                    </button>
                    {alreadyUploaded && uploadedDocIds[docType] && (
                      <button
                        type="button"
                        onClick={() => setViewingDocId(uploadedDocIds[docType])}
                        style={{
                          padding: '4px 8px', borderRadius: 4,
                          border: '1px solid var(--border-dim)',
                          background: 'var(--bg-surface)',
                          color: 'var(--mongo)',
                          fontSize: 10, fontWeight: 600,
                          fontFamily: 'var(--font-display)',
                          cursor: 'pointer',
                          transition: 'background 150ms ease',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--mongo-dim)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-surface)'; }}
                      >
                        View
                      </button>
                    )}
                  </div>
                  {inProgress && <StepIndicator currentStep={uploadStatus[docType]} />}
                </div>
              );
            })}
          </div>
        )}

        {/* Auto-resolve message for missing_document after all uploads */}
        {isMissingDoc && allDocsUploaded && !isResolved && (
          <div style={{
            fontSize: 11, color: 'var(--success)', fontWeight: 600,
            fontFamily: 'var(--font-display)',
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 0',
          }}>
            <span style={{
              display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
              border: '2px solid var(--success)', borderTopColor: 'transparent',
              animation: 'spin 0.8s linear infinite',
            }} />
            All documents uploaded — resuming processing...
          </div>
        )}

        {/* Hint for missing_document when not all docs uploaded yet */}
        {isMissingDoc && !allDocsUploaded && !isResolved && missingDocTypes.length > 0 && (
          <div style={{
            fontSize: 10, color: 'var(--text-dim)', fontStyle: 'italic',
            paddingTop: 2,
          }}>
            {isReupload ? 'Re-upload' : 'Upload'} the document{missingDocTypes.length > 1 ? 's' : ''} above to continue processing
          </div>
        )}

        {/* Info-only interventions (credit issues) -- no action needed from borrower */}
        {!isResolved && isInfoOnly && (
          <div style={{
            fontSize: 11, color: 'var(--tool-blue)', lineHeight: 1.5,
            padding: '6px 10px',
            background: 'var(--bg-surface)',
            borderRadius: 6,
            border: '1px solid var(--border-dim)',
          }}>
            No action needed — our team has been notified and will follow up if additional information is required.
          </div>
        )}

        {/* Income issue -- docs exist but income couldn't be extracted */}
        {!isResolved && isIncomeIssue && (
          <div style={{
            fontSize: 11, color: 'var(--tool-blue)', lineHeight: 1.5,
            padding: '6px 10px',
            background: 'var(--bg-surface)',
            borderRadius: 6,
            border: '1px solid var(--border-dim)',
          }}>
            Your income information could not be verified from the submitted documents. A loan officer will review your application.
          </div>
        )}

        {/* Acknowledge button only for genuinely actionable generic interventions
            (not doc uploads, and not the calm/informational bucket) */}
        {!isMissingDoc && !isCalm && !isResolved && (
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

      {viewingDocId && <DocumentViewer docId={viewingDocId} onClose={() => setViewingDocId(null)} />}
    </>
  );
}
