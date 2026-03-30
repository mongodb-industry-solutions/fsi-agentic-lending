"use client";

import { useState } from "react";
import Header from "../components/Header/Header";
import BorrowerPortal from "../components/BorrowerPortal/BorrowerPortal";
import LoanOfficerDashboard from "../components/LoanOfficerDashboard/LoanOfficerDashboard";
import DemoFlow from "../components/DemoFlow/DemoFlow";

export default function Home() {
  const [activeScreen, setActiveScreen] = useState("borrower");

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
      <Header activeScreen={activeScreen} onScreenChange={setActiveScreen} />
      <main className="app-main" style={{ paddingTop: 52 }}>
        <div key={activeScreen} className="screen-content">
          {renderScreen()}
        </div>
      </main>
    </>
  );
}
