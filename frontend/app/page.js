"use client";

import { useState } from "react";
import Header from "../components/Header/Header";
import BorrowerPortal from "../components/BorrowerPortal/BorrowerPortal";
import LoanOfficerDashboard from "../components/LoanOfficerDashboard/LoanOfficerDashboard";
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

  const renderScreen = () => {
    switch (activeScreen) {
      case "borrower":
        return <ErrorBoundary><BorrowerPortal /></ErrorBoundary>;
      case "officer":
        return <ErrorBoundary><LoanOfficerDashboard /></ErrorBoundary>;
      case "demo":
        return <ErrorBoundary><DemoFlow /></ErrorBoundary>;
      default:
        return <ErrorBoundary><BorrowerPortal /></ErrorBoundary>;
    }
  };

  return (
    <>
      <Header activeScreen={activeScreen} onScreenChange={handleScreenChange} onInfoOpen={() => setInfoWizardOpen(true)} />
      <main className="app-main" style={{ paddingTop: 52 }}>
        <div key={activeScreen} className="screen-content">
          {renderScreen()}
        </div>
      </main>
      <InfoWizardPanel
        isOpen={infoWizardOpen}
        onClose={() => setInfoWizardOpen(false)}
        activeScreen={activeScreen}
      />
    </>
  );
}
