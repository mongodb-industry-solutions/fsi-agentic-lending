"use client";

import { useState, useEffect, useCallback } from 'react';
import { apiGet } from '../lib/api';

export default function DocumentJsonViewer({ docId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!docId) return;
    setLoading(true);
    apiGet(`/documents/${docId}/json`).then((result) => {
      setData(result);
      setLoading(false);
    });
  }, [docId]);

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  if (!docId) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 900,
          background: 'rgba(0,0,0,0.5)',
        }}
      />
      {/* Panel */}
      <div
        role="dialog"
        aria-label="Document JSON Viewer"
        aria-modal="true"
        style={{
          position: 'fixed', top: '5vh', right: '5vw', bottom: '5vh',
          width: '60vw', maxWidth: 700, zIndex: 901,
          background: 'var(--bg-base)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-base)',
          boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-dim)',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14 }}>
              MongoDB Document
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
              {data?.doc_type || 'Loading...'}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', fontSize: 18, padding: 4 }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)', fontSize: 12 }}>
              Loading document data...
            </div>
          ) : data ? (
            <>
              {/* Metadata bar */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                {[
                  { label: 'Type', value: data.doc_type },
                  { label: 'Status', value: data.status },
                  { label: 'File', value: data.filename },
                ].map((item) => (
                  <div key={item.label} style={{
                    padding: '4px 10px', background: 'var(--bg-surface)',
                    borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-dim)',
                    fontSize: 10,
                  }}>
                    <span style={{ color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>{item.label}: </span>
                    <span style={{ color: 'var(--mongo)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{item.value}</span>
                  </div>
                ))}
              </div>

              {/* Extracted text summary */}
              {data.extracted_text && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 6 }}>
                    Extracted Text Summary
                  </div>
                  <div style={{
                    padding: 12, background: 'var(--bg-surface)',
                    borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-dim)',
                    fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6,
                    maxHeight: 150, overflowY: 'auto',
                  }}>
                    {data.extracted_text}
                  </div>
                </div>
              )}

              {/* Structured data JSON */}
              {data.structured_data && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 6 }}>
                    Structured Data (MongoDB Document)
                  </div>
                  <pre style={{
                    padding: 12, background: 'var(--bg-raised)',
                    borderRadius: 'var(--radius-sm)',
                    fontFamily: 'var(--font-mono)', fontSize: 10,
                    lineHeight: 1.5, color: 'var(--text-secondary)',
                    overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                    margin: 0,
                  }}>
                    {JSON.stringify(data.structured_data, null, 2)}
                  </pre>
                </div>
              )}

              {/* Full raw document */}
              <details style={{ marginTop: 16 }}>
                <summary style={{
                  fontSize: 10, fontWeight: 700, color: 'var(--text-dim)',
                  textTransform: 'uppercase', cursor: 'pointer', marginBottom: 6,
                }}>
                  Full MongoDB Document (Raw)
                </summary>
                <pre style={{
                  padding: 12, background: 'var(--bg-raised)',
                  borderRadius: 'var(--radius-sm)',
                  fontFamily: 'var(--font-mono)', fontSize: 9,
                  lineHeight: 1.5, color: 'var(--text-dim)',
                  overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                  margin: 0, maxHeight: 400, overflowY: 'auto',
                }}>
                  {JSON.stringify(data, null, 2)}
                </pre>
              </details>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)', fontSize: 12 }}>
              Failed to load document data. Is the backend running?
            </div>
          )}
        </div>
      </div>
    </>
  );
}
