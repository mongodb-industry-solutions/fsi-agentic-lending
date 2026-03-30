"use client";

export default function SkeletonLoader({ lines = 3, style = {} }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, ...style }}>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} style={{
          height: 12,
          borderRadius: 4,
          background: 'linear-gradient(90deg, var(--bg-raised) 25%, var(--bg-overlay) 50%, var(--bg-raised) 75%)',
          backgroundSize: '200% 100%',
          width: i === lines - 1 ? '60%' : '100%',
          animation: 'shimmer 1.5s infinite linear',
        }} />
      ))}
    </div>
  );
}
