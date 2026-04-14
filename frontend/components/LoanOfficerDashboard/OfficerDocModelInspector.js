"use client";

import { spacing } from '@leafygreen-ui/tokens';
import DocumentModelViewer from '../BorrowerPortal/DocumentModelViewer';

export default function OfficerDocModelInspector({ applicationId, expanded, onToggle }) {
  return (
    <div style={{ borderTop: '1px solid var(--border-dim)', background: 'var(--bg-void)' }}>
      {/* Collapsible header */}
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%', padding: '6px 10px',
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          font: 'inherit',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--mongo)', fontFamily: 'var(--font-display)' }}>
            Document Model
          </span>
          <span style={{
            fontSize: 7, fontFamily: 'var(--font-mono)', fontWeight: 700,
            padding: '1px 4px', borderRadius: 3,
            background: 'var(--mongo-dim)', color: 'var(--mongo)',
          }}>
            {'{ }'}
          </span>
        </div>
        <span style={{
          fontSize: 10, color: 'var(--text-dim)',
          transform: expanded ? 'rotate(180deg)' : 'rotate(0)',
          transition: 'transform 150ms ease', display: 'inline-block',
        }}>{'\u25BE'}</span>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div style={{ maxHeight: '45vh', overflowY: 'auto' }}>
          <DocumentModelViewer applicationId={applicationId} />
        </div>
      )}
    </div>
  );
}
