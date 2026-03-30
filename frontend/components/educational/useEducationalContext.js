"use client";

import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'lendflow-edu-seen';

function readStorage() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

export function useEducationalContext() {
  const [seen, setSeen] = useState(null);

  useEffect(() => {
    setSeen(readStorage());
  }, []);

  const markSeen = useCallback((id) => {
    setSeen((prev) => {
      const next = { ...(prev ?? {}), [id]: Date.now() };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const hasSeen = useCallback((id) => !!(seen ?? {})[id], [seen]);

  const resetAll = useCallback(() => {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    setSeen({});
  }, []);

  return { hasSeen, markSeen, resetAll, isReady: seen !== null };
}
