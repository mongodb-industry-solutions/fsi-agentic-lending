'use client';

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { SCENE_META, SCENE_STEPS } from '../data/demoScenes';

const DELAY_BASE_MS = 800;
const SPEED_MULT = { 0.25: 4, 0.5: 2, 1: 1, 2: 0.5 };

export function useDemoEngine() {
  const [currentScene, setCurrentScene] = useState(0);
  const [sceneStep, setSceneStep] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [hitlWaiting, setHitlWaiting] = useState(false);
  const [hitlApproved, setHitlApproved] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);

  const stepTimerRef = useRef(null);
  const sceneTimerRef = useRef(null);
  const startTimeRef = useRef(0);

  const mult = useMemo(() => SPEED_MULT[speed] ?? 1, [speed]);

  const steps = SCENE_STEPS[currentScene] || [];
  const currentStepData =
    sceneStep >= 0 && sceneStep < steps.length ? steps[sceneStep] : null;
  const sceneComplete = sceneStep >= steps.length - 1 && sceneStep >= 0;
  const allScenesComplete = currentScene >= SCENE_META.length - 1 && sceneComplete;

  const activeFeatures = useMemo(() => {
    const features = new Set();
    for (let s = 0; s <= currentScene; s++) {
      const sceneSteps = SCENE_STEPS[s] || [];
      const limit = s < currentScene ? sceneSteps.length : (sceneStep >= 0 ? sceneStep + 1 : 0);
      for (let i = 0; i < limit; i++) {
        (sceneSteps[i].features || []).forEach((f) => features.add(f));
      }
    }
    return [...features];
  }, [currentScene, sceneStep]);

  const clearTimers = useCallback(() => {
    if (stepTimerRef.current) { clearTimeout(stepTimerRef.current); stepTimerRef.current = null; }
    if (sceneTimerRef.current) { clearTimeout(sceneTimerRef.current); sceneTimerRef.current = null; }
  }, []);

  const pause = useCallback(() => {
    setIsPlaying(false);
    clearTimers();
  }, [clearTimers]);

  const advanceToNextScene = useCallback(() => {
    if (currentScene >= SCENE_META.length - 1) {
      setIsPlaying(false);
      return;
    }
    setCurrentScene((s) => s + 1);
    setSceneStep(-1);
  }, [currentScene]);

  const play = useCallback(() => {
    if (hitlWaiting) return;
    setIsPlaying(true);
    if (!startTimeRef.current) startTimeRef.current = Date.now();

    const currentSteps = SCENE_STEPS[currentScene] || [];

    const runNextStep = () => {
      setSceneStep((i) => {
        const next = i + 1;
        if (next >= currentSteps.length) {
          sceneTimerRef.current = setTimeout(() => {
            advanceToNextScene();
          }, 1500 * mult);
          return i;
        }
        if (currentScene <= 1) {
          setElapsedMs(Date.now() - startTimeRef.current);
        }
        const step = currentSteps[next];
        if (step.isHitl) {
          setHitlWaiting(true);
          setIsPlaying(false);
          return next;
        }
        const delay = (step.delayMs || DELAY_BASE_MS) * mult;
        stepTimerRef.current = setTimeout(runNextStep, delay);
        return next;
      });
    };

    if (sceneStep === -1) {
      const firstStep = currentSteps[0];
      if (!firstStep) return;
      setSceneStep(0);
      if (currentScene === 0) {
        setElapsedMs(0);
        startTimeRef.current = Date.now();
      }
      if (firstStep.isHitl) {
        setHitlWaiting(true);
        setIsPlaying(false);
        return;
      }
      const delay = (firstStep.delayMs || DELAY_BASE_MS) * mult;
      stepTimerRef.current = setTimeout(runNextStep, delay);
    } else if (sceneStep < currentSteps.length - 1) {
      const nextStep = currentSteps[sceneStep + 1];
      if (nextStep.isHitl) {
        setSceneStep(sceneStep + 1);
        setHitlWaiting(true);
        setIsPlaying(false);
        return;
      }
      const delay = (nextStep.delayMs || DELAY_BASE_MS) * mult;
      stepTimerRef.current = setTimeout(runNextStep, delay);
    } else {
      advanceToNextScene();
    }
  }, [currentScene, sceneStep, hitlWaiting, mult, advanceToNextScene]);

  // Auto-start new scenes during playback.
  // Dependencies intentionally exclude sceneStep to avoid cleanup killing timers
  // when setSceneStep(0) triggers a re-render.
  useEffect(() => {
    if (!isPlaying || sceneStep !== -1 || currentScene <= 0) return;

    const currentSteps = SCENE_STEPS[currentScene] || [];
    if (currentSteps.length === 0) return;

    const firstStep = currentSteps[0];
    setSceneStep(0);

    if (firstStep.isHitl) {
      setHitlWaiting(true);
      setIsPlaying(false);
      return;
    }

    let tid = null;

    const runNextStep = () => {
      setSceneStep((i) => {
        const next = i + 1;
        if (next >= currentSteps.length) {
          sceneTimerRef.current = setTimeout(() => {
            advanceToNextScene();
          }, 1500 * mult);
          return i;
        }
        const step = currentSteps[next];
        if (step.isHitl) {
          setHitlWaiting(true);
          setIsPlaying(false);
          return next;
        }
        const delay = (step.delayMs || DELAY_BASE_MS) * mult;
        tid = setTimeout(runNextStep, delay);
        stepTimerRef.current = tid;
        return next;
      });
    };

    const delay = (firstStep.delayMs || DELAY_BASE_MS) * mult;
    tid = setTimeout(runNextStep, delay);
    stepTimerRef.current = tid;

    return () => { if (tid) clearTimeout(tid); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentScene, isPlaying, mult, advanceToNextScene]);

  const stepForward = useCallback(() => {
    if (hitlWaiting) return;
    pause();

    const currentSteps = SCENE_STEPS[currentScene] || [];

    if (sceneStep + 1 < currentSteps.length) {
      const next = sceneStep + 1;
      const step = currentSteps[next];
      setSceneStep(next);
      if (currentScene <= 1 && startTimeRef.current) {
        setElapsedMs(Date.now() - startTimeRef.current);
      }
      if (!startTimeRef.current) {
        startTimeRef.current = Date.now();
        setElapsedMs(0);
      }
      if (step.isHitl) {
        setHitlWaiting(true);
      }
    } else if (currentScene < SCENE_META.length - 1) {
      advanceToNextScene();
    }
  }, [currentScene, sceneStep, hitlWaiting, pause, advanceToNextScene]);

  const goToScene = useCallback(
    (idx) => {
      pause();
      setCurrentScene(idx);
      setSceneStep(-1);
      setHitlWaiting(false);
    },
    [pause],
  );

  const nextScene = useCallback(() => {
    if (currentScene < SCENE_META.length - 1) goToScene(currentScene + 1);
  }, [currentScene, goToScene]);

  const prevScene = useCallback(() => {
    if (currentScene > 0) goToScene(currentScene - 1);
  }, [currentScene, goToScene]);

  const reset = useCallback(() => {
    pause();
    setCurrentScene(0);
    setSceneStep(-1);
    setHitlWaiting(false);
    setHitlApproved(false);
    setElapsedMs(0);
    startTimeRef.current = 0;
  }, [pause]);

  const approveHitl = useCallback(() => {
    setHitlWaiting(false);
    setHitlApproved(true);
    const currentSteps = SCENE_STEPS[currentScene] || [];
    if (sceneStep + 1 < currentSteps.length) {
      setSceneStep(sceneStep + 1);
    }
  }, [currentScene, sceneStep]);

  return {
    sceneMeta: SCENE_META,
    currentScene,
    currentSceneMeta: SCENE_META[currentScene],
    sceneSteps: steps,
    sceneStep,
    currentStepData,
    sceneComplete,
    allScenesComplete,
    isPlaying,
    speed,
    setSpeed,
    hitlWaiting,
    hitlApproved,
    elapsedMs,
    activeFeatures,
    play,
    pause,
    stepForward,
    reset,
    goToScene,
    nextScene,
    prevScene,
    approveHitl,
  };
}
