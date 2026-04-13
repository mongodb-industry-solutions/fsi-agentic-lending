"use client";

import { useMemo, useState, useCallback } from 'react';
import Badge from '@leafygreen-ui/badge';
import Icon from '@leafygreen-ui/icon';
import { CLOSING_STEPS } from '../engine/demoScenes';
import { mergeCanvasState } from '../engine/canvasUtils';
import WorkflowCanvas from '../WorkflowCanvas';
import AnnotationOverlay from '../AnnotationOverlay';
import PipelineDrawer from '../PipelineDrawer';
import { spacing } from '@leafygreen-ui/tokens';
import { uiTokens } from '../../../lib/uiTokens';

const TIMELINE_EVENTS = [
  { glyph: 'Visibility', label: 'Approval detected', detail: 'Change stream triggers closing workflow', status: 'active' },
  { glyph: 'File', label: 'Closing package', detail: 'Loan agreement, TILA, RESPA documents generated', status: 'active' },
  { glyph: 'Checkmark', label: 'Compliance', detail: 'TILA / RESPA / OSFI checks passed', status: 'active' },
  { glyph: 'Edit', label: 'E-sign complete', detail: 'Conditions satisfied — ready for funding', status: 'ready' },
];

function StatusBadge({ status }) {
  const variantMap = { active: 'green', ready: 'green' };
  return <Badge variant={variantMap[status] || 'lightgray'}>{status.toUpperCase()}</Badge>;
}

export default function ClosingScene({ sceneStep, currentStepData }) {
  const [hoveredNode, setHoveredNode] = useState(null);
  const [timelineHighlight, setTimelineHighlight] = useState(null);

  const handleNodeHover = useCallback((nodeId) => setHoveredNode(nodeId), []);
  const handleTimelineHover = useCallback((nodeId) => setTimelineHighlight(nodeId), []);

  const canvasState = useMemo(
    () => mergeCanvasState(CLOSING_STEPS, sceneStep),
    [sceneStep],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden', display: 'grid', gridTemplateColumns: '1fr' }}>
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ position: 'relative', flex: '1.4 1 0%', minHeight: 240, overflow: 'hidden' }}>
            <WorkflowCanvas
              activeNodes={canvasState.activeNodes}
              activeEdges={canvasState.activeEdges}
              pulsingNodes={canvasState.pulsingNodes}
              completedNodes={canvasState.completedNodes}
              currentScene="closing"
              onNodeHover={handleNodeHover}
              highlightNode={timelineHighlight}
            />
          </div>
          <AnnotationOverlay
            currentStep={currentStepData}
            sceneTitle="Closing"
            stepIndex={sceneStep}
            totalSteps={CLOSING_STEPS.length}
          />
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', borderTop: '1px solid var(--border-dim)', padding: spacing[400] }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing[200], marginBottom: spacing[400] }}>
              <div style={{ fontFamily: uiTokens.font, fontWeight: 700, fontSize: 13 }}>Closing Timeline</div>
              <StatusBadge status={sceneStep >= 3 ? 'ready' : 'active'} />
            </div>

            <div style={{ position: 'relative', paddingLeft: spacing[500], marginBottom: spacing[500] }}>
              <div style={{ position: 'absolute', left: 8, top: 0, bottom: 0, width: 2, background: 'var(--border-dim)' }} />
              {TIMELINE_EVENTS.map((event, i) => {
                const reached = sceneStep >= i;
                return (
                  <div key={event.label} style={{ position: 'relative', paddingLeft: spacing[500], paddingBottom: spacing[400], opacity: reached ? 1 : 0.4, transition: 'opacity 220ms cubic-bezier(0.33, 1, 0.68, 1)' }}>
                    <div style={{ position: 'absolute', left: 0, top: 4, width: 16, height: 16, borderRadius: '50%', background: reached ? 'var(--bg-surface)' : 'var(--bg-raised)', border: `2px solid ${reached ? 'var(--mongo)' : 'var(--border-dim)'}`, zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8 }}>
                      {reached ? '✓' : ''}
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 12, marginBottom: spacing[50], display: 'flex', alignItems: 'center', gap: spacing[1] }}><Icon glyph={event.glyph} size={12} /> {event.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{event.detail}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <PipelineDrawer
          steps={CLOSING_STEPS}
          stepIndex={sceneStep}
          onEntryHover={handleTimelineHover}
          highlightNodeId={hoveredNode}
        />
      </div>
    </div>
  );
}
