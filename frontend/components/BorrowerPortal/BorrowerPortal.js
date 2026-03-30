"use client";

import { useState, useCallback } from 'react';
import ApplicationForm from './ApplicationForm';
import DocumentUpload from './DocumentUpload';
import StatusTracker from './StatusTracker';
import NotificationFeed from './NotificationFeed';
import NotificationToast, { useToasts } from '../NotificationToast/NotificationToast';
import BeforeAfterStat from '../educational/BeforeAfterStat';
import ContextualBanner from '../educational/ContextualBanner';
import { apiPost } from '../../lib/api';

const TOAST_STAGES = new Set([
  'docs', 'action-required', 'credit', 'underwriting',
  'decision', 'approved', 'active',
]);

const STAGE_TOAST_CONFIG = {
  'docs': { type: 'warning', icon: '🧬', title: 'Document Issues Detected', message: 'AI found 2 issues during verification and is resolving them automatically.' },
  'action-required': { type: 'warning', icon: '⚠', title: 'Additional Document Needed', message: 'Please upload your August 2024 bank statement to continue processing.' },
  'action-resolved': { type: 'success', icon: '✅', title: 'Document Received', message: 'Additional bank statement verified. Processing has resumed.' },
  'credit': { type: 'info', icon: '📋', title: 'Credit Discrepancies Found', message: 'AI is investigating 2 discrepancies in your credit and income records.' },
  'underwriting': { type: 'info', icon: '📊', title: 'Score Correction Applied', message: 'AI corrected a misclassified debt payment. Your score improved from 68 to 72.' },
  'decision': { type: 'success', icon: '✅', title: 'Decision Ready', message: 'Underwriting complete with 5 AI interventions. Moving to officer review.' },
  'approved': { type: 'success', icon: '🎉', title: 'Mortgage Approved', message: 'Congratulations! Your mortgage has been approved at 4.89% APR.' },
  'active': { type: 'success', icon: '🏠', title: 'Mortgage Active', message: 'Your mortgage is now active. First payment due May 1, 2026.' },
};

export default function BorrowerPortal() {
  const [phase, setPhase] = useState('apply');
  const [notifications, setNotifications] = useState([]);
  const [applicationId, setApplicationId] = useState(null);
  const { toasts, addToast, removeToast } = useToasts();

  const handleSubmit = useCallback(async (formData) => {
    setPhase('tracking');
    addToast({ type: 'info', icon: '📝', title: 'Application Submitted', message: 'Your application is now being processed by our AI assistant.' });

    // Attempt to submit to real backend (falls back gracefully if unavailable)
    const result = await apiPost('/applications', {
      primary_name: `${formData?.firstName || 'Marcus'} ${formData?.lastName || 'Delgado'}`,
      co_applicant_name: 'Sofia Delgado',
      loan_amount: 700000,
      purchase_price: 875000,
      down_payment: 175000,
      product: '5yr Fixed (25yr Amort)',
      property_address: '4718 Coronation Drive SW, Calgary, AB T3E 4Y2',
      property_type: 'Detached Home',
      combined_income: 222700,
      primary_income: 128500,
      co_applicant_income: 94200,
    });

    if (result?.application_id) {
      setApplicationId(result.application_id);
      // Trigger agent pipeline
      await apiPost(`/agent/${result.application_id}/run`);
    }
  }, [addToast]);

  const handleNotification = useCallback((notification) => {
    setNotifications((prev) => [...prev, notification]);

    // Handle sub-type toasts (intervention and action events from StatusTracker)
    if (notification.subType === 'action-resolved') {
      const config = STAGE_TOAST_CONFIG['action-resolved'];
      if (config) addToast(config);
      return;
    }

    const stageId = notification.stage?.id;
    if (stageId && TOAST_STAGES.has(stageId) && !notification.subType) {
      const config = STAGE_TOAST_CONFIG[stageId];
      if (config) addToast(config);
    }
  }, [addToast]);

  if (phase === 'tracking') {
    return (
      <div style={{ display: 'flex', height: 'calc(100vh - 52px)', background: 'var(--bg-void)' }}>
        <StatusTracker onNotification={handleNotification} applicationId={applicationId} />
        <NotificationFeed notifications={notifications} />
        <NotificationToast toasts={toasts} onDismiss={removeToast} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 52px)', background: 'var(--bg-void)' }}>
      <ContextualBanner id="borrower-speed" icon="⚡">
        Traditional lending takes <strong>45+ days</strong>. LendFlow AI processes applications in <strong>minutes</strong> using MongoDB and multi-agent AI.
      </ContextualBanner>
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
      <ApplicationForm onSubmit={handleSubmit} />
      <DocumentUpload />
      </div>
      <NotificationToast toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
