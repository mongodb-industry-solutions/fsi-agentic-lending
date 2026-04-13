"use client";

import { useCallback } from 'react';
import Badge from '@leafygreen-ui/badge';
import Icon from '@leafygreen-ui/icon';
import { spacing } from '@leafygreen-ui/tokens';
import { palette } from '@leafygreen-ui/palette';
import { SCENE_META } from '../../lib/data/demoScenes';
import { CAPABILITIES } from '../../lib/data/capabilities';
import { uiTokens } from '../../lib/uiTokens';

const SPEEDS = [0.25, 0.5, 1, 2];
const TOTAL_CAPABILITIES = CAPABILITIES.length;

export default function SceneNavBar({
  currentScene,
  sceneStep,
  isPlaying,
  speed,
  setSpeed,
  onGoToScene,
  onPlay,
  onPause,
  onStep,
  onStepBack,
  onReset,
  activeFeatures = [],
}) {
  const activeCount = new Set(activeFeatures).size;
  const allActive = activeCount >= TOTAL_CAPABILITIES;

  const cycleSpeed = useCallback(() => {
    const idx = SPEEDS.indexOf(speed);
    setSpeed(SPEEDS[(idx + 1) % SPEEDS.length]);
  }, [speed, setSpeed]);
  const atStart = currentScene === 0 && sceneStep <= 0;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: spacing[150],
        padding: `${spacing[150]}px ${spacing[3]}px`,
        background: 'var(--bg-base)',
        borderBottom: '1px solid var(--border-dim)',
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, flex: 1, minWidth: 0 }}>
        {SCENE_META.map((s, i) => {
          const active = i === currentScene;
          const visited = i < currentScene;
          return (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => onGoToScene(i)}
                onFocus={(e) => { e.currentTarget.style.boxShadow = uiTokens.focusRing; }}
                onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacing[100],
                  padding: `${spacing[2]}px ${spacing[300]}px`,
                  borderRadius: 8,
                  border: active ? '1px solid var(--mongo)' : '1px solid transparent',
                  background: active ? 'var(--mongo-dim)' : visited ? 'var(--bg-raised)' : 'transparent',
                  color: active ? 'var(--mongo)' : visited ? 'var(--text-secondary)' : 'var(--text-dim)',
                  fontFamily: uiTokens.font,
                  fontWeight: active ? 700 : 500,
                  fontSize: 12,
                  cursor: 'pointer',
                  transition: `background ${uiTokens.transitionFast}, color ${uiTokens.transitionFast}, border-color ${uiTokens.transitionFast}`,
                  whiteSpace: 'nowrap',
                  outline: 'none',
                }}
              >
                <Icon glyph={s.glyph} size={14} fill={active ? palette.green.dark2 : palette.gray.base} />
                <span>{s.title}</span>
              </button>
              {i < SCENE_META.length - 1 && (
                <div style={{
                  width: spacing[4],
                  height: 2,
                  borderRadius: 1,
                  background: visited ? 'var(--mongo)' : 'var(--border-dim)',
                  transition: 'background 220ms cubic-bezier(0.33, 1, 0.68, 1)',
                  margin: `0 ${spacing[50]}px`,
                }} />
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2] }}>
        <Badge variant={allActive ? 'green' : 'lightgray'}>
          {activeCount}/{TOTAL_CAPABILITIES} capabilities
        </Badge>

        <button
          type="button"
          onClick={cycleSpeed}
          onFocus={(e) => { e.currentTarget.style.boxShadow = uiTokens.focusRing; }}
          onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
          title="Cycle playback speed"
          style={{
            padding: `${spacing[50]}px ${spacing[2]}px`,
            borderRadius: 8,
            border: '1px solid var(--border-dim)',
            background: 'var(--mongo-dim)',
            color: 'var(--mongo)',
            fontFamily: uiTokens.monoFont,
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
            minWidth: 44,
            textAlign: 'center',
            outline: 'none',
          }}
        >
          {speed}x
        </button>

        <button
          type="button"
          onClick={onStepBack}
          onFocus={(e) => { e.currentTarget.style.boxShadow = uiTokens.focusRing; }}
          onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
          disabled={atStart}
          style={{
            padding: `${spacing[150]}px ${spacing[300]}px`,
            borderRadius: 8,
            border: '1px solid var(--border-base)',
            background: 'var(--bg-surface)',
            color: 'var(--text-primary)',
            fontFamily: uiTokens.font,
            fontWeight: 600,
            fontSize: 11,
            cursor: atStart ? 'default' : 'pointer',
            opacity: atStart ? 0.4 : 1,
            transition: `opacity ${uiTokens.transitionFast}`,
            outline: 'none',
          }}
        >
          ← Back
        </button>

        <button
          type="button"
          onClick={isPlaying ? onPause : onPlay}
          onFocus={(e) => { e.currentTarget.style.boxShadow = uiTokens.focusRing; }}
          onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
          style={{
            padding: `${spacing[150]}px ${spacing[300]}px`,
            borderRadius: 8,
            border: 'none',
            background: 'var(--mongo)',
            color: palette.white,
            fontFamily: uiTokens.font,
            fontWeight: 700,
            fontSize: 11,
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          {isPlaying ? 'Pause' : 'Play'}
        </button>

        <button
          type="button"
          onClick={onStep}
          onFocus={(e) => { e.currentTarget.style.boxShadow = uiTokens.focusRing; }}
          onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
          style={{
            padding: `${spacing[150]}px ${spacing[300]}px`,
            borderRadius: 8,
            border: '1px solid var(--border-base)',
            background: 'var(--bg-surface)',
            color: 'var(--text-primary)',
            fontFamily: uiTokens.font,
            fontWeight: 600,
            fontSize: 11,
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          Step →
        </button>

        <button
          type="button"
          onClick={onReset}
          onFocus={(e) => { e.currentTarget.style.boxShadow = uiTokens.focusRing; }}
          onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
          style={{
            padding: `${spacing[150]}px ${spacing[200]}px`,
            borderRadius: 8,
            border: 'none',
            background: 'transparent',
            color: 'var(--text-dim)',
            fontFamily: uiTokens.monoFont,
            fontSize: 11,
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          Reset
        </button>
      </div>
    </div>
  );
}
