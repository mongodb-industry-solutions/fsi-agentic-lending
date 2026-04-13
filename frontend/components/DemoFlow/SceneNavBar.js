"use client";

import { spacing } from '@leafygreen-ui/tokens';
import { SCENE_META } from '../../lib/data/demoScenes';

const SPEEDS = [0.25, 0.5, 1, 2];

export default function SceneNavBar({
  currentScene,
  sceneStep,
  isPlaying,
  speed,
  setSpeed,
  elapsedMs,
  onGoToScene,
  onPlay,
  onPause,
  onStep,
  onStepBack,
  onReset,
}) {
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
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacing[100],
                  padding: `${spacing[2]}px ${spacing[300]}px`,
                  borderRadius: 'var(--radius-sm)',
                  border: active ? '1px solid var(--mongo)' : '1px solid transparent',
                  background: active ? 'var(--mongo-dim)' : visited ? 'var(--bg-raised)' : 'transparent',
                  color: active ? 'var(--mongo)' : visited ? 'var(--text-secondary)' : 'var(--text-dim)',
                  fontFamily: 'var(--font-display)',
                  fontWeight: active ? 700 : 500,
                  fontSize: 12,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap',
                }}
              >
                <span style={{ fontSize: 13 }}>{s.icon}</span>
                <span>{s.title}</span>
              </button>
              {i < SCENE_META.length - 1 && (
                <div style={{
                  width: spacing[4],
                  height: 2,
                  borderRadius: 1,
                  background: visited ? 'var(--mongo)' : 'var(--border-dim)',
                  transition: 'background 0.4s ease',
                  margin: `0 ${spacing[50]}px`,
                }} />
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2] }}>
        <span
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--mongo)',
            minWidth: 140,
            textAlign: 'right',
          }}
        >
          <span style={{ fontFamily: 'var(--font-display)' }}>{SCENE_META[currentScene]?.title}</span>
          {' · '}
          <span style={{ fontFamily: 'var(--font-mono)' }}>{(elapsedMs / 1000).toFixed(2)}s</span>
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: spacing[50], marginLeft: spacing[2] }}>
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSpeed(s)}
              style={{
                padding: `${spacing[50]}px ${spacing[2]}px`,
                borderRadius: 'var(--radius-sm)',
                border: speed === s ? '1px solid var(--mongo)' : '1px solid var(--border-dim)',
                background: speed === s ? 'var(--mongo-dim)' : 'transparent',
                color: speed === s ? 'var(--mongo)' : 'var(--text-dim)',
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                cursor: 'pointer',
              }}
            >
              {s}x
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onStepBack}
          disabled={atStart}
          style={{
            padding: `${spacing[150]}px ${spacing[300]}px`,
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-base)',
            background: 'var(--bg-surface)',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: 11,
            cursor: atStart ? 'default' : 'pointer',
            opacity: atStart ? 0.4 : 1,
            transition: 'opacity 0.15s ease',
          }}
        >
          ← Back
        </button>

        <button
          type="button"
          onClick={isPlaying ? onPause : onPlay}
          style={{
            padding: `${spacing[150]}px ${spacing[300]}px`,
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            background: 'var(--mongo)',
            color: '#ffffff',
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 11,
            cursor: 'pointer',
          }}
        >
          {isPlaying ? '⏸ Pause' : '▶ Play'}
        </button>

        <button
          type="button"
          onClick={onStep}
          style={{
            padding: `${spacing[150]}px ${spacing[300]}px`,
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-base)',
            background: 'var(--bg-surface)',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: 11,
            cursor: 'pointer',
          }}
        >
          Step →
        </button>

        <button
          type="button"
          onClick={onReset}
          style={{
            padding: `${spacing[150]}px ${spacing[200]}px`,
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-dim)',
            background: 'transparent',
            color: 'var(--text-dim)',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            cursor: 'pointer',
          }}
        >
          Reset
        </button>
      </div>
    </div>
  );
}
