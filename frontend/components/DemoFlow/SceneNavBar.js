"use client";

import { SCENE_META } from '../../lib/data/demoScenes';

const SPEEDS = [0.25, 0.5, 1, 2];

export default function SceneNavBar({
  currentScene,
  isPlaying,
  speed,
  setSpeed,
  elapsedMs,
  onGoToScene,
  onPlay,
  onPause,
  onStep,
  onReset,
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 16px',
        background: 'var(--bg-base)',
        borderBottom: '1px solid var(--border-dim)',
        flexWrap: 'wrap',
      }}
    >
      <div aria-label="Demo stages" style={{ display: 'flex', alignItems: 'center', gap: 0, flex: 1, minWidth: 0 }}>
        {SCENE_META.map((s, i) => {
          const active = i === currentScene;
          const visited = i < currentScene;
          return (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center' }}>
              <button
                type="button"
                aria-current={active ? "step" : undefined}
                onClick={() => onGoToScene(i)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: active ? '1px solid var(--mongo)' : '1px solid transparent',
                  background: active ? 'var(--mongo-dim)' : visited ? 'var(--bg-raised)' : 'transparent',
                  color: active ? 'var(--mongo)' : visited ? 'var(--text-secondary)' : 'var(--text-dim)',
                  fontFamily: 'var(--font-display)',
                  fontWeight: active ? 700 : 500,
                  fontSize: 11,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap',
                }}
              >
                <span style={{ fontSize: 13 }}>{s.icon}</span>
                <span>{s.title}</span>
              </button>
              {i < SCENE_META.length - 1 && (
                <span
                  style={{
                    fontSize: 10,
                    color: visited ? 'var(--mongo)' : 'var(--text-dim)',
                    margin: '0 2px',
                    opacity: visited ? 1 : 0.4,
                    transition: 'all 0.3s',
                  }}
                >
                  →
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--mongo)',
            minWidth: 56,
            textAlign: 'right',
          }}
        >
          {(elapsedMs / 1000).toFixed(2)}s
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginLeft: 8 }}>
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSpeed(s)}
              style={{
                padding: '3px 8px',
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
          onClick={isPlaying ? onPause : onPlay}
          style={{
            padding: '6px 14px',
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
            padding: '6px 14px',
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
            padding: '6px 10px',
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
