"use client";

const SPEEDS = [0.5, 1, 2];

export default function StepControls({ sceneLabel, isPlaying, completed, speed, setSpeed, onPlay, onPause, onStep, onReset }) {
  return (
    <div
      style={{
        padding: '12px 20px',
        background: 'linear-gradient(to top, rgba(6,8,13,0.95) 0%, transparent 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
      }}
    >
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13, color: 'var(--text-secondary)' }}>
        {sceneLabel || 'See It Live'}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {typeof speed === 'number' && setSpeed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginRight: 8 }}>
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSpeed(s)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: speed === s ? '1px solid var(--mongo)' : '1px solid var(--border-dim)',
                  background: speed === s ? 'var(--mongo-dim)' : 'transparent',
                  color: speed === s ? 'var(--mongo)' : 'var(--text-dim)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                {s}x
              </button>
            ))}
          </div>
        )}
        {!completed && (
          <>
            <button
              type="button"
              onClick={isPlaying ? onPause : onPlay}
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: 'var(--mongo)',
                color: 'var(--bg-void)',
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              {isPlaying ? 'Pause' : 'Play'}
            </button>
            <button
              type="button"
              onClick={onStep}
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-base)',
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Step
            </button>
          </>
        )}
        <button
          type="button"
          onClick={onReset}
          style={{
            padding: '8px 16px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-dim)',
            background: 'transparent',
            color: 'var(--text-dim)',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            cursor: 'pointer',
          }}
        >
          Reset
        </button>
      </div>
    </div>
  );
}
