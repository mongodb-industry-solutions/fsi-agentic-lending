"use client";

import { useState, useEffect } from 'react';
import Icon from '@leafygreen-ui/icon';
import { palette } from '@leafygreen-ui/palette';
import { spacing } from '@leafygreen-ui/tokens';
import { useDemoEngine } from '../../lib/hooks/useDemoEngine';
import { SCENE_META } from '../../lib/data/demoScenes';
import { uiTokens } from '../../lib/uiTokens';
import SceneNavBar from './SceneNavBar';
import TechRecap from './TechRecap';
import WorkflowCanvas, { ALL_NODE_IDS, ALL_EDGES } from './WorkflowCanvas';

import OriginationScene from './scenes/OriginationScene';
import UnderwritingScene from './scenes/UnderwritingScene';
import ApprovalScene from './scenes/ApprovalScene';
import ClosingScene from './scenes/ClosingScene';
import FundingScene from './scenes/FundingScene';
import ServicingScene from './scenes/ServicingScene';

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
        <div style={{ marginBottom: spacing[2] }}><Icon glyph={sceneMeta.glyph} size="xlarge" fill={palette.green.dark2} /></div>
        <div style={{ fontFamily: uiTokens.font, fontWeight: 800, fontSize: 28, color: 'var(--text-primary)', marginBottom: spacing[1] }}>{sceneMeta.title}</div>
        <div style={{ fontFamily: uiTokens.font, fontWeight: 500, fontSize: 14, color: 'var(--text-secondary)' }}>{sceneMeta.subtitle}</div>
        <div style={{ fontFamily: uiTokens.monoFont, fontSize: 11, color: 'var(--mongo)', marginTop: spacing[2] }}>{sceneMeta.heroAgent}</div>
      </div>
    </div>
  );
}

function DisclaimerModal({ onDismiss }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(6px)',
        animation: 'fadeIn 0.3s ease-out',
      }}
      onClick={onDismiss}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-surface, #fff)',
          borderRadius: 12,
          padding: `${spacing[600]}px ${spacing[600]}px ${spacing[400]}px`,
          maxWidth: 520,
          width: '90%',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.25)',
          border: '1px solid var(--border-dim, #e8edeb)',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing[200], marginBottom: spacing[300] }}>
          <Icon glyph="InfoWithCircle" size="large" fill={palette.blue.base} />
          <span style={{
            fontFamily: uiTokens.font,
            fontWeight: 700,
            fontSize: 18,
            color: 'var(--text-primary)',
          }}>
            About This View
          </span>
        </div>

        <p style={{
          fontFamily: uiTokens.font,
          fontSize: 14,
          lineHeight: 1.7,
          color: 'var(--text-secondary)',
          margin: `0 0 ${spacing[200]}px`,
        }}>
          This is a <strong style={{ color: 'var(--text-primary)' }}>scripted walkthrough</strong> that
          illustrates the full mortgage lifecycle powered by MongoDB Atlas &amp; AI agents.
          It uses pre-built scenes with synthetic data to highlight key technology touchpoints.
        </p>

        <p style={{
          fontFamily: uiTokens.font,
          fontSize: 14,
          lineHeight: 1.7,
          color: 'var(--text-secondary)',
          margin: `0 0 ${spacing[400]}px`,
        }}>
          For the <strong style={{ color: 'var(--text-primary)' }}>live, interactive demo</strong> — where
          AI agents process real applications in real-time — switch to
          the <strong style={{ color: 'var(--mongo)' }}>Borrower Portal</strong> or <strong style={{ color: 'var(--mongo)' }}>Loan Officer Dashboard</strong> tabs.
        </p>

        <button
          onClick={onDismiss}
          style={{
            width: '100%',
            padding: `${spacing[200]}px ${spacing[400]}px`,
            background: palette.green.dark2,
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontFamily: uiTokens.font,
            fontWeight: 600,
            fontSize: 14,
            cursor: 'pointer',
            transition: uiTokens.transitionFast,
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = palette.green.dark3}
          onMouseLeave={(e) => e.currentTarget.style.background = palette.green.dark2}
        >
          Got it — explore the walkthrough
        </button>
      </div>
    </div>
  );
}

export default function Demo() {
  const engine = useDemoEngine();
  const [showTitleCard, setShowTitleCard] = useState(false);
  const [prevScene, setPrevScene] = useState(engine.currentScene);
  const [showDisclaimer, setShowDisclaimer] = useState(true);

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
          <UnderwritingScene
            sceneStep={engine.sceneStep}
            currentStepData={engine.currentStepData}
          />
        );
      case 2:
        return (
          <ApprovalScene
            sceneStep={engine.sceneStep}
            hitlApproved={engine.hitlApproved}
            hitlDeclined={engine.hitlDeclined}
            onApprove={engine.approveHitl}
            onDecline={engine.declineHitl}
            currentStepData={engine.currentStepData}
          />
        );
      case 3:
        return (
          <ClosingScene
            sceneStep={engine.sceneStep}
            currentStepData={engine.currentStepData}
          />
        );
      case 4:
        return (
          <FundingScene
            sceneStep={engine.sceneStep}
            currentStepData={engine.currentStepData}
          />
        );
      case 5:
        return (
          <ServicingScene
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
      {showDisclaimer && <DisclaimerModal onDismiss={() => setShowDisclaimer(false)} />}

      <SceneNavBar
        currentScene={engine.currentScene}
        sceneStep={engine.sceneStep}
        isPlaying={engine.isPlaying}
        speed={engine.speed}
        setSpeed={engine.setSpeed}
        onGoToScene={engine.goToScene}
        onPlay={engine.play}
        onPause={engine.pause}
        onStep={engine.stepForward}
        onStepBack={engine.stepBackward}
        onReset={engine.reset}
        activeFeatures={engine.activeFeatures}
      />

      <div
        className="scene-content"
        style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}
      >
        {showTitleCard && <SceneTitleCard sceneMeta={engine.currentSceneMeta} />}
        {engine.allScenesComplete ? (
          <div style={{ flex: 1, overflowY: 'auto', padding: spacing[4] }}>
            <div style={{
              height: 300,
              borderRadius: 8,
              border: `1px solid ${palette.gray.light2}`,
              overflow: 'hidden',
              position: 'relative',
            }}>
              <WorkflowCanvas
                activeNodes={ALL_NODE_IDS}
                activeEdges={ALL_EDGES}
                completedNodes={ALL_NODE_IDS}
                currentScene={null}
              />
            </div>

            <div style={{ maxWidth: 700, width: '100%', margin: '0 auto' }}>
              <div style={{ textAlign: 'center', marginTop: spacing[3], marginBottom: spacing[4] }}>
                <div style={{ marginBottom: spacing[3] }}><Icon glyph="Favorite" size="xlarge" fill={palette.green.dark2} /></div>
                <div style={{ fontFamily: uiTokens.font, fontWeight: 800, fontSize: 28, color: 'var(--mongo)', marginBottom: spacing[2] }}>
                  Full Lifecycle Complete
                </div>
                <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  Origination → Underwriting → Approval → Closing → Funding → Servicing
                  <br />
                  All on one platform. All in real-time.
                </div>
              </div>
              <TechRecap activeFeatures={engine.activeFeatures} />
            </div>
          </div>
        ) : (
          renderScene()
        )}
      </div>
    </div>
  );
}
