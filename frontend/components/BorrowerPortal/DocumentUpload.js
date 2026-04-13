"use client";

import { useState, useEffect } from 'react';
import { spacing } from '@leafygreen-ui/tokens';
import { apiGet } from '../../lib/api';
import DocumentViewer from '../DocumentViewer';

const INITIAL_DOCUMENTS = [
  { id: 'gov-id', type: 'Government IDs', docType: 'government_id', abbr: 'ID', fileName: 'ID_MarcusDelgado_AB_DL.pdf', size: '1.1 MB', pages: 2, status: 'uploaded', mongoId: null },
  { id: 'employment', type: 'Employment Letters', docType: 'employment_letter', abbr: 'EMP', fileName: 'EmploymentLetter_TechNova.pdf', size: '412 KB', pages: 1, status: 'uploaded', mongoId: null },
  { id: 'paystubs', type: 'Pay Stubs (6)', docType: 'paystubs', abbr: 'PAY', fileName: 'PayStubs_Delgado_Q4Q1.pdf', size: '1.8 MB', pages: 6, status: 'uploaded', mongoId: null },
  { id: 'tax', type: 'CRA Tax Notices', docType: 'income_tax', abbr: 'TAX', fileName: 'NOA_2025_Delgado.pdf', size: '624 KB', pages: 4, status: 'uploaded', mongoId: null },
  { id: 'bank', type: 'Bank Statements (3mo)', docType: 'bank_statements', abbr: 'BNK', fileName: 'TD_Statement_Jan-Mar2026.pdf', size: '1.4 MB', pages: 8, status: 'uploaded', mongoId: null },
  { id: 'purchase', type: 'Purchase Agreement', docType: 'purchase_agreement', abbr: 'PSA', fileName: 'PurchaseAgreement_4718Coronation.pdf', size: '2.3 MB', pages: 12, status: 'uploaded', mongoId: null },
  { id: 'investments', type: 'Investment Statements', docType: 'investment_statements', abbr: 'INV', fileName: 'RRSP_Investments_Delgado.pdf', size: '986 KB', pages: 3, status: 'uploaded', mongoId: null },
  { id: 'property', type: 'Existing Property Docs', docType: 'other_property_docs', abbr: 'PTY', fileName: 'Condo_10180_104St_Edmonton.pdf', size: '1.6 MB', pages: 5, status: 'uploaded', mongoId: null },
  { id: 'application', type: 'Mortgage Application', docType: 'mortgage_application', abbr: 'APP', fileName: 'MortgageApp_Delgado_APP-2026-00001.pdf', size: '542 KB', pages: 8, status: 'uploaded', mongoId: null },
  { id: 'utilities', type: 'Utility Bills', docType: 'utility_bills', abbr: 'UTL', fileName: 'Utilities_Enmax_Feb2026.pdf', size: '218 KB', pages: 2, status: 'uploaded', mongoId: null },
  { id: 'credit', type: 'Credit Reports', docType: 'credit_report', abbr: 'CRD', fileName: 'Equifax_Delgado_Mar2026.pdf', size: '1.3 MB', pages: 6, status: 'uploaded', mongoId: null },
  { id: 'carloan', type: 'Car Loan Statement', docType: 'car_loan_statement', abbr: 'CAR', fileName: 'Scotiabank_AutoLoan_Delgado.pdf', size: '324 KB', pages: 2, status: 'uploaded', mongoId: null },
  { id: 'proptax', type: 'Property Tax Notice', docType: 'property_tax', abbr: 'PTX', fileName: 'PropertyTax_Calgary_2026.pdf', size: '186 KB', pages: 1, status: 'uploaded', mongoId: null },
  { id: 'inspection', type: 'Property Inspection', docType: 'property_inspection', abbr: 'INS', fileName: 'Inspection_4718Coronation.pdf', size: '3.2 MB', pages: 14, status: 'uploaded', mongoId: null },
];

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
          <span>{doc.size}</span>
          <span style={{ opacity: 0.5 }}>|</span>
          <span>{doc.pages} page{doc.pages > 1 ? 's' : ''}</span>
          <span style={{ opacity: 0.5 }}>|</span>
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
  const [documents, setDocuments] = useState(INITIAL_DOCUMENTS);
  const [viewingDocId, setViewingDocId] = useState(null);

  const sourceAppId = applicationId || borrowerProfile?.seedApplicationId;

  useEffect(() => {
    if (!sourceAppId) return;

    apiGet(`/applications/${sourceAppId}/documents`).then((docs) => {
      if (docs && Array.isArray(docs) && docs.length > 0) {
        setDocuments(prev => prev.map(d => {
          const match = docs.find(bd => bd.doc_type === d.docType);
          return match ? { ...d, mongoId: match._id } : d;
        }));
      }
    });
  }, [sourceAppId]);

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: `${spacing[4]}px ${spacing[5]}px`, borderLeft: '1px solid var(--border-dim)' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, marginBottom: 4, color: 'var(--text-primary)' }}>
        Supporting Documents
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: spacing[4] }}>
        {applicationId
          ? 'Documents submitted with this application.'
          : '14 documents prepared for this application. Click View to inspect extracted data.'}
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
