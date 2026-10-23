"use client";

import { useState, useEffect } from 'react';
import GenUIShimmer from './GenUIShimmer';
import DocumentChecklist from './DocumentChecklist';
import ClosingTimeline from './ClosingTimeline';

const COMPONENT_MAP = {
  document_checklist: DocumentChecklist,
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
