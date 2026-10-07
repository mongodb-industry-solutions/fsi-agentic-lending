"use client";

import { useState, useEffect } from "react";
import Header from "../components/Header/Header";
import BorrowerPortal from "../components/BorrowerPortal/BorrowerPortal";
import LoanOfficerDashboard from "../components/LoanOfficerDashboard/LoanOfficerDashboard";
import RiskAssessorDashboard from "../components/RiskAssessorDashboard/RiskAssessorDashboard";
import RenewalDashboard from "../components/RenewalDashboard/RenewalDashboard";
import DemoFlow from "../components/DemoFlow/DemoFlow";
import InfoWizardPanel from "../components/educational/InfoWizardPanel";
import ErrorBoundary from '../components/ErrorBoundary';

export default function Home() {
  const [activeScreen, setActiveScreen] = useState('borrower');

  // Apply a deep-linked ?screen= after hydration only — reading window.location
  // during the useState initializer would make client render diverge from the
  // server HTML (React hydration error #418).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const screen = params.get('screen');
    if (screen) setActiveScreen(screen);
  }, []);
  const [infoWizardOpen, setInfoWizardOpen] = useState(false);

  const handleScreenChange = (screen) => {
    setActiveScreen(screen);
    window.history.replaceState(null, '', `?screen=${screen}`);
  };

  return (
    <>
      <Header activeScreen={activeScreen} onScreenChange={handleScreenChange} onInfoOpen={() => setInfoWizardOpen(true)} />
      <main className="app-main" style={{ paddingTop: 52 }}>
        <div className="screen-content" style={{ display: activeScreen === 'borrower' ? 'block' : 'none' }}>
          <ErrorBoundary><BorrowerPortal /></ErrorBoundary>
        </div>
        <div className="screen-content" style={{ display: activeScreen === 'officer' ? 'block' : 'none' }}>
          <ErrorBoundary><LoanOfficerDashboard active={activeScreen === 'officer'} /></ErrorBoundary>
        </div>
        <div className="screen-content" style={{ display: activeScreen === 'risk' ? 'block' : 'none' }}>
          <ErrorBoundary><RiskAssessorDashboard active={activeScreen === 'risk'} /></ErrorBoundary>
        </div>
        <div className="screen-content" style={{ display: activeScreen === 'renewal' ? 'block' : 'none' }}>
          <ErrorBoundary><RenewalDashboard active={activeScreen === 'renewal'} /></ErrorBoundary>
        </div>
        {activeScreen === 'demo' && (
          <div className="screen-content">
            <ErrorBoundary><DemoFlow /></ErrorBoundary>
          </div>
        )}
      </main>
      <InfoWizardPanel
        isOpen={infoWizardOpen}
        onClose={() => setInfoWizardOpen(false)}
        activeScreen={activeScreen}
      />
    </>
  );
}
