"use client";

/**
 * Fraud network canvas for hero takeover: applicant at center, nodes by hop (1–3).
 * Color-coded: green (applicant), blue (hop 1), purple (hop 2), dim gray (hop 3).
 */
import { useRef, useEffect, useState } from 'react';

const APPLICANT = { id: 'applicant', label: 'Applicant', hop: 0, color: '#00ED64' };
const HOP_NODES = [
  ...Array.from({ length: 8 }, (_, i) => ({ id: `h1-${i}`, label: `Entity ${i + 1}`, hop: 1, color: '#3b82f6' })),
  ...Array.from({ length: 12 }, (_, i) => ({ id: `h2-${i}`, label: `Entity ${i + 9}`, hop: 2, color: '#a855f7' })),
  ...Array.from({ length: 20 }, (_, i) => ({ id: `h3-${i}`, label: `Entity ${i + 21}`, hop: 3, color: '#4f5b73' })),
];

export default function FraudGraph({ width: widthProp, height: heightProp, hopReveal = 3, fillContainer = false }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [size, setSize] = useState({ width: widthProp || 400, height: heightProp || 300 });
  const [hoverNode, setHoverNode] = useState(null);

  useEffect(() => {
    if (!fillContainer || !containerRef.current) {
      if (widthProp && heightProp) setSize({ width: widthProp, height: heightProp });
      return;
    }
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0]?.contentRect ?? {};
      if (width > 0 && height > 0) setSize({ width, height });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [fillContainer, widthProp, heightProp]);

  const width = size.width;
  const height = size.height;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width <= 0 || height <= 0) return;

    const ctx = canvas.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    const cx = width / 2;
    const cy = height / 2;

    const nodesToShow = [APPLICANT, ...HOP_NODES.filter((n) => n.hop <= hopReveal)];

    // Layout: applicant at center, others in rings by hop
    const positions = new Map();
    positions.set('applicant', { x: cx, y: cy });
    [1, 2, 3].forEach((hop) => {
      const group = nodesToShow.filter((n) => n.hop === hop);
      const ring = hop === 1 ? 90 : hop === 2 ? 160 : 220;
      group.forEach((n, i) => {
        const angle = (i / Math.max(1, group.length)) * Math.PI * 2 - Math.PI / 2;
        positions.set(n.id, { x: cx + ring * Math.cos(angle), y: cy + ring * Math.sin(angle) });
      });
    });

    ctx.clearRect(0, 0, width, height);

    // Edges from applicant outward
    const applicantPos = positions.get('applicant');
    nodesToShow.filter((n) => n.hop === 1).forEach((n) => {
      const p = positions.get(n.id);
      if (!p) return;
      ctx.strokeStyle = 'rgba(59,130,246,0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(applicantPos.x, applicantPos.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    });
    nodesToShow.filter((n) => n.hop === 2).forEach((n) => {
      const p = positions.get(n.id);
      const first = nodesToShow.find((x) => x.hop === 1);
      const p1 = first && positions.get(first.id);
      if (p && p1) {
        ctx.strokeStyle = 'rgba(168,85,247,0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
    });
    nodesToShow.filter((n) => n.hop === 3).forEach((n) => {
      const p = positions.get(n.id);
      const second = nodesToShow.find((x) => x.hop === 2);
      const p2 = second && positions.get(second.id);
      if (p && p2) {
        ctx.strokeStyle = 'rgba(79,91,115,0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p2.x, p2.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
    });

    // Nodes
    nodesToShow.forEach((n) => {
      const pos = positions.get(n.id);
      if (!pos) return;
      const r = n.hop === 0 ? 24 : 14;
      const isHover = hoverNode === n.id;
      ctx.fillStyle = n.color;
      ctx.globalAlpha = n.hop === 3 ? 0.7 : 1;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r + (isHover ? 4 : 0), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      if (n.hop === 0) {
        ctx.strokeStyle = 'rgba(0,237,100,0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });

    // Labels for applicant and hover
    ctx.font = '11px var(--font-body)';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'var(--text-primary)';
    if (hoverNode) {
      const n = nodesToShow.find((x) => x.id === hoverNode);
      const pos = positions.get(hoverNode);
      if (n && pos) {
        ctx.fillText(n.label, pos.x, pos.y + 28);
      }
    } else {
      ctx.fillText(APPLICANT.label, cx, cy + 32);
    }
  }, [width, height, hopReveal, hoverNode]);

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width / (canvas.width / (window.devicePixelRatio || 1));
    const scaleY = rect.height / (canvas.height / (window.devicePixelRatio || 1));
    const x = (e.clientX - rect.left) / scaleX;
    const y = (e.clientY - rect.top) / scaleY;
    const cx = width / 2;
    const cy = height / 2;
    const nodesToShow = [APPLICANT, ...HOP_NODES.filter((n) => n.hop <= hopReveal)];
    const positions = new Map();
    positions.set('applicant', { x: cx, y: cy });
    [1, 2, 3].forEach((hop) => {
      const group = nodesToShow.filter((n) => n.hop === hop);
      const ring = hop === 1 ? 90 : hop === 2 ? 160 : 220;
      group.forEach((n, i) => {
        const angle = (i / Math.max(1, group.length)) * Math.PI * 2 - Math.PI / 2;
        positions.set(n.id, { x: cx + ring * Math.cos(angle), y: cy + ring * Math.sin(angle) });
      });
    });
    let found = null;
    nodesToShow.forEach((n) => {
      const pos = positions.get(n.id);
      if (!pos) return;
      const r = n.hop === 0 ? 24 : 14;
      if (Math.hypot(x - pos.x, y - pos.y) <= r + 4) found = n.id;
    });
    setHoverNode(found);
  };

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative', background: 'var(--bg-base)', borderRadius: 'var(--radius-md)', minHeight: 200 }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: '100%', height: '100%', display: 'block' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverNode(null)}
      />
      <div style={{ position: 'absolute', bottom: 12, left: 12, right: 12, display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: 11, color: 'var(--text-secondary)' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '8px 16px', borderRadius: 'var(--radius-md)',
          background: 'var(--success-dim)', border: '1px solid var(--success)',
          boxShadow: '0 0 12px rgba(0, 104, 74, 0.15)',
        }}>
          <div style={{
            width: 10, height: 10, borderRadius: '50%',
            background: 'var(--success)', boxShadow: '0 0 6px var(--success)',
          }} />
          <span style={{
            fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14,
            color: 'var(--success)', letterSpacing: '0.05em',
          }}>NETWORK CLEAR</span>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)',
          }}>2,847 entities · 0 suspicious links</span>
        </div>
      </div>
    </div>
  );
}
