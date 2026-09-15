"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
import { spacing } from '@leafygreen-ui/tokens';
import Code from '@leafygreen-ui/code';
import { getDocumentRecord, getDocumentPdfUrl } from '../lib/documents';

const TABS = [
  { id: 'extracted', label: 'Extracted Data' },
  { id: 'mongodb', label: 'MongoDB Document' },
  { id: 'embeddings', label: 'Embeddings' },
];

const sectionLabel = {
  fontFamily: 'var(--font-display)',
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: 'var(--text-secondary)',
};

function SectionLabel({ children, description }) {
  return (
    <div style={{ marginBottom: spacing[2] }}>
      <div style={sectionLabel}>{children}</div>
      {description && (
        <div style={{
          fontFamily: 'var(--font-body)',
          fontSize: 11,
          color: 'var(--text-dim)',
          marginTop: 2,
        }}>
          {description}
        </div>
      )}
    </div>
  );
}

function TabBar({ activeTab, onTabChange }) {
  return (
    <div
      role="tablist"
      aria-label="Document detail views"
      style={{
        display: 'flex',
        borderBottom: '1px solid var(--border-dim)',
        background: 'var(--bg-surface)',
        flexShrink: 0,
      }}
    >
      {TABS.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            aria-controls={`tabpanel-${tab.id}`}
            id={`tab-${tab.id}`}
            type="button"
            onClick={() => onTabChange(tab.id)}
            style={{
              flex: 1,
              padding: `${spacing[2]}px ${spacing[3]}px`,
              background: isActive ? 'var(--bg-base)' : 'none',
              border: 'none',
              borderBottom: isActive ? '2px solid var(--mongo)' : '2px solid transparent',
              fontFamily: 'var(--font-display)',
              fontSize: 12,
              fontWeight: isActive ? 700 : 500,
              color: isActive ? 'var(--mongo)' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'color 150ms ease, border-color 150ms ease, background 150ms ease',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              if (!isActive) e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              if (!isActive) e.currentTarget.style.color = 'var(--text-secondary)';
            }}
            onFocus={(e) => { e.currentTarget.style.boxShadow = '0 0 0 2px inset var(--focus-ring, rgba(0, 124, 173, 0.4))'; }}
            onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function ExtractedDataPanel({ data }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[4] }}>
      {/* AI Attribution */}
      <div style={{
        background: 'var(--agent-cyan-dim)',
        borderLeft: '3px solid var(--agent-cyan)',
        padding: `${spacing[2]}px ${spacing[3]}px`,
        borderRadius: '0 8px 8px 0',
      }}>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--agent-cyan)',
          marginBottom: 2,
        }}>
          AI-Powered Extraction
        </div>
        <div style={{
          fontSize: 11,
          color: 'var(--text-secondary)',
          lineHeight: 1.5,
        }}>
          Structured data extracted by <strong style={{ color: 'var(--agent-cyan)' }}>Claude Haiku 4.5</strong>. PDF pages embedded as images via <strong style={{ color: 'var(--agent-cyan)' }}>voyage-multimodal-3.5</strong>.
        </div>
      </div>

      {/* Extracted Fields */}
      <div>
        <SectionLabel description="Key-value pairs parsed from the original document">
          Extracted Fields
        </SectionLabel>
        <ExtractedFields data={data.structured_data} />
      </div>

      {/* AI Summary */}
      {data.extracted_text && (
        <div>
          <SectionLabel description="Generated during document ingestion">
            AI-Generated Summary
          </SectionLabel>
          <div style={{
            fontFamily: 'var(--font-body)',
            fontSize: 13,
            color: 'var(--text-secondary)',
            lineHeight: 1.7,
            whiteSpace: 'pre-wrap',
            background: 'var(--bg-surface)',
            padding: spacing[3],
            borderRadius: 8,
            border: '1px solid var(--border-dim)',
            borderLeft: '3px solid var(--border-base)',
          }}>
            {data.extracted_text}
          </div>
        </div>
      )}
    </div>
  );
}

