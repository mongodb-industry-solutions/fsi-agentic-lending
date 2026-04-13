import { spacing } from '@leafygreen-ui/tokens';

export function SuggestedQuestions({ onSelect, questions }) {
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap',
      gap: spacing[2], padding: `${spacing[2]}px 0`,
    }}>
      {questions.map((q) => (
        <button
          key={q}
          type="button"
          onClick={() => onSelect(q)}
          style={{
            padding: `${spacing[1]}px ${spacing[3]}px`,
            borderRadius: 20,
            border: '1px solid var(--border-dim)',
            background: 'var(--bg-surface)',
            color: 'var(--text-secondary)',
            fontSize: 12,
            fontFamily: 'var(--font-display)',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'border-color 150ms ease, color 150ms ease, background 150ms ease',
            lineHeight: 1.4,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--mongo)';
            e.currentTarget.style.color = 'var(--mongo)';
            e.currentTarget.style.background = 'var(--mongo-dim)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-dim)';
            e.currentTarget.style.color = 'var(--text-secondary)';
            e.currentTarget.style.background = 'var(--bg-surface)';
          }}
          onFocus={(e) => { e.currentTarget.style.boxShadow = '0 0 0 2px var(--focus-ring, rgba(0, 124, 173, 0.4))'; }}
          onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
        >
          {q}
        </button>
      ))}
    </div>
  );
}
