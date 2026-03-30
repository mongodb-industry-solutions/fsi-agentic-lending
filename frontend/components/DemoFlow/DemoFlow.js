"use client";

import { useState, useEffect } from 'react';
import { useDemoEngine } from '../../lib/hooks/useDemoEngine';
import SceneNavBar from './SceneNavBar';
import TechRecap from './TechRecap';
import TechBreadcrumb from '../educational/TechBreadcrumb';

import OriginationScene from './scenes/OriginationScene';
import DecisioningScene from './scenes/DecisioningScene';
import ApprovalScene from './scenes/ApprovalScene';
import FundingScene from './scenes/FundingScene';
import ManagementScene from './scenes/ManagementScene';

function SceneTitleCard({ sceneMeta }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 800);
    return () => clearTimeout(t);
  }, [sceneMeta?.key]);

  if (!visible || !sceneMeta) return null;
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-backdrop)',
        backdropFilter: 'blur(6px)',
        animation: 'sceneTitleEnter 0.8s ease-out forwards',
        pointerEvents: 'none',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>{sceneMeta.icon}</div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, color: 'var(--text-primary)', marginBottom: 4 }}>{sceneMeta.title}</div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 14, color: 'var(--text-secondary)' }}>{sceneMeta.subtitle}</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--mongo)', marginTop: 8 }}>{sceneMeta.heroAgent}</div>
      </div>
    </div>
  );
}

export default function Demo() {
  const engine = useDemoEngine();
  const [showTitleCard, setShowTitleCard] = useState(false);
  const [prevScene, setPrevScene] = useState(engine.currentScene);

  useEffect(() => {
    if (engine.currentScene !== prevScene) {
      setShowTitleCard(true);
      setPrevScene(engine.currentScene);
      const t = setTimeout(() => setShowTitleCard(false), 800);
      return () => clearTimeout(t);
    }
  }, [engine.currentScene, prevScene]);

  const renderScene = () => {
    switch (engine.currentScene) {
      case 0:
        return (
          <OriginationScene
            sceneStep={engine.sceneStep}
            currentStepData={engine.currentStepData}
          />
        );
      case 1:
        return (
          <DecisioningScene
            sceneStep={engine.sceneStep}
            currentStepData={engine.currentStepData}
          />
        );
      case 2:
        return (
          <ApprovalScene
            sceneStep={engine.sceneStep}
            hitlWaiting={engine.hitlWaiting}
            hitlApproved={engine.hitlApproved}
            onApprove={engine.approveHitl}
            onDecline={engine.reset}
            elapsedMs={engine.elapsedMs}
            currentStepData={engine.currentStepData}
          />
        );
      case 3:
        return (
          <FundingScene
            sceneStep={engine.sceneStep}
            currentStepData={engine.currentStepData}
          />
        );
      case 4:
        return (
          <ManagementScene
            sceneStep={engine.sceneStep}
            currentStepData={engine.currentStepData}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 52px)',
        background: 'var(--bg-void)',
      }}
    >
      <SceneNavBar
        currentScene={engine.currentScene}
        isPlaying={engine.isPlaying}
        speed={engine.speed}
        setSpeed={engine.setSpeed}
        elapsedMs={engine.elapsedMs}
        onGoToScene={engine.goToScene}
        onPlay={engine.play}
        onPause={engine.pause}
        onStep={engine.stepForward}
        onReset={engine.reset}
      />

      <TechBreadcrumb activatedCapabilities={engine.activeFeatures} />

      <div
        className="scene-content"
        style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}
      >
        {showTitleCard && <SceneTitleCard sceneMeta={engine.currentSceneMeta} />}
        {engine.allScenesComplete ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, position: 'relative' }}>
            <div style={{ maxWidth: 700, width: '100%' }}>
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🍃</div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, color: 'var(--mongo)', marginBottom: 8 }}>
                  Full Lifecycle Complete
                </div>
                <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  Origination → Decisioning → Approval → Funding → Management
                  <br />
                  All on one platform. All in real-time.
                </div>
              </div>
              <TechRecap elapsedMs={engine.elapsedMs} />
            </div>
          </div>
        ) : (
          renderScene()
        )}
      </div>
    </div>
  );
}
