"use client";

import { useState, useCallback, useEffect } from 'react';
import { spacing } from '@leafygreen-ui/tokens';
import OfficerChangeStreamConsole from './OfficerChangeStreamConsole';
import AggregationPipelineVisualizer from './AggregationPipelineVisualizer';
import OfficerDocModelInspector from './OfficerDocModelInspector';

function CollapsedTechRail({ onExpand }) {
  // Single expand toggle \u2014 reveals the MongoDB technology panels on demand.
  return (
    <div style={{
      width: 40, flexShrink: 0,
      borderLeft: '1px solid var(--border-dim)',
      background: 'var(--bg-base)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', paddingTop: spacing[2],
    }}>
      <button
        type="button"
        title="Show MongoDB technology panels"
        aria-label="Show MongoDB technology panels"
        onClick={onExpand}
        style={{
          width: 32, flex: 1, maxHeight: 220, borderRadius: 6,
          border: '1px solid var(--border-dim)',
          background: 'var(--bg-surface)',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
          gap: spacing[2], paddingTop: spacing[2],
          transition: 'background 150ms ease, color 150ms ease',
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 700 }}>{'\u00ab'}</span>
        <span style={{
          writingMode: 'vertical-rl', transform: 'rotate(180deg)',
          fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
          textTransform: 'uppercase', fontFamily: 'var(--font-display)',
        }}>
          MongoDB
        </span>
      </button>
    </div>
  );
}

function TechRailHeader({ onCollapse }) {
  return (
    <div style={{
      padding: '8px 10px',
      borderBottom: '1px solid var(--border-dim)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: 'var(--bg-base)',
      flexShrink: 0,
    }}>
      <div>
        <div style={{
          fontFamily: 'var(--font-display)', fontWeight: 700,
          fontSize: 11, color: 'var(--text-primary)',
          textTransform: 'uppercase', letterSpacing: '0.5px',
        }}>
          MongoDB Technology
        </div>
        <div style={{
          fontSize: 9, color: 'var(--text-dim)',
          fontFamily: 'var(--font-mono)', marginTop: 1,
        }}>
          Data layer instrumentation
        </div>
      </div>
      <button
        type="button"
        onClick={onCollapse}
        style={{
          width: 24, height: 24, borderRadius: 6,
          border: '1px solid var(--border-dim)',
          background: 'var(--bg-surface)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, color: 'var(--text-dim)',
        }}
      >
        {'\u00BB'}
      </button>
    </div>
  );
}

const TECHRAIL_PREF_KEY = 'lendflow_techrail_expanded';

export default function TechRail({ applicationId, liveAgentOutput, lastCorrelatedEvent, activityEvents, streamConnected }) {
  // Collapsed by default (keeps the MongoDB detail out of the way); the officer's
  // choice persists so re-expanding sticks across app switches.
  const [expanded, setExpanded] = useState(false);

  // Restore the persisted preference after hydration — localStorage reads in a
  // useState initializer would mismatch the server-rendered HTML (#418).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setExpanded(window.localStorage.getItem(TECHRAIL_PREF_KEY) === '1');
  }, []);
  const [pipelineExpanded, setPipelineExpanded] = useState(false);
  const [docModelExpanded, setDocModelExpanded] = useState(false);

  const handleToggle = useCallback(() => setExpanded((p) => {
    const next = !p;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(TECHRAIL_PREF_KEY, next ? '1' : '0');
    }
    return next;
  }), []);
  const handlePipelineToggle = useCallback(() => setPipelineExpanded((p) => !p), []);
  const handleDocToggle = useCallback(() => setDocModelExpanded((p) => !p), []);

  if (!expanded) {
    return <CollapsedTechRail onExpand={handleToggle} />;
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      width: 340, minWidth: 260, flexShrink: 0,
      overflow: 'hidden',
      borderLeft: '1px solid var(--border-dim)',
      background: 'var(--bg-void)',
      transition: 'width 280ms cubic-bezier(0.33, 1, 0.68, 1)',
    }}>
      <TechRailHeader onCollapse={handleToggle} />

      {/* Change Stream Console — primary, flex:1 */}
      <div style={{ flex: 1, minHeight: 200, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <OfficerChangeStreamConsole
          applicationId={applicationId}
          lastCorrelatedEvent={lastCorrelatedEvent}
          activityEvents={activityEvents}
          streamConnected={streamConnected}
        />
      </div>

      {/* Aggregation Pipeline Visualizer — collapsible */}
      <AggregationPipelineVisualizer
        applicationId={applicationId}
        liveAgentOutput={liveAgentOutput}
        expanded={pipelineExpanded}
        onToggle={handlePipelineToggle}
      />

      {/* Document Model Inspector — collapsible */}
      <OfficerDocModelInspector
        applicationId={applicationId}
        expanded={docModelExpanded}
        onToggle={handleDocToggle}
      />
    </div>
  );
}
