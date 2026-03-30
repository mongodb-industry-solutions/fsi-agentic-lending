"use client";

import { useEffect, useState } from 'react';

export default function FicoRing({ score = 784, max = 850, size = 120, strokeWidth = 8 }) {
  const [animated, setAnimated] = useState(0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(score / max, 1);

  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimated(pct));
    return () => cancelAnimationFrame(id);
  }, [pct]);

  const offset = circumference * (1 - animated);
  const color = score >= 740 ? 'var(--mongo)' : score >= 670 ? 'var(--hitl-amber)' : 'var(--danger)';

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Equifax score: ${score} out of ${max}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--border-dim)" strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1.5s ease-out' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: Math.round(size * 0.22), fontWeight: 800, color }}>{score}</div>
        <div style={{ fontSize: Math.round(size * 0.08), color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>Equifax</div>
      </div>
    </div>
  );
}
