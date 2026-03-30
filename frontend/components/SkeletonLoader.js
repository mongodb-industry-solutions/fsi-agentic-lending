"use client";

export default function SkeletonLoader({ lines = 3, style = {} }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, ...style }}>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} style={{
          height: 12,
          borderRadius: 4,
          background: 'var(--bg-raised)',
          width: i === lines - 1 ? '60%' : '100%',
          animation: 'shimmer 1.5s infinite',
        }} />
      ))}
    </div>
  );
}
