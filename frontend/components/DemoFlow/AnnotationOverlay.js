"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Icon from '@leafygreen-ui/icon';
import FeatureBadge from '../FeatureBadge/FeatureBadge';
import CapabilityPopover from '../educational/CapabilityPopover';
import { CAPABILITIES } from '../../lib/data/capabilities';
import { uiTokens } from '../../lib/uiTokens';
import { spacing } from '@leafygreen-ui/tokens';

const FEATURE_MAP = Object.fromEntries(CAPABILITIES.map((c) => [c.id, c]));

export default function AnnotationOverlay({
  currentStep,
  sceneTitle,
  stepIndex = -1,
  totalSteps = 0,
}) {
  const [reasoningExpanded, setReasoningExpanded] = useState(false);
  const [activePopover, setActivePopover] = useState(null);
  const [popoverPos, setPopoverPos] = useState(null);
  const badgeRefs = useRef({});

  useEffect(() => {
    setActivePopover(null);
  }, [currentStep]);

  const openPopover = useCallback((fId) => {
    if (activePopover === fId) {
      setActivePopover(null);
      return;
    }
    const el = badgeRefs.current[fId];
    if (el) {
      const rect = el.getBoundingClientRect();
      setPopoverPos({ top: rect.bottom + 4, left: Math.max(8, rect.left) });
    }
    setActivePopover(fId);
  }, [activePopover]);

  if (!currentStep) {
    return (
      <div
        style={{
          flexShrink: 0,
          padding: `${spacing[2]}px ${spacing[300]}px`,
          background: 'var(--bg-surface)',
          borderTop: '1px solid var(--border-dim)',
          borderBottom: '1px solid var(--border-dim)',
          fontSize: 12,
          color: 'var(--text-dim)',
          display: 'flex',
          alignItems: 'center',
          gap: spacing[2],
        }}
      >
        <Icon glyph="Play" size={14} />
        Scripted walkthrough — press Play or Step to advance.
      </div>
    );
  }

  const features = currentStep.features || [];
  const reasoning = currentStep.reasoning;
  const timing = reasoning?.timing;

  return (
    <div
      style={{
        flexShrink: 0,
        background: 'var(--bg-surface)',
        borderTop: '1px solid var(--border-dim)',
        borderBottom: '1px solid var(--border-dim)',
        overflow: 'hidden',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: `${spacing[150]}px ${spacing[300]}px 0`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2] }}>
          <span style={{
            fontFamily: uiTokens.font, fontWeight: 700, fontSize: 10,
            color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px',
          }}>
            {sceneTitle || ''}
          </span>
          {totalSteps > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              {Array.from({ length: totalSteps }, (_, i) => (
                <div
                  key={i}
                  style={{
                    width: i === stepIndex ? 14 : 6,
                    height: 4,
                    borderRadius: 8,
                    background: i <= stepIndex ? 'var(--mongo)' : 'var(--border-dim)',
                    transition: '220ms cubic-bezier(0.33, 1, 0.68, 1)',
                  }}
                />
              ))}
              <span style={{
                fontFamily: uiTokens.monoFont, fontSize: 9, color: 'var(--text-dim)', marginLeft: spacing[1],
              }}>
                {stepIndex + 1}/{totalSteps}
              </span>
            </div>
          )}
        </div>
        {timing && (
          <span style={{
            fontFamily: uiTokens.monoFont, fontSize: 10, fontWeight: 700,
            padding: `2px ${spacing[2]}px`, borderRadius: 8,
            background: 'var(--mongo-dim)', color: 'var(--mongo)',
          }}>
            {timing}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: spacing[2], padding: `${spacing[1]}px ${spacing[300]}px` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing[150] }}>
          {reasoning?.glyph && <Icon glyph={reasoning.glyph} size={14} />}
          <span style={{ fontFamily: uiTokens.font, fontWeight: 700, fontSize: 11 }}>
            {currentStep.agent}
          </span>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.3 }}>
          {currentStep.description}
        </div>
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap',
        padding: `0 ${spacing[300]}px ${spacing[150]}px`,
      }}>
        {features.map((fId) => {
          const cap = FEATURE_MAP[fId];
          if (!cap) return null;
          return (
            <span key={fId} ref={(el) => { badgeRefs.current[fId] = el; }}>
              <FeatureBadge
                glyph={cap.glyph}
                label={cap.label}
                colorVar={cap.colorVar}
                active
                small
                onClick={() => openPopover(fId)}
              />
            </span>
          );
        })}
        {activePopover && popoverPos && createPortal(
          <CapabilityPopover
            capabilityId={activePopover}
            onClose={() => setActivePopover(null)}
            style={{ position: 'fixed', top: popoverPos.top, left: popoverPos.left }}
          />,
          document.body,
        )}
        {reasoning?.text && (
          <button
            type="button"
            onClick={() => setReasoningExpanded(!reasoningExpanded)}
            style={{
              marginLeft: 'auto',
              fontSize: 9, fontWeight: 600, fontFamily: uiTokens.font,
              padding: `2px ${spacing[2]}px`, borderRadius: 8,
              border: '1px solid var(--border-dim)', background: 'var(--bg-raised)',
              color: 'var(--text-dim)', cursor: 'pointer',
              transition: '150ms cubic-bezier(0.33, 1, 0.68, 1)',
              outline: 'none',
            }}
            onFocus={(e) => { e.currentTarget.style.boxShadow = uiTokens.focusRing; }}
            onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
          >
            {reasoningExpanded ? '▾ Hide reasoning' : '▸ Show reasoning'}
          </button>
        )}
      </div>

      {reasoningExpanded && reasoning?.text && (
        <div style={{
          padding: `${spacing[150]}px ${spacing[300]}px ${spacing[2]}px`,
          borderTop: '1px solid var(--border-dim)',
          fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.5,
          fontFamily: uiTokens.font,
        }}>
          {reasoning.text}
        </div>
      )}
    </div>
  );
}
