import { spacing } from '@leafygreen-ui/tokens';
import { CATEGORY_COLORS } from './chatConstants';

// F2: `questions` is always an array of { text, category, ... } objects.
// D4: compact vertical layout with tight gap + reduced padding.
export function SuggestedQuestions({ onSelect, questions, showHint = false }) {
  if (!questions || questions.length === 0) return null;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      gap: 3, padding: `${spacing[1]}px 0 ${spacing[2]}px`,
    }}>
      {showHint && (
        <div style={{
          fontSize: 9, color: 'var(--text-dim)',
          fontFamily: 'var(--font-mono)', textTransform: 'uppercase',
          letterSpacing: '0.04em', marginBottom: 2,
        }}>
          {'Suggested \u00B7 matched to your stage'}
        </div>
      )}
      {questions.map((q, idx) => {
        const borderColor = CATEGORY_COLORS[q.category] || 'var(--border-dim)';
        const isProactive = !!q._proactive;
        const accentColor = isProactive ? (q._color || borderColor) : borderColor;

        return (
          <button
            key={`${q.text}-${idx}`}
            type="button"
            onClick={() => onSelect(q.message || q.text)}
            style={{
              padding: '5px 10px',
              borderRadius: 6,
              border: '1px solid var(--border-dim)',
              borderLeft: `3px solid ${accentColor}`,
              background: isProactive
                ? `color-mix(in srgb, ${accentColor} 6%, var(--bg-surface))`
                : 'var(--bg-surface)',
              color: 'var(--text-secondary)',
              fontSize: 11,
              fontFamily: 'var(--font-display)',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'border-color 150ms ease, color 150ms ease, background 150ms ease',
              lineHeight: 1.4,
              textAlign: 'left',
              animation: `thinkingFade 200ms cubic-bezier(0.33, 1, 0.68, 1) ${idx * 50}ms both`,
              display: 'flex', alignItems: 'center', gap: 6,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = accentColor;
              e.currentTarget.style.color = 'var(--text-primary)';
              e.currentTarget.style.background = `color-mix(in srgb, ${accentColor} 8%, var(--bg-surface))`;
              e.currentTarget.style.borderLeftColor = accentColor;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-dim)';
              e.currentTarget.style.color = 'var(--text-secondary)';
              e.currentTarget.style.background = isProactive
                ? `color-mix(in srgb, ${accentColor} 6%, var(--bg-surface))`
                : 'var(--bg-surface)';
              e.currentTarget.style.borderLeftColor = accentColor;
            }}
            onFocus={(e) => { e.currentTarget.style.boxShadow = '0 0 0 2px var(--focus-ring, rgba(0, 124, 173, 0.4))'; }}
            onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
          >
            {isProactive && (
              <span style={{
                fontSize: 8, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.04em', color: accentColor,
                fontFamily: 'var(--font-display)', flexShrink: 0,
              }}>
                Try
              </span>
            )}
            <span style={{ flex: 1 }}>{q.text}</span>
          </button>
        );
      })}
    </div>
  );
}