function truncateForDisplay(data) {
  if (!data || typeof data !== 'object') return data;
  const clone = { ...data };
  if (Array.isArray(clone.embedding) && clone.embedding.length > 10) {
    const len = clone.embedding.length;
    clone.embedding = [
      ...clone.embedding.slice(0, 5),
      `... ${len - 10} more values ...`,
      ...clone.embedding.slice(-5),
    ];
  }
  return clone;
}

function MongoDBDocumentPanel({ data }) {
  const meta = [
    { label: 'Document Type', value: data.doc_type?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) },
    { label: 'Status', value: data.status },
    { label: 'Filename', value: data.filename },
    { label: 'Created', value: data.created_at ? new Date(data.created_at).toLocaleString() : 'N/A' },
  ];

  const jsonString = useMemo(
    () => JSON.stringify(truncateForDisplay(data), null, 2),
    [data],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[4] }}>
      {/* Metadata strip */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: spacing[2],
      }}>
        {meta.map(({ label, value }) => (
          <div key={label} style={{
            padding: `${spacing[2]}px ${spacing[3]}px`,
            background: 'var(--bg-surface)',
            borderRadius: 8,
            border: '1px solid var(--border-dim)',
          }}>
            <div style={{
              ...sectionLabel,
              fontSize: 10,
              marginBottom: 2,
            }}>
              {label}
            </div>
            <div style={{
              fontFamily: label === 'Filename' ? 'var(--font-mono)' : 'var(--font-body)',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-primary)',
              wordBreak: 'break-all',
            }}>
              {value || 'N/A'}
            </div>
          </div>
        ))}
      </div>

      {/* JSON document */}
      <div>
        <SectionLabel description="Full document as stored in MongoDB (embedding array truncated)">
          Raw Document
        </SectionLabel>
        <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-dim)' }}>
          <Code language="json" copyable={true}>
            {jsonString}
          </Code>
        </div>
      </div>
    </div>
  );
}

