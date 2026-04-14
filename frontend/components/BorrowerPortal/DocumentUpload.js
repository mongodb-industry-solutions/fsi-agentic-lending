"use client";

import { useState, useEffect } from 'react';
import { spacing } from '@leafygreen-ui/tokens';
import { apiGet } from '../../lib/api';
import DocumentViewer from '../DocumentViewer';

// Display metadata keyed by doc_type — used to enrich API-fetched documents
const DOC_TYPE_META = {
  government_id:        { type: 'Government IDs',           abbr: 'ID'  },
  employment_letter:    { type: 'Employment Letters',        abbr: 'EMP' },
  paystubs:             { type: 'Pay Stubs',                 abbr: 'PAY' },
  income_tax:           { type: 'CRA Tax Notices',           abbr: 'TAX' },
  bank_statements:      { type: 'Bank Statements',           abbr: 'BNK' },
  purchase_agreement:   { type: 'Purchase Agreement',        abbr: 'PSA' },
  investment_statements:{ type: 'Investment Statements',      abbr: 'INV' },
  other_property_docs:  { type: 'Existing Property Docs',    abbr: 'PTY' },
  mortgage_application: { type: 'Mortgage Application',      abbr: 'APP' },
  utility_bills:        { type: 'Utility Bills',             abbr: 'UTL' },
  credit_report:        { type: 'Credit Reports',            abbr: 'CRD' },
  car_loan_statement:   { type: 'Car Loan Statement',        abbr: 'CAR' },
  property_tax:         { type: 'Property Tax Notice',       abbr: 'PTX' },
  property_inspection:  { type: 'Property Inspection',       abbr: 'INS' },
};

function buildDocList(apiDocs) {
  return apiDocs.map((d) => {
    const meta = DOC_TYPE_META[d.doc_type] || { type: d.doc_type, abbr: 'DOC' };
    return {
      id: d._id,
      type: meta.type,
      docType: d.doc_type,
      abbr: meta.abbr,
      fileName: d.filename || d.doc_type,
      // embedding_pages approximates PDF page count; 0 means embedding ran but produced no chunks
      pages: d.embedding_pages > 0 ? d.embedding_pages : null,
      status: d.status === 'error' ? 'error' : 'uploaded',
      mongoId: d._id,
    };
  });
}

function DocCard({ doc, onViewDoc }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{
        padding: 10,
        background: 'var(--bg-surface)',
        borderRadius: 8,
        border: '1px solid var(--border-dim)',
        display: 'flex',
        gap: 8,
        alignItems: 'flex-start',
        transition: 'transform 220ms cubic-bezier(0.33, 1, 0.68, 1), box-shadow 220ms cubic-bezier(0.33, 1, 0.68, 1)',
        transform: hovered ? 'translateY(-2px)' : 'none',
        boxShadow: hovered ? '0 4px 12px rgba(0,0,0,0.08)' : 'none',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{
        width: 32, height: 38,
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
          fontSize: 9,
          fontWeight: 700,
          color: 'var(--text-dim)',
          letterSpacing: '0.02em',
        }}>
          {doc.abbr || 'DOC'}
        </span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-primary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.type}</div>
          {doc.mongoId && (
            <button
              type="button"
              onClick={() => onViewDoc(doc.mongoId)}
              title="View document details"
              style={{
                padding: '2px 8px', borderRadius: 6,
                border: '1px solid var(--border-dim)', background: 'var(--bg-surface)',
                color: 'var(--mongo)', fontSize: 10, fontFamily: 'var(--font-display)',
                fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                flexShrink: 0, transition: 'border-color 150ms ease, background 150ms ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--mongo)'; e.currentTarget.style.background = 'var(--mongo-dim)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-dim)'; e.currentTarget.style.background = 'var(--bg-surface)'; }}
              onFocus={(e) => { e.currentTarget.style.boxShadow = '0 0 0 2px var(--focus-ring, rgba(0, 124, 173, 0.4))'; }}
              onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
            >
              View
            </button>
          )}
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {doc.fileName}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 9, color: 'var(--text-dim)', marginTop: 2 }}>
          {doc.pages != null && (
            <>
              <span>{doc.pages} page{doc.pages > 1 ? 's' : ''}</span>
              <span style={{ opacity: 0.5 }}>|</span>
            </>
          )}
          <span style={{
            color: doc.status === 'error' ? 'var(--danger)' : 'var(--success)',
            fontWeight: 600,
          }}>
            {doc.status === 'error' ? 'Error' : 'Uploaded'}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function DocumentUpload({ applicationId, borrowerProfile }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [viewingDocId, setViewingDocId] = useState(null);

  const sourceAppId = applicationId || borrowerProfile?.seedApplicationId;

  useEffect(() => {
    if (!sourceAppId) { setLoading(false); return; }
    setDocuments([]);
    setFetchError(false);
    setLoading(true);

    apiGet(`/applications/${sourceAppId}/documents`).then((docs) => {
      if (docs === null) { setFetchError(true); return; }
      if (Array.isArray(docs) && docs.length > 0) {
        setDocuments(buildDocList(docs));
      }
    }).finally(() => setLoading(false));
  }, [sourceAppId]);

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: `${spacing[4]}px ${spacing[5]}px`, borderLeft: '1px solid var(--border-dim)' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, marginBottom: 4, color: 'var(--text-primary)' }}>
        Supporting Documents
      </div>
      <div style={{ fontSize: 12, color: fetchError ? 'var(--danger)' : 'var(--text-secondary)', marginBottom: spacing[4] }}>
        {loading
          ? 'Loading documents...'
          : fetchError
            ? 'Could not load documents. Please refresh.'
            : documents.length > 0
              ? applicationId
                ? `${documents.length} documents submitted with this application.`
                : `${documents.length} documents prepared for this application. Click View to inspect extracted data.`
              : 'No documents found for this profile.'}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: spacing[4] }}>
        {documents.map((doc, index) => (
          <div key={doc.id} style={{
            animation: `cardEnter 0.3s cubic-bezier(0.4, 0, 0.2, 1) ${index * 0.04}s both`,
          }}>
            <DocCard doc={doc} onViewDoc={setViewingDocId} />
          </div>
        ))}
      </div>

      <div style={{
        padding: spacing[3],
        background: 'var(--voyage-dim)',
        borderRadius: 8,
        border: '1px solid var(--voyage)',
      }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11, color: 'var(--voyage)', marginBottom: 4 }}>
          Multimodal Document Intelligence
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Documents processed using <strong style={{ color: 'var(--voyage)' }}>voyage-multimodal-3.5</strong> — a unified transformer that embeds text, document images, and visual layout into a single vector space. No modality gap means your CRA tax notice and its extracted text fields produce semantically aligned embeddings.
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          {['Text', 'Images', 'PDFs', 'Tables'].map((m) => (
            <span key={m} style={{ fontSize: 9, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: 'var(--bg-surface)', color: 'var(--voyage)', border: '1px solid var(--voyage)' }}>
              {m}
            </span>
          ))}
        </div>
      </div>

      {viewingDocId && <DocumentViewer docId={viewingDocId} onClose={() => setViewingDocId(null)} />}
    </div>
  );
}
