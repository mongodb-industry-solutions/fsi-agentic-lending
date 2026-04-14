"use client";

import { useState, useCallback } from 'react';
import { spacing } from '@leafygreen-ui/tokens';
import OfficerChangeStreamConsole from './OfficerChangeStreamConsole';
import AggregationPipelineVisualizer from './AggregationPipelineVisualizer';
import OfficerDocModelInspector from './OfficerDocModelInspector';

function CollapsedTechRail({ onExpand }) {
  const icons = [
    { id: 'stream', icon: '>\u2502', label: 'Change Streams' },
    { id: 'pipeline', icon: '>>', label: 'Agg Pipeline' },
    { id: 'doc', icon: '{ }', label: 'Document Model' },
  ];

  return (
    <div style={{
      width: 40, flexShrink: 0,
      borderLeft: '1px solid var(--border-dim)',
      background: 'var(--bg-base)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', paddingTop: spacing[2], gap: spacing[1],
    }}>
      {icons.map((item) => (
        <button
          key={item.id}
          type="button"
          title={item.label}
          onClick={onExpand}
          style={{
            width: 32, height: 32, borderRadius: 6,
            border: '1px solid var(--border-dim)',
            background: 'var(--bg-surface)',
            color: 'var(--text-dim)',
            fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 150ms ease, color 150ms ease',
          }}
        >
          {item.icon}
        </button>
      ))}
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

export default function TechRail({ applicationId, liveAgentOutput, lastCorrelatedEvent }) {
  const [expanded, setExpanded] = useState(true);
  const [pipelineExpanded, setPipelineExpanded] = useState(false);
  const [docModelExpanded, setDocModelExpanded] = useState(false);

  const handleToggle = useCallback(() => setExpanded((p) => !p), []);
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
        />
      </div>

      {/* Aggregation Pipeline Visualizer — collapsible */}
      <AggregationPipelineVisualizer
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
