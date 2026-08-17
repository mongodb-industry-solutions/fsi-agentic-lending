"use client";

import { useState } from "react";
import Header from "../components/Header/Header";
import BorrowerPortal from "../components/BorrowerPortal/BorrowerPortal";
import LoanOfficerDashboard from "../components/LoanOfficerDashboard/LoanOfficerDashboard";
import RenewalDashboard from "../components/RenewalDashboard/RenewalDashboard";
import DemoFlow from "../components/DemoFlow/DemoFlow";
import InfoWizardPanel from "../components/educational/InfoWizardPanel";
import ErrorBoundary from '../components/ErrorBoundary';

export default function Home() {
  const [activeScreen, setActiveScreen] = useState(() => {
    if (typeof window === 'undefined') return 'borrower';
    const params = new URLSearchParams(window.location.search);
    return params.get('screen') || 'borrower';
  });
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
