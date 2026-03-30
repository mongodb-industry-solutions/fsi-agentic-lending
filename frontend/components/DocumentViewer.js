"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiGet } from '../lib/api';

export default function DocumentViewer({ docId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('structured'); // structured | raw | text
  const dialogRef = useRef(null);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!docId) return;
    setLoading(true);
    apiGet(`/documents/${docId}/json`)
      .then((result) => setData(result))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [docId]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'Tab') {
        const focusable = dialogRef.current?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  if (!docId) return null;

  const pdfUrl = `/api/backend/documents/${docId}/pdf`;

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 900,
        background: 'rgba(0,0,0,0.6)',
      }} />

      {/* Viewer */}
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-label="Document Viewer" aria-modal="true" style={{
        position: 'fixed', top: 24, left: 24, right: 24, bottom: 24,
        zIndex: 901, background: 'var(--bg-base)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-base)',
        boxShadow: 'var(--shadow-xl, 0 20px 25px rgba(0,0,0,0.08))',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px',
          borderBottom: '1px solid var(--border-dim)',
          flexShrink: 0,
          background: 'var(--bg-surface)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>📄</span>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13 }}>
                {data?.doc_type?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Document'}
              </div>
              <div style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                {data?.filename || ''}
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', fontSize: 18, padding: 4 }}
            aria-label="Close">×</button>
        </div>

        {/* Split pane */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          {/* Left: PDF */}
          <div style={{ flex: 1, borderRight: '1px solid var(--border-dim)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '6px 12px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-dim)', fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
              Original Document
            </div>
            <iframe
              src={pdfUrl}
              title="PDF Viewer"
              sandbox="allow-scripts allow-same-origin"
              style={{ flex: 1, border: 'none', width: '100%' }}
            />
          </div>

          {/* Right: Extracted data */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            {/* Tabs */}
            <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border-dim)', flexShrink: 0 }}>
              {[
                { id: 'structured', label: 'Extracted Fields' },
                { id: 'text', label: 'Text Summary' },
                { id: 'raw', label: 'Raw JSON' },
              ].map((tab) => (
                <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
                  style={{
                    padding: '8px 16px', border: 'none', cursor: 'pointer',
                    background: activeTab === tab.id ? 'var(--bg-base)' : 'var(--bg-surface)',
                    color: activeTab === tab.id ? 'var(--mongo)' : 'var(--text-dim)',
                    fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 600,
                    borderBottom: activeTab === tab.id ? '2px solid var(--mongo)' : '2px solid transparent',
                  }}>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
              {loading ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)', fontSize: 12 }}>Loading...</div>
              ) : !data ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)', fontSize: 12 }}>Failed to load document data.</div>
              ) : activeTab === 'structured' ? (
                <StructuredView data={data.structured_data} />
              ) : activeTab === 'text' ? (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                  {data.extracted_text || 'No text summary available.'}
                </div>
              ) : (
                <pre style={{
                  fontFamily: 'var(--font-mono)', fontSize: 10, lineHeight: 1.5,
                  color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0,
                }}>
                  {JSON.stringify(data, null, 2)}
                </pre>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function StructuredView({ data }) {
  if (!data || typeof data !== 'object') {
    return <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>No structured data available.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Object.entries(data).filter(([k]) => k !== 'text_summary' && k !== 'raw_response' && k !== 'error').map(([key, value]) => (
        <div key={key} style={{
          padding: '8px 12px', background: 'var(--bg-surface)',
          borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-dim)',
        }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 4 }}>
            {key.replace(/_/g, ' ')}
          </div>
          {typeof value === 'object' && value !== null ? (
            <pre style={{
              fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)',
              whiteSpace: 'pre-wrap', margin: 0, lineHeight: 1.5,
            }}>
              {JSON.stringify(value, null, 2)}
            </pre>
          ) : (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }}>
              {String(value)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
