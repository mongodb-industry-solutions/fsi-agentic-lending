"use client";

import { useCallback, useRef } from 'react';

export default function ResizeHandle({ onResize, onDoubleClick }) {
  const dragging = useRef(false);

  const handlePointerDown = useCallback((e) => {
    e.preventDefault();
    dragging.current = true;
    const startY = e.clientY;

    const onMove = (me) => {
      if (!dragging.current) return;
      onResize(me.clientY - startY);
    };
    const onUp = () => {
      dragging.current = false;
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }, [onResize]);

  return (
    <div
      onPointerDown={handlePointerDown}
      onDoubleClick={onDoubleClick}
      style={{
        height: 6,
        cursor: 'row-resize',
        background: 'transparent',
        borderTop: '1px solid var(--border-dim)',
        position: 'relative',
        flexShrink: 0,
        zIndex: 2,
      }}
    >
      <div style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        width: 32,
        height: 3,
        borderRadius: 2,
        background: 'var(--border-base)',
        opacity: 0.4,
        transition: 'opacity 150ms ease',
      }} />
    </div>
  );
}
