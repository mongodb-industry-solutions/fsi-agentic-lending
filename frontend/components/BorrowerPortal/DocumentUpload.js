"use client";

import { useState } from 'react';

const DOCUMENTS = [
  {
    id: 'w2',
    type: 'W-2 Wage & Tax Statement',
    icon: '📄',
    fileName: 'W2_2024_SarahChen.pdf',
    size: '842 KB',
    pages: 2,
    status: 'uploaded',
  },
  {
    id: 'bank',
    type: 'Bank Statement',
    icon: '🏦',
    fileName: 'Chase_Statement_Dec2024.pdf',
    size: '1.2 MB',
    pages: 4,
    status: 'uploaded',
  },
  {
    id: 'paystub',
    type: 'Pay Stub',
    icon: '💵',
    fileName: 'PayStub_Jan2025.pdf',
    size: '324 KB',
    pages: 1,
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
          Documents processed using <strong style={{ color: 'var(--voyage)' }}>voyage-multimodal-3.5</strong> — a unified transformer that embeds text, document images, and visual layout into a single vector space. No modality gap means your W-2 image and its extracted text fields produce semantically aligned embeddings.
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