function EmbeddingsPanel({ data }) {
  const fullEmbedding = data.embedding;
  const preview = data.embedding_preview;
  const embedding =
    Array.isArray(fullEmbedding) && fullEmbedding.length > 0
      ? fullEmbedding
      : Array.isArray(preview) && preview.length > 0
        ? preview
        : null;
  const hasEmbedding = !!embedding;
  const isPreviewOnly = hasEmbedding && !(Array.isArray(fullEmbedding) && fullEmbedding.length > 0);
  const dims =
    Array.isArray(fullEmbedding) && fullEmbedding.length > 0
      ? fullEmbedding.length
      : data.embedding_dim || null;
  const isMultimodal = data.embedding_type === 'multimodal';
  const pageCount = data.embedding_pages || 0;

  const fmt = (v) => typeof v === 'number' ? v.toFixed(8) : String(v);
  const vectorPreview = hasEmbedding
    ? embedding.length <= 10
      ? `[\n${embedding.map(v => `  ${fmt(v)}`).join(',\n')}\n]`
      : `[\n${embedding.slice(0, 5).map(v => `  ${fmt(v)}`).join(',\n')},\n  // ... ${embedding.length - 10} more values ...\n${embedding.slice(-5).map(v => `  ${fmt(v)}`).join(',\n')}\n]`
    : null;

  const inputTypeValue = isMultimodal
    ? `multimodal (${pageCount} ${pageCount === 1 ? 'page' : 'pages'})`
    : 'text';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[4] }}>
      {/* Model info */}
      <div style={{
        background: 'var(--voyage-dim)',
        borderLeft: '3px solid var(--voyage)',
        padding: `${spacing[2]}px ${spacing[3]}px`,
        borderRadius: '0 8px 8px 0',
      }}>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: 13,
          fontWeight: 700,
          color: 'var(--voyage)',
          marginBottom: spacing[1],
        }}>
          Multimodal Embedding
        </div>
        <div style={{
          fontSize: 12,
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
        }}>
          Generated by <strong style={{ color: 'var(--voyage)' }}>voyage-multimodal-3.5</strong> — {isMultimodal
            ? `PDF pages were directly embedded as images (${pageCount} ${pageCount === 1 ? 'page' : 'pages'}), capturing visual layout, tables, and formatting.`
            : 'a unified transformer embedding model for text, images, and documents.'}
        </div>
      </div>

      {/* Metadata */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: spacing[2],
      }}>
        {[
          { label: 'Model', value: 'voyage-multimodal-3.5' },
          { label: 'Dimensions', value: dims ? String(dims) : 'N/A' },
          { label: 'Input Type', value: inputTypeValue },
          { label: 'Status', value: hasEmbedding ? (isPreviewOnly ? 'Bundled preview' : 'Generated') : 'Not available' },
        ].map(({ label, value }) => (
          <div key={label} style={{
            padding: `${spacing[2]}px ${spacing[3]}px`,
            background: 'var(--bg-surface)',
            borderRadius: 8,
            border: '1px solid var(--border-dim)',
          }}>
            <div style={{
              ...sectionLabel,
              fontSize: 10,
              marginBottom: 2,
            }}>
              {label}
            </div>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Vector preview */}
      {vectorPreview && (
        <div>
          <SectionLabel description={`${dims || embedding.length}-dimensional float vector${isPreviewOnly ? ' · bundled preview' : ''}`}>
            Vector Preview
          </SectionLabel>
          <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-dim)' }}>
            <Code language="json" copyable={true}>
              {vectorPreview}
            </Code>
          </div>
        </div>
      )}

      {/* Bundled-preview note */}
      {isPreviewOnly && (
        <div style={{
          fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.6,
          padding: `${spacing[2]}px ${spacing[3]}px`,
          background: 'var(--bg-raised)', borderRadius: 8,
          border: '1px solid var(--border-dim)',
        }}>
          Bundled demo preview ({preview.length} of {dims} values) — the full embedding vector lives
          in MongoDB Atlas and is returned once the database is seeded.
        </div>
      )}

      {/* Embedding pipeline */}
      {isMultimodal && (
        <div>
          <SectionLabel description="How the PDF was converted into a vector embedding">
            Embedding Pipeline
          </SectionLabel>
          <div style={{
            background: 'var(--bg-surface)',
            borderRadius: 8,
            border: '1px solid var(--border-dim)',
            padding: spacing[3],
            display: 'flex',
            alignItems: 'center',
            gap: spacing[2],
            flexWrap: 'wrap',
          }}>
            {[
              { icon: '\uD83D\uDCC4', label: 'Original PDF', detail: `${pageCount} ${pageCount === 1 ? 'page' : 'pages'}` },
              null,
              { icon: '\uD83D\uDDBC\uFE0F', label: 'Page Images', detail: 'Rendered via PyMuPDF' },
              null,
              { icon: '\uD83E\uDDE0', label: 'Voyage Multimodal', detail: 'voyage-multimodal-3.5' },
              null,
              { icon: '\uD83D\uDCCD', label: '1024-d Vector', detail: 'Stored in Atlas' },
            ].map((step, i) =>
              step === null ? (
                <span key={`arrow-${i}`} style={{
                  color: 'var(--voyage)',
                  fontWeight: 700,
                  fontSize: 14,
                  userSelect: 'none',
                }}>{'\u2192'}</span>
              ) : (
                <div key={step.label} style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 2,
                  minWidth: 80,
                  flex: '1 0 0',
                }}>
                  <span style={{ fontSize: 18 }}>{step.icon}</span>
                  <span style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 10,
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    textAlign: 'center',
                  }}>{step.label}</span>
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 9,
                    color: 'var(--text-dim)',
                    textAlign: 'center',
                  }}>{step.detail}</span>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* Embedding source info */}
      {isMultimodal ? (
        <div>
          <SectionLabel description="PDF pages were rendered as images and embedded directly by the multimodal model">
            Document Pages Embedded
          </SectionLabel>
          <div style={{
            fontFamily: 'var(--font-body)',
            fontSize: 12,
            color: 'var(--text-secondary)',
            lineHeight: 1.7,
            background: 'var(--bg-surface)',
            padding: spacing[3],
            borderRadius: 8,
            border: '1px solid var(--border-dim)',
            borderLeft: '3px solid var(--voyage)',
          }}>
            <strong style={{ color: 'var(--text-primary)' }}>{pageCount} {pageCount === 1 ? 'page' : 'pages'}</strong> rendered from the PDF at up to 200 DPI and passed as PIL Images directly to Voyage&apos;s multimodal embedding API.
            The vector captures visual layout, tables, signatures, and formatting — not just extracted text.
            No OCR or text extraction is used for the embedding; the model sees the document exactly as a human would.
          </div>
        </div>
      ) : data.extracted_text ? (
        <div>
          <SectionLabel description="Text summary was extracted and embedded (legacy text-only embedding)">
            Extracted Text Embedding
          </SectionLabel>
          <div style={{
            fontFamily: 'var(--font-body)',
            fontSize: 12,
            color: 'var(--text-secondary)',
            lineHeight: 1.7,
            whiteSpace: 'pre-wrap',
            background: 'var(--bg-surface)',
            padding: spacing[3],
            borderRadius: 8,
            border: '1px solid var(--border-dim)',
            borderLeft: '3px solid var(--voyage)',
            maxHeight: 260,
            overflowY: 'auto',
          }}>
            {data.extracted_text.length > 1200
              ? data.extracted_text.slice(0, 1200) + '...'
              : data.extracted_text}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function DocumentViewer({ docId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('extracted');
  const dialogRef = useRef(null);

  useEffect(() => { dialogRef.current?.focus(); }, []);

  useEffect(() => {
    if (!docId) return;
    setLoading(true);
    getDocumentRecord(docId)
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
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  if (!docId) return null;

  const pdfUrl = getDocumentPdfUrl(docId);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 900,
          background: 'rgba(0,0,0,0.5)',
          animation: 'backdropEnter 0.2s ease-out',
        }}
      />

      {/* Modal */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-label="Document Viewer"
        aria-modal="true"
        style={{
          position: 'fixed',
          top: '3vh', left: '3vw', right: '3vw', bottom: '3vh',
          zIndex: 901,
          background: 'var(--bg-base)',
          borderRadius: 8,
          border: '1px solid var(--border-base)',
          boxShadow: 'var(--shadow-xl)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          animation: 'modalEnter 0.22s cubic-bezier(0.33, 1, 0.68, 1) forwards',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: `${spacing[2]}px ${spacing[3]}px`,
          borderBottom: '1px solid var(--border-dim)',
          background: 'var(--bg-surface)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2] }}>
            <div>
              <div style={{
                fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14,
                color: 'var(--text-primary)',
              }}>
                {data?.doc_type?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Document'}
              </div>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 10,
                color: 'var(--text-dim)',
              }}>
                {data?.filename || 'Loading...'}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close document viewer"
            style={{
              width: 28, height: 28, borderRadius: 6,
              border: '1px solid var(--border-dim)',
              background: 'var(--bg-base)',
              color: 'var(--text-dim)', fontSize: 14,
              cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              transition: 'background 150ms ease, color 150ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-raised)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--bg-base)';
              e.currentTarget.style.color = 'var(--text-dim)';
            }}
            onFocus={(e) => { e.currentTarget.style.boxShadow = '0 0 0 2px var(--focus-ring, rgba(0, 124, 173, 0.4))'; }}
            onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
          >
            ×
          </button>
        </div>

        {/* Split Pane */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>

          {/* Left: Original PDF */}
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            borderRight: '1px solid var(--border-dim)',
            background: 'var(--bg-surface)',
          }}>
            <div style={{
              padding: `${spacing[1]}px ${spacing[3]}px`,
              borderBottom: '1px solid var(--border-dim)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{
                fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700,
                color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.04em',
              }}>
                Original Document
              </span>
              {pdfUrl && (
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: 10, color: 'var(--mongo)', fontWeight: 600,
                    textDecoration: 'none', fontFamily: 'var(--font-display)',
                  }}
                >
                  Open in new tab
                </a>
              )}
            </div>
            {pdfUrl ? (
              <object
                data={pdfUrl}
                type="application/pdf"
                style={{ flex: 1, width: '100%', border: 'none' }}
              >
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', height: '100%', padding: spacing[5],
                  color: 'var(--text-dim)', textAlign: 'center',
                }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 8, marginBottom: spacing[2],
                    border: '2px solid var(--border-dim)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
                    color: 'var(--text-dim)',
                  }}>PDF</div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: spacing[1] }}>
                    PDF preview unavailable
                  </div>
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      padding: `${spacing[1]}px ${spacing[3]}px`,
                      borderRadius: 6, border: 'none',
                      background: 'var(--mongo)', color: 'var(--bg-base)',
                      fontFamily: 'var(--font-display)',
                      fontWeight: 600, fontSize: 12,
                      textDecoration: 'none', cursor: 'pointer',
                    }}
                  >
                    Download PDF
                  </a>
                </div>
              </object>
            ) : (
              <div style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', padding: spacing[5],
                color: 'var(--text-dim)', textAlign: 'center',
              }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 8, marginBottom: spacing[2],
                  border: '2px solid var(--border-dim)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
                  color: 'var(--text-dim)',
                }}>PDF</div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: spacing[1], color: 'var(--text-secondary)' }}>
                  PDF preview requires the seeded database
                </div>
                <div style={{ fontSize: 10, lineHeight: 1.5, maxWidth: 320 }}>
                  The document&apos;s extracted data is bundled with the demo. The original PDF is served
                  from the backend document store once the database is seeded.
                </div>
              </div>
            )}
          </div>

          {/* Right: Tabbed detail pane */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            {!loading && data && <TabBar activeTab={activeTab} onTabChange={setActiveTab} />}

            <div
              {...(!loading && data ? {
                id: `tabpanel-${activeTab}`,
                role: 'tabpanel',
                'aria-labelledby': `tab-${activeTab}`,
              } : {})}
              style={{ flex: 1, overflowY: 'auto', padding: spacing[3] }}
            >
              {loading ? (
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', height: '100%', color: 'var(--text-dim)',
                }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%',
                    border: '2px solid var(--border-base)',
                    borderTopColor: 'var(--mongo)',
                    animation: 'spin 0.8s linear infinite',
                    marginBottom: spacing[2],
                  }} />
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 500 }}>
                    Loading document data...
                  </div>
                </div>
              ) : !data ? (
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', height: '100%', color: 'var(--text-dim)',
                }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%',
                    border: '2px solid var(--danger)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700,
                    color: 'var(--danger)', marginBottom: spacing[2],
                  }}>!</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 500 }}>
                    Failed to load document data
                  </div>
                  <div style={{ fontSize: 10, marginTop: spacing[1] }}>Is the backend running?</div>
                </div>
              ) : (
                <>
                  {activeTab === 'extracted' && <ExtractedDataPanel data={data} />}
                  {activeTab === 'mongodb' && <MongoDBDocumentPanel data={data} />}
                  {activeTab === 'embeddings' && <EmbeddingsPanel data={data} />}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function ExtractedFields({ data }) {
  if (!data || typeof data !== 'object') {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: 200,
        border: '1px dashed var(--border-dim)', borderRadius: 8,
        color: 'var(--text-dim)', background: 'var(--bg-void)',
      }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 500 }}>
          No structured data available
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[2] }}>
      {Object.entries(data)
        .filter(([k]) => k !== 'text_summary' && k !== 'raw_response' && k !== 'error')
        .map(([key, value]) => (
          <div key={key} style={{
            padding: `${spacing[2]}px ${spacing[3]}px`,
            background: 'var(--bg-surface)',
            borderRadius: 8,
            border: '1px solid var(--border-dim)',
          }}>
            <div style={{
              ...sectionLabel,
              fontSize: 10,
              marginBottom: spacing[1],
            }}>
              {key.replace(/_/g, ' ')}
            </div>
            {typeof value === 'object' && value !== null ? (
              <div style={{ borderRadius: 6, overflow: 'hidden' }}>
                <Code language="json">
                  {JSON.stringify(value, null, 2)}
                </Code>
              </div>
            ) : (
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 14,
                color: 'var(--text-primary)',
                fontWeight: 600,
              }}>
                {String(value)}
              </div>
            )}
          </div>
        ))}
    </div>
  );
}
