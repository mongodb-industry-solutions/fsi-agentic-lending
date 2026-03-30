"use client";

import { useState, useEffect } from "react";

export function useCountUp(target, duration = 1500, enabled = true) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setValue(target);
      return;
    }
    let start = null;
    const step = (timestamp) => {
      if (!start) start = timestamp;
      const elapsed = timestamp - start;
      const progress = Math.min(elapsed / duration, 1);
      setValue(Math.round(progress * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration, enabled]);

  return value;
}
