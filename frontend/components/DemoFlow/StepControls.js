"use client";

import { uiTokens } from '../../lib/uiTokens';
import { spacing } from '@leafygreen-ui/tokens';

const SPEEDS = [0.5, 1, 2];

export default function StepControls({ sceneLabel, isPlaying, completed, speed, setSpeed, onPlay, onPause, onStep, onReset }) {
  return (
    <div
      style={{
        padding: `${spacing[3]}px ${spacing[400]}px`,
        background: 'linear-gradient(to top, rgba(6,8,13,0.95) 0%, transparent 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing[3],
      }}
    >
      <div style={{ fontFamily: uiTokens.font, fontWeight: 600, fontSize: 13, color: 'var(--text-secondary)' }}>
        {sceneLabel || 'See It Live'}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2] }}>
        {typeof speed === 'number' && setSpeed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing[1], marginRight: spacing[2] }}>
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSpeed(s)}
                onFocus={(e) => { e.currentTarget.style.boxShadow = uiTokens.focusRing; }}
                onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
                style={{
                  padding: `${spacing[1]}px ${spacing[200]}px`,
                  borderRadius: 8,
                  border: speed === s ? '1px solid var(--mongo)' : '1px solid var(--border-dim)',
                  background: speed === s ? 'var(--mongo-dim)' : 'transparent',
                  color: speed === s ? 'var(--mongo)' : 'var(--text-dim)',
                  fontFamily: uiTokens.monoFont,
                  fontSize: 11,
                  cursor: 'pointer',
                  outline: 'none',
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
              onFocus={(e) => { e.currentTarget.style.boxShadow = uiTokens.focusRing; }}
              onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
              style={{
                padding: `${spacing[2]}px ${spacing[3]}px`,
                borderRadius: 8,
                border: 'none',
                background: 'var(--mongo)',
                color: 'var(--bg-void)',
                fontFamily: uiTokens.font,
                fontWeight: 700,
                fontSize: 12,
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
                padding: `${spacing[2]}px ${spacing[3]}px`,
                borderRadius: 8,
                border: '1px solid var(--border-base)',
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                fontFamily: uiTokens.font,
                fontWeight: 600,
                fontSize: 12,
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              Step
            </button>
          </>
        )}
        <button
          type="button"
          onClick={onReset}
          onFocus={(e) => { e.currentTarget.style.boxShadow = uiTokens.focusRing; }}
          onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
          style={{
            padding: `${spacing[2]}px ${spacing[3]}px`,
            borderRadius: 8,
            border: '1px solid var(--border-dim)',
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
