"use client";

import { useEffect, useRef, useState } from "react";

export function useScrollAnimation(options = {}) {
  const { rootMargin = "0px 0px -80px 0px", threshold = 0.1 } = options;
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { rootMargin, threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin, threshold]);

  return [ref, isVisible];
}
