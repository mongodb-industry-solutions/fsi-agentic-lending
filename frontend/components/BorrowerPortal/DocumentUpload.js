"use client";

import { useState, useEffect, useRef } from 'react';
import { apiGet, apiUpload } from '../../lib/api';
import DocumentViewer from '../DocumentViewer';

const INITIAL_DOCUMENTS = [
  {
    id: 'gov-id',
    type: 'Government IDs',
    docType: 'government_id',
    icon: '\u{1FA2A}',
    fileName: 'ID_MarcusDelgado_AB_DL.pdf',
    size: '1.1 MB',
    pages: 2,
    status: 'uploaded',
    mongoId: null,
  },
  {
    id: 'employment',
    type: 'Employment Letters',
    docType: 'employment_letter',
    icon: '\u{1F4BC}',
    fileName: 'EmploymentLetter_TechNova.pdf',
    size: '412 KB',
    pages: 1,
    status: 'uploaded',
    mongoId: null,
  },
  {
    id: 'paystubs',
    type: 'Pay Stubs (6)',
    docType: 'paystubs',
    icon: '\u{1F4C4}',
    fileName: 'PayStubs_Delgado_Q4Q1.pdf',
    size: '1.8 MB',
    pages: 6,
    status: 'uploaded',
    mongoId: null,
  },
  {
    id: 'tax',
    type: 'CRA Tax Notices',
    docType: 'income_tax',
    icon: '\u{1F4CB}',
    fileName: 'NOA_2025_Delgado.pdf',
    size: '624 KB',
    pages: 4,
    status: 'uploaded',
    mongoId: null,
  },
  {
    id: 'bank',
    type: 'Bank Statements (3mo)',
    docType: 'bank_statements',
    icon: '\u{1F3E6}',
    fileName: 'TD_Statement_Jan-Mar2026.pdf',
    size: '1.4 MB',
    pages: 8,
    status: 'uploaded',
    mongoId: null,
  },
  {
    id: 'purchase',
    type: 'Purchase Agreement',
    docType: 'purchase_agreement',
    icon: '\u{1F3E0}',
    fileName: 'PurchaseAgreement_4718Coronation.pdf',
    size: '2.3 MB',
    pages: 12,
    status: 'uploaded',
    mongoId: null,
  },
  {
    id: 'investments',
    type: 'Investment Statements',
    docType: 'investment_statements',
    icon: '\u{1F4CA}',
    fileName: 'RRSP_Investments_Delgado.pdf',
    size: '986 KB',
    pages: 3,
    status: 'uploaded',
    mongoId: null,
  },
  {
    id: 'property',
    type: 'Existing Property Docs',
    docType: 'other_property_docs',
    icon: '\u{1F3E2}',
    fileName: 'Condo_10180_104St_Edmonton.pdf',
    size: '1.6 MB',
    pages: 5,
    status: 'uploaded',
    mongoId: null,
  },
  {
    id: 'application',
    type: 'Mortgage Application',
    docType: 'mortgage_application',
    icon: '\u{1F4DD}',
    fileName: 'MortgageApp_Delgado_APP-2026-00001.pdf',
    size: '542 KB',
    pages: 8,
    status: 'uploaded',
    mongoId: null,
  },
  {
    id: 'utilities',
    type: 'Utility Bills',
    docType: 'utility_bills',
    icon: '\u26A1',
    fileName: 'Utilities_Enmax_Feb2026.pdf',
    size: '218 KB',
    pages: 2,
    status: 'uploaded',
    mongoId: null,
  },
  {
    id: 'credit',
    type: 'Credit Reports',
    docType: 'credit_report',
    icon: '\u{1F4B3}',
    fileName: 'Equifax_Delgado_Mar2026.pdf',
    size: '1.3 MB',
    pages: 6,
    status: 'uploaded',
    mongoId: null,
  },
  {
    id: 'carloan',
    type: 'Car Loan Statement',
    docType: 'car_loan_statement',
    icon: '\u{1F697}',
    fileName: 'Scotiabank_AutoLoan_Delgado.pdf',
    size: '324 KB',
    pages: 2,
    status: 'uploaded',
    mongoId: null,
  },
  {
    id: 'proptax',
    type: 'Property Tax Notice',
    docType: 'property_tax',
    icon: '\u{1F3DB}',
    fileName: 'PropertyTax_Calgary_2026.pdf',
    size: '186 KB',
    pages: 1,
    status: 'uploaded',
    mongoId: null,
  },
  {
    id: 'inspection',
    type: 'Property Inspection',
    docType: 'property_inspection',
    icon: '\u{1F50D}',
    fileName: 'Inspection_4718Coronation.pdf',
    size: '3.2 MB',
    pages: 14,
    status: 'uploaded',
    mongoId: null,
  },
];

function inferDocType(filename) {
  const name = filename.toLowerCase();
  if (name.includes('id') || name.includes('government')) return 'government_id';
  if (name.includes('employment')) return 'employment_letter';
  if (name.includes('paystub') || name.includes('pay_stub')) return 'paystubs';
  if (name.includes('tax') && !name.includes('property')) return 'income_tax';
  if (name.includes('bank')) return 'bank_statements';
  if (name.includes('purchase') || name.includes('agreement')) return 'purchase_agreement';
  if (name.includes('invest')) return 'investment_statements';
  if (name.includes('property') && name.includes('doc')) return 'other_property_docs';
  if (name.includes('mortgage') || name.includes('application')) return 'mortgage_application';
  if (name.includes('utility') || name.includes('bill')) return 'utility_bills';
  if (name.includes('credit')) return 'credit_report';
  if (name.includes('car') || name.includes('loan')) return 'car_loan_statement';
  if (name.includes('property') && name.includes('tax')) return 'property_tax';
  if (name.includes('inspection')) return 'property_inspection';
  return 'unknown';
}

