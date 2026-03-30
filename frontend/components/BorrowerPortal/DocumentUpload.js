"use client";

import { useState } from 'react';

const DOCUMENTS = [
  {
    id: 'gov-id',
    type: 'Government IDs',
    icon: '\u{1FA2A}',
    fileName: 'ID_MarcusDelgado_AB_DL.pdf',
    size: '1.1 MB',
    pages: 2,
    status: 'uploaded',
  },
  {
    id: 'employment',
    type: 'Employment Letters',
    icon: '\u{1F4BC}',
    fileName: 'EmploymentLetter_TechNova.pdf',
    size: '412 KB',
    pages: 1,
    status: 'uploaded',
  },
  {
    id: 'paystubs',
    type: 'Pay Stubs (6)',
    icon: '\u{1F4C4}',
    fileName: 'PayStubs_Delgado_Q4Q1.pdf',
    size: '1.8 MB',
    pages: 6,
    status: 'uploaded',
  },
  {
    id: 'tax',
    type: 'CRA Tax Notices',
    icon: '\u{1F4CB}',
    fileName: 'NOA_2025_Delgado.pdf',
    size: '624 KB',
    pages: 4,
    status: 'uploaded',
  },
  {
    id: 'bank',
    type: 'Bank Statements (3mo)',
    icon: '\u{1F3E6}',
    fileName: 'TD_Statement_Jan-Mar2026.pdf',
    size: '1.4 MB',
    pages: 8,
    status: 'uploaded',
  },
  {
    id: 'purchase',
    type: 'Purchase Agreement',
    icon: '\u{1F3E0}',
    fileName: 'PurchaseAgreement_4718Coronation.pdf',
    size: '2.3 MB',
    pages: 12,
    status: 'uploaded',
  },
  {
    id: 'investments',
    type: 'Investment Statements',
    icon: '\u{1F4CA}',
    fileName: 'RRSP_Investments_Delgado.pdf',
    size: '986 KB',
    pages: 3,
    status: 'uploaded',
  },
  {
    id: 'property',
    type: 'Existing Property Docs',
    icon: '\u{1F3E2}',
    fileName: 'Condo_10180_104St_Edmonton.pdf',
    size: '1.6 MB',
    pages: 5,
    status: 'uploaded',
  },
  {
    id: 'application',
    type: 'Mortgage Application',
    icon: '\u{1F4DD}',
    fileName: 'MortgageApp_Delgado_APP-2026-00001.pdf',
    size: '542 KB',
    pages: 8,
    status: 'uploaded',
  },
  {
    id: 'utilities',
    type: 'Utility Bills',
    icon: '\u26A1',
    fileName: 'Utilities_Enmax_Feb2026.pdf',
    size: '218 KB',
    pages: 2,
    status: 'uploaded',
  },
  {
    id: 'credit',
    type: 'Credit Reports',
    icon: '\u{1F4B3}',
    fileName: 'Equifax_Delgado_Mar2026.pdf',
    size: '1.3 MB',
    pages: 6,
    status: 'uploaded',
  },
  {
    id: 'carloan',
    type: 'Car Loan Statement',
    icon: '\u{1F697}',
    fileName: 'Scotiabank_AutoLoan_Delgado.pdf',
    size: '324 KB',
    pages: 2,
    status: 'uploaded',
  },
  {
    id: 'proptax',
    type: 'Property Tax Notice',
    icon: '\u{1F3DB}',
    fileName: 'PropertyTax_Calgary_2026.pdf',
    size: '186 KB',
    pages: 1,
    status: 'uploaded',
  },
  {
    id: 'inspection',
    type: 'Property Inspection',
    icon: '\u{1F50D}',
    fileName: 'Inspection_4718Coronation.pdf',
    size: '3.2 MB',
    pages: 14,
    status: 'uploaded',
  },
];

function DocCard({ doc }) {
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
        <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-primary)', marginBottom: 2 }}>{doc.type}</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {doc.fileName}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 9, color: 'var(--text-dim)' }}>
          <span>{doc.size}</span>
          <span>·</span>
          <span>{doc.pages} page{doc.pages > 1 ? 's' : ''}</span>
          <span>·</span>
          <span style={{ color: 'var(--success)', fontWeight: 600 }}>✓ Uploaded</span>
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
          <span style={{ fontSize: 10 }}>🧬</span>
          Processed by voyage-multimodal-3.5
        </div>
      </div>
    </div>
  );
}

export default function DocumentUpload() {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', borderLeft: '1px solid var(--border-dim)' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, marginBottom: 4, color: 'var(--text-primary)' }}>
        Supporting Documents
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
        Upload income verification, bank statements, and identification.
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); }}
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
          Drag & drop files here
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
          PDF, JPG, PNG up to 10MB each
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        {DOCUMENTS.map((doc) => (
          <DocCard key={doc.id} doc={doc} />
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
    </div>
  );
}
