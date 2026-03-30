"use client";

import { useState, useEffect } from "react";
import Header from "../components/Header/Header";
import BorrowerPortal from "../components/BorrowerPortal/BorrowerPortal";
import LoanOfficerDashboard from "../components/LoanOfficerDashboard/LoanOfficerDashboard";
import DemoFlow from "../components/DemoFlow/DemoFlow";

export default function Home() {
  const [activeScreen, setActiveScreen] = useState("borrower");

  const [theme, setTheme] = useState(() => {
    if (typeof document === 'undefined') return 'light';
    return document.documentElement.getAttribute('data-theme') || 'light';
  });

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('lendflow-theme', next);
      return next;
    });
  };

  const renderScreen = () => {
    switch (activeScreen) {
      case "borrower":
        return <BorrowerPortal />;
      case "officer":
        return <LoanOfficerDashboard />;
      case "demo":
        return <DemoFlow />;
      default:
        return <BorrowerPortal />;
    }
  };

  return (
    <>
      <Header activeScreen={activeScreen} onScreenChange={setActiveScreen} theme={theme} onThemeToggle={toggleTheme} />
      <main style={{ paddingTop: 52 }}>
        <div key={activeScreen} className="screen-content">
          {renderScreen()}
        </div>
      </main>
    </>
  );
}
