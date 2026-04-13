"use client";

import { useState, useEffect, useRef } from "react";

export function useCountUp(target, duration = 1500, enabled = true) {
  const [value, setValue] = useState(0);
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    if (!enabled) {
      setValue(target);
      return;
    }
    let start = null;
    let frameId;
    const step = (timestamp) => {
      if (cancelled.current) return;
      if (!start) start = timestamp;
      const elapsed = timestamp - start;
      const progress = Math.min(elapsed / duration, 1);
      setValue(Math.round(progress * target));
      if (progress < 1) frameId = requestAnimationFrame(step);
    };
    frameId = requestAnimationFrame(step);
    return () => {
      cancelled.current = true;
      cancelAnimationFrame(frameId);
    };
  }, [target, duration, enabled]);

  return value;
}
