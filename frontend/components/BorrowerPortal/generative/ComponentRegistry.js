"use client";

import { useState, useEffect } from 'react';
import GenUIShimmer from './GenUIShimmer';
import AffordabilityCalculator from './AffordabilityCalculator';
import DocumentChecklist from './DocumentChecklist';
import ApplicationStrength from './ApplicationStrength';
import RateComparison from './RateComparison';
import PaymentSchedule from './PaymentSchedule';
import ScenarioComparison from './ScenarioComparison';
import ClosingTimeline from './ClosingTimeline';

const COMPONENT_MAP = {
  affordability_calculator: AffordabilityCalculator,
  document_checklist: DocumentChecklist,
  application_strength: ApplicationStrength,
  rate_comparison: RateComparison,
  payment_schedule: PaymentSchedule,
  scenario_comparison: ScenarioComparison,
  closing_timeline: ClosingTimeline,
};

export default function GenerativeComponent({ component, data, id, status }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (status === 'loading' || !mounted) {
    return <GenUIShimmer />;
  }

  const Component = COMPONENT_MAP[component];
  if (!Component) return null;

  return (
    <div style={{
      margin: '8px 0',
      animation: 'genUISlideIn 0.35s cubic-bezier(0.33, 1, 0.68, 1) both',
    }}>
      <Component data={data} id={id} />
    </div>
  );
}