function DocCard({ doc, onViewDoc }) {
  return (
    <div style={{
      padding: 14,
      background: 'var(--bg-surface)',
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--border-dim)',
      display: 'flex',
      gap: 12,
      alignItems: 'flex-start',
    }}>
      <div style={{
        width: 48, height: 56,
        background: 'var(--bg-raised)',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border-dim)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 22,
        flexShrink: 0,
      }}>
        {doc.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-primary)', flex: 1, minWidth: 0 }}>{doc.type}</div>
          {doc.mongoId && (
            <button
              type="button"
              onClick={() => onViewDoc(doc.mongoId)}
              title="View document"
              style={{
                padding: '3px 8px', borderRadius: 4,
                border: '1px solid var(--border-dim)', background: 'var(--bg-surface)',
                color: 'var(--mongo)', fontSize: 9, fontFamily: 'var(--font-display)',
                fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3,
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 11 }}>📄</span> View
            </button>
          )}
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {doc.fileName}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 9, color: 'var(--text-dim)' }}>
          <span>{doc.size}</span>
          <span>·</span>
          <span>{doc.pages} page{doc.pages > 1 ? 's' : ''}</span>
          <span>·</span>
          <span style={{
            color: doc.status === 'error' ? 'var(--danger)' : doc.status === 'uploading' ? 'var(--hitl-amber)' : 'var(--success)',
            fontWeight: 600,
          }}>
            {doc.status === 'uploading' ? '⏳ Uploading...' : doc.status === 'error' ? '✕ Error' : '✓ Uploaded'}
          </span>
        </div>
        <div style={{
          marginTop: 6,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '2px 8px',
          borderRadius: 10,
          background: 'var(--voyage-dim)',
          border: '1px solid var(--voyage)',
          fontSize: 9,
          fontWeight: 600,
          color: 'var(--voyage)',
        }}>
          <span style={{ fontSize: 10 }}>{'\u{1F9EC}'}</span>
          Processed by voyage-multimodal-3.5
        </div>
      </div>
    </div>
  );
}

export default function DocumentUpload({ applicationId }) {
  const [dragOver, setDragOver] = useState(false);
  const [documents, setDocuments] = useState(INITIAL_DOCUMENTS);
  const [viewingDocId, setViewingDocId] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    // Try the provided applicationId, or fall back to the demo app
    const appId = applicationId || 'APP-2026-00001';
    apiGet(`/applications/${appId}/documents`).then((docs) => {
      if (docs && Array.isArray(docs) && docs.length > 0) {
        setDocuments(prev => prev.map(d => {
          const match = docs.find(bd => bd.doc_type === d.docType);
          return match ? { ...d, mongoId: match._id } : d;
        }));
      }
    });
  }, [applicationId]);

  const handleFiles = async (files) => {
    if (!files.length || !applicationId) return;

    for (const file of files) {
      const docType = inferDocType(file.name);

      // Update card to show uploading state
      setDocuments(prev => prev.map(d =>
        d.docType === docType ? { ...d, status: 'uploading' } : d
      ));

      const result = await apiUpload(
        `/applications/${applicationId}/documents/upload`,
        file,
        { doc_type: docType }
      );

      if (result) {
        setDocuments(prev => prev.map(d =>
          d.docType === docType ? { ...d, status: 'uploaded', mongoId: result._id } : d
        ));
      } else {
        setDocuments(prev => prev.map(d =>
          d.docType === docType ? { ...d, status: 'error' } : d
        ));
      }
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer?.files || []);
    await handleFiles(files);
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', borderLeft: '1px solid var(--border-dim)' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, marginBottom: 4, color: 'var(--text-primary)' }}>
        Supporting Documents
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
        Upload income verification, bank statements, and identification.
      </div>

      {/* Hidden file input for keyboard accessibility */}
      <input
        type="file"
        multiple
        accept=".pdf"
        style={{ display: 'none' }}
        ref={fileInputRef}
        onChange={(e) => handleFiles(Array.from(e.target.files))}
      />

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          padding: 24,
          borderRadius: 'var(--radius-md)',
          border: `2px dashed ${dragOver ? 'var(--mongo)' : 'var(--border-dim)'}`,
          background: dragOver ? 'var(--mongo-dim)' : 'var(--bg-raised)',
          textAlign: 'center',
          marginBottom: 16,
          transition: 'all 0.2s',
          cursor: 'pointer',
        }}
      >
        <div style={{ fontSize: 28, marginBottom: 6 }}>📂</div>
        <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-primary)', marginBottom: 2 }}>
          Drag & drop files here or click to browse
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
          PDF, JPG, PNG up to 10MB each
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        {documents.map((doc, index) => (
          <div key={doc.id} style={{
            animation: `cardEnter 0.3s cubic-bezier(0.4, 0, 0.2, 1) ${index * 0.06}s both`,
          }}>
            <DocCard doc={doc} onViewDoc={setViewingDocId} />
          </div>
        ))}
      </div>

      {/* Multimodal processing indicator */}
      <div style={{
        padding: 12,
        background: 'var(--voyage-dim)',
        borderRadius: 'var(--radius-md)',
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
