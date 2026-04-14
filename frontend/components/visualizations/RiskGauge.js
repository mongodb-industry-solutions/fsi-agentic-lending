"use client";

export default function RiskGauge({ score = 72, size = 140, strokeWidth = 12 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = Math.PI * radius; // Half circle
  const pct = Math.min(Math.max(score / 100, 0), 1);
  const offset = circumference * (1 - pct);

  // Color: green (0-40) → amber (40-70) → red (70-100)
  const color = score <= 40 ? 'var(--success)' : score <= 70 ? 'var(--hitl-amber)' : 'var(--danger)';
  const tier = score <= 30 ? 'A' : score <= 50 ? 'B+' : score <= 65 ? 'B' : score <= 80 ? 'C' : 'D';

  return (
    <div role="img" aria-label={`Risk score: ${score} out of 100, tier ${tier}`} style={{ position: 'relative', width: size, height: size * 0.65 }}>
      <svg width={size} height={size * 0.65} viewBox={`0 0 ${size} ${size * 0.65}`}>
        {/* Background arc */}
        <path
          d={`M ${strokeWidth / 2} ${size * 0.6} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size * 0.6}`}
          fill="none" stroke="var(--border-dim)" strokeWidth={strokeWidth} strokeLinecap="round"
        />
        {/* Filled arc */}
        <path
          d={`M ${strokeWidth / 2} ${size * 0.6} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size * 0.6}`}
          fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1.2s ease-out' }}
        />
      </svg>
      {/* Center text */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: size * 0.2, fontWeight: 800, color, lineHeight: 1 }}>
          {score}
        </div>
        <div style={{
          fontSize: 10, fontWeight: 700, color: score <= 40 ? '#FFFFFF' : '#001E2B',
          background: color, padding: '2px 8px', borderRadius: 4, marginTop: 2,
        }}>
          {tier}
        </div>
      </div>
    </div>
  );
}
