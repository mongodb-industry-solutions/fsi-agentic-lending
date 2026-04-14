"use client";

export default function GenUIShimmer() {
  const barStyle = (width, delay) => ({
    height: 10,
    width,
    borderRadius: 4,
    background: 'linear-gradient(90deg, var(--border-dim) 25%, var(--bg-raised) 50%, var(--border-dim) 75%)',
    backgroundSize: '200% 100%',
    animation: `shimmerCard 1.5s infinite ${delay}s`,
  });

  return (
    <div style={{
      padding: 12,
      borderRadius: 8,
      border: '1px solid var(--border-dim)',
      background: 'var(--bg-surface)',
      margin: '8px 0',
    }}>
      <div style={barStyle('40%', 0)} />
      <div style={{ ...barStyle('70%', 0.1), marginTop: 8 }} />
      <div style={{ ...barStyle('55%', 0.2), marginTop: 6 }} />
      <div style={{ ...barStyle('45%', 0.3), marginTop: 6 }} />
    </div>
  );
}
