"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import FeatureBadge from '../FeatureBadge/FeatureBadge';
import CapabilityPopover from '../educational/CapabilityPopover';
import { CAPABILITIES } from '../../lib/data/capabilities';

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
          padding: '8px 14px',
          background: 'var(--bg-surface)',
          borderTop: '1px solid var(--border-dim)',
          borderBottom: '1px solid var(--border-dim)',
          fontSize: 12,
          color: 'var(--text-dim)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span style={{ fontSize: 14 }}>▶</span>
        Click Play or Step to begin the demo.
      </div>
    );
  }

  const features = currentStep.features || [];
  const ops = currentStep.ops || [];
  const hasMemory = !!currentStep.memory;
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
        padding: '6px 14px 0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 10,
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
                    borderRadius: 2,
                    background: i <= stepIndex ? 'var(--mongo)' : 'var(--border-dim)',
                    transition: 'all 0.3s',
                  }}
                />
              ))}
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-dim)', marginLeft: 4,
              }}>
                {stepIndex + 1}/{totalSteps}
              </span>
            </div>
          )}
        </div>
        {timing && (
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
            padding: '2px 8px', borderRadius: 4,
            background: 'var(--mongo-dim)', color: 'var(--mongo)',
          }}>
            {timing}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '4px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {reasoning?.icon && <span style={{ fontSize: 13 }}>{reasoning.icon}</span>}
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11 }}>
            {currentStep.agent}
          </span>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.3 }}>
          {currentStep.description}
        </div>
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap',
        padding: '0 14px 6px',
      }}>
        {features.map((fId) => {
          const cap = FEATURE_MAP[fId];
          if (!cap) return null;
          return (
            <span key={fId} ref={(el) => { badgeRefs.current[fId] = el; }}>
              <FeatureBadge
                icon={cap.icon}
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
        {ops.length > 0 && (
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600,
            padding: '2px 6px', borderRadius: 4,
            background: 'var(--mongo-dim)', color: 'var(--mongo)',
          }}>
            {ops.length} {ops.length === 1 ? 'op' : 'ops'}
          </span>
        )}
        {hasMemory && (
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600,
            padding: '2px 6px', borderRadius: 4,
            background: 'var(--hitl-amber-dim)', color: 'var(--hitl-amber)',
          }}>
            {currentStep.memory.type === 'checkpoint' ? '💾 checkpoint' : '🧠 state'}
          </span>
        )}

        {reasoning?.text && (
          <button
            type="button"
            onClick={() => setReasoningExpanded(!reasoningExpanded)}
            style={{
              marginLeft: 'auto',
              fontSize: 9, fontWeight: 600, fontFamily: 'var(--font-display)',
              padding: '2px 8px', borderRadius: 4,
              border: '1px solid var(--border-dim)', background: 'var(--bg-raised)',
              color: 'var(--text-dim)', cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {reasoningExpanded ? '▾ Hide reasoning' : '▸ Show reasoning'}
          </button>
        )}
      </div>

      {reasoningExpanded && reasoning?.text && (
        <div style={{
          padding: '6px 14px 8px',
          borderTop: '1px solid var(--border-dim)',
          fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.5,
          fontFamily: 'var(--font-body)',
        }}>
          {reasoning.text}
        </div>
      )}
    </div>
  );
}
