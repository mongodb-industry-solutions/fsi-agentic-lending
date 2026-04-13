"use client";

import { useState, useEffect } from 'react';
import { spacing } from '@leafygreen-ui/tokens';
import { apiGet } from '../../lib/api';
import DocumentViewer from '../DocumentViewer';

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

const DOC_TYPE_ABBR = {
  government_id: 'ID',
  employment_letter: 'EMP',
  paystubs: 'PAY',
  income_tax: 'TAX',
  bank_statements: 'BNK',
  purchase_agreement: 'PSA',
  investment_statements: 'INV',
  other_property_docs: 'PTY',
  mortgage_application: 'APP',
  utility_bills: 'UTL',
  credit_report: 'CRD',
  car_loan_statement: 'CAR',
  property_tax: 'PTX',
  property_inspection: 'INS',
};

function CompactDocCard({ doc, onView }) {
  const [hovered, setHovered] = useState(false);
  const label = DOC_TYPE_LABELS[doc.doc_type] || doc.doc_type?.replace(/_/g, ' ') || 'Document';
  const abbr = DOC_TYPE_ABBR[doc.doc_type] || 'DOC';

  return (
    <button
      type="button"
      style={{
        padding: `${spacing[2]}px ${spacing[3]}px`,
        background: hovered ? 'var(--bg-raised, var(--bg-surface))' : 'var(--bg-surface)',
        borderRadius: 8,
        border: '1px solid var(--border-dim)',
        display: 'flex',
        alignItems: 'center',
        gap: spacing[2],
        cursor: 'pointer',
        transition: 'transform 220ms cubic-bezier(0.33, 1, 0.68, 1), box-shadow 220ms cubic-bezier(0.33, 1, 0.68, 1), background 150ms ease',
        transform: hovered ? 'translateY(-1px)' : 'none',
        boxShadow: hovered ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
        width: '100%',
        textAlign: 'left',
        font: 'inherit',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onView(doc._id)}
      aria-label={`View ${label}`}
      onFocus={(e) => { e.currentTarget.style.boxShadow = '0 0 0 2px var(--focus-ring, rgba(0, 124, 173, 0.4))'; }}
      onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
    >
      <div style={{
        width: 32, height: 32,
        background: 'var(--bg-raised)',
        borderRadius: 6,
        border: '1px solid var(--border-dim)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 8,
          fontWeight: 700,
          color: 'var(--text-dim)',
          letterSpacing: '0.02em',
        }}>
          {abbr}
        </span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          fontSize: 11,
          color: 'var(--text-primary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {label}
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          color: 'var(--text-dim)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {doc.filename}
        </div>
      </div>
      <div style={{
        fontSize: 9,
        fontWeight: 600,
        color: doc.status === 'parsed' ? 'var(--success)' : doc.status === 'error' ? 'var(--danger)' : 'var(--text-dim)',
        flexShrink: 0,
      }}>
        {doc.status === 'parsed' ? 'Parsed' : doc.status === 'error' ? 'Error' : doc.status}
      </div>
    </button>
  );
}

export default function DocumentContext({ applicationId }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [viewingDocId, setViewingDocId] = useState(null);

  useEffect(() => {
    if (!applicationId) return;
    setLoading(true);
    apiGet(`/applications/${applicationId}/documents`)
      .then((docs) => {
        if (docs && Array.isArray(docs)) {
          setDocuments(docs);
        }
      })
      .finally(() => setLoading(false));
  }, [applicationId]);

  return (
    <>
      <div style={{
        width: collapsed ? 48 : 300,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid var(--border-dim)',
        background: 'var(--bg-surface)',
        transition: 'width 220ms cubic-bezier(0.33, 1, 0.68, 1)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: collapsed ? `${spacing[3]}px ${spacing[2]}px` : `${spacing[4]}px ${spacing[4]}px ${spacing[3]}px`,
          borderBottom: '1px solid var(--border-dim)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          flexShrink: 0,
        }}>
          {!collapsed && (
            <div>
              <div style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 13,
                color: 'var(--text-primary)',
              }}>
                Submitted Documents
              </div>
              {!loading && (
                <div style={{
                  fontSize: 10,
                  color: 'var(--text-dim)',
                  marginTop: 2,
                }}>
                  {documents.length} document{documents.length !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={() => setCollapsed(prev => !prev)}
            aria-label={collapsed ? 'Expand document panel' : 'Collapse document panel'}
            style={{
              width: 24, height: 24,
              borderRadius: 6,
              border: '1px solid var(--border-dim)',
              background: 'var(--bg-base)',
              color: 'var(--text-dim)',
              fontSize: 12,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'background 150ms ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-raised)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-base)'; }}
            onFocus={(e) => { e.currentTarget.style.boxShadow = '0 0 0 2px var(--focus-ring, rgba(0, 124, 173, 0.4))'; }}
            onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
          >
            {collapsed ? '\u25B6' : '\u25C0'}
          </button>
        </div>

        {/* Document list */}
        {!collapsed && (
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: spacing[3],
            display: 'flex',
            flexDirection: 'column',
            gap: spacing[2],
          }}>
            {loading ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: spacing[5],
                color: 'var(--text-dim)',
              }}>
                <div style={{
                  width: 20, height: 20, borderRadius: '50%',
                  border: '2px solid var(--border-base)',
                  borderTopColor: 'var(--mongo)',
                  animation: 'spin 0.8s linear infinite',
                  marginBottom: spacing[2],
                }} />
                <div style={{ fontSize: 11, fontFamily: 'var(--font-display)' }}>Loading...</div>
              </div>
            ) : documents.length === 0 ? (
              <div style={{
                padding: spacing[4],
                borderRadius: 8,
                border: '1px dashed var(--border-dim)',
                background: '#FAFBFA',
                textAlign: 'center',
                color: 'var(--text-dim)',
                fontSize: 11,
              }}>
                No documents found
              </div>
            ) : (
              documents.map((doc) => (
                <CompactDocCard
                  key={doc._id}
                  doc={doc}
                  onView={setViewingDocId}
                />
              ))
            )}
          </div>
        )}
      </div>

      {viewingDocId && <DocumentViewer docId={viewingDocId} onClose={() => setViewingDocId(null)} />}
    </>
  );
}
