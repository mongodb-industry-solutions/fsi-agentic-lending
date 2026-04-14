"use client";

import { useState, useEffect, lazy, Suspense } from 'react';
import { spacing } from '@leafygreen-ui/tokens';

const ChangeStreamConsole = lazy(() => import('./ChangeStreamConsole'));
const DocumentModelViewer = lazy(() => import('./DocumentModelViewer'));
const AICapabilitiesPanel = lazy(() => import('./AICapabilitiesPanel'));

const TABS = [
  { id: 'stream', label: 'Change Stream', icon: '\u25B8' },
  { id: 'document', label: 'Document Model', icon: '{ }' },
  { id: 'capabilities', label: 'AI Capabilities', icon: '\u25C6' },
];

const PANEL_FALLBACK = (
  <div style={{ padding: spacing[4], fontSize: 11, color: 'var(--text-dim)' }}>Loading...</div>
);

export default function TechnologyTheatre({ applicationId, activeTools, toolHistory, height, onSendMessage }) {
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window === 'undefined') return 'stream';
    return sessionStorage.getItem('lendflow_theatre_tab') || 'stream';
  });
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('lendflow_theatre_tab', activeTab);
    }
  }, [activeTab]);

  const handleTabClick = (tabId) => {
    if (activeTab === tabId && expanded) {
      setExpanded(false);
    } else {
      setActiveTab(tabId);
      setExpanded(true);
    }
  };

  return (
    <div style={{
      flexShrink: 0,
      background: 'var(--bg-base)',
      borderTop: '1px solid var(--border-dim)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      transition: 'height 280ms cubic-bezier(0.33, 1, 0.68, 1)',
    }}>
      {/* Tab bar — always visible */}
      <div style={{
        height: 36,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        background: 'var(--bg-void)',
        borderBottom: expanded ? '1px solid var(--border-dim)' : 'none',
        padding: `0 ${spacing[3]}px`,
        gap: 0,
      }}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id && expanded;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabClick(tab.id)}
              style={{
                height: '100%',
                padding: `0 ${spacing[3]}px`,
                background: 'transparent',
                border: 'none',
                borderBottom: isActive ? '2px solid var(--mongo)' : '2px solid transparent',
                cursor: 'pointer',
                fontSize: 11,
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                color: isActive ? 'var(--text-primary)' : 'var(--text-dim)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'color 150ms ease, border-color 150ms ease',
              }}
            >
              <span style={{
                fontFamily: tab.id === 'document' ? 'var(--font-mono)' : 'var(--font-display)',
                fontSize: tab.id === 'document' ? 10 : 12,
                opacity: isActive ? 1 : 0.6,
              }}>
                {tab.icon}
              </span>
              {tab.label}
              {tab.id === 'stream' && expanded && activeTab === 'stream' && (
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: 'var(--mongo-bright)',
                  animation: 'pulse 1.5s infinite',
                  flexShrink: 0,
                }} />
              )}
            </button>
          );
        })}

        <div style={{ flex: 1 }} />

        <button
          type="button"
          onClick={() => setExpanded((p) => !p)}
          style={{
            width: 24, height: 24, borderRadius: 4,
            border: '1px solid var(--border-dim)',
            background: 'var(--bg-base)',
            color: 'var(--text-dim)',
            fontSize: 10,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0)',
            transition: 'transform 220ms cubic-bezier(0.33, 1, 0.68, 1)',
          }}
        >
          {'\u25B4'}
        </button>
      </div>

      {/* Panel content */}
      {expanded && (
        <div style={{
          flex: 1,
          minHeight: 0,
          height: height || 260,
          maxHeight: '50vh',
          overflowY: 'auto',
        }}>
          <Suspense fallback={PANEL_FALLBACK}>
            {activeTab === 'stream' && <ChangeStreamConsole applicationId={applicationId} />}
            {activeTab === 'document' && <DocumentModelViewer applicationId={applicationId} />}
            {activeTab === 'capabilities' && (
              <AICapabilitiesPanel
                applicationId={applicationId}
                activeTools={activeTools}
                toolHistory={toolHistory}
                onSendMessage={onSendMessage}
              />
            )}
          </Suspense>
        </div>
      )}
    </div>
  );
}
