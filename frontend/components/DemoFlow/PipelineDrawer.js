"use client";

import { useState, useCallback, useEffect, useRef } from 'react';
import { palette } from '@leafygreen-ui/palette';
import { spacing } from '@leafygreen-ui/tokens';
import { uiTokens } from '../../lib/uiTokens';
import PipelineTimeline from './PipelineTimeline';

export default function PipelineDrawer({ steps, stepIndex, onEntryHover, highlightNodeId }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);
  const toggleBtnRef = useRef(null);
  const toggle = useCallback(() => setOpen((v) => !v), []);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        toggleBtnRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  return (
    <>
      <button
        ref={toggleBtnRef}
        onClick={toggle}
        aria-label={open ? 'Close pipeline activity' : 'Open pipeline activity'}
        aria-expanded={open}
        style={{
          position: 'absolute',
          right: open ? 380 : 0,
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 51,
          width: 24,
          height: 72,
          border: `1px solid ${palette.gray.light2}`,
          borderRight: open ? 'none' : `1px solid ${palette.gray.light2}`,
          borderRadius: '8px 0 0 8px',
          background: palette.green.dark2,
          color: palette.white,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          fontWeight: 700,
          writingMode: 'vertical-rl',
          textOrientation: 'mixed',
          letterSpacing: '0.5px',
          transition: `right ${uiTokens.transitionMedium}`,
          outline: 'none',
          padding: 0,
        }}
        onFocus={(e) => { e.currentTarget.style.boxShadow = uiTokens.focusRing; }}
        onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
      >
        {open ? '▸' : '◂'} Log
      </button>

      <div
        ref={panelRef}
        role="region"
        aria-label="Pipeline activity log"
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: 380,
          zIndex: 50,
          background: uiTokens.surface1,
          borderLeft: `1px solid ${uiTokens.borderDefault}`,
          boxShadow: open ? uiTokens.shadowElevated : 'none',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: `transform ${uiTokens.transitionMedium}`,
          display: 'flex',
          flexDirection: 'column',
          padding: spacing[3],
          overflow: 'hidden',
        }}
      >
        <PipelineTimeline
          steps={steps}
          stepIndex={stepIndex}
          onEntryHover={onEntryHover}
          highlightNodeId={highlightNodeId}
        />
      </div>
    </>
  );
}
