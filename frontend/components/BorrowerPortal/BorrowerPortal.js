"use client";

import { useState, useCallback } from 'react';
import ApplicationForm from './ApplicationForm';
import DocumentUpload from './DocumentUpload';
import StatusTracker from './StatusTracker';
import NotificationFeed from './NotificationFeed';
import NotificationToast, { useToasts } from '../NotificationToast/NotificationToast';

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
  'approved': { type: 'success', icon: '🎉', title: 'Loan Approved', message: 'Congratulations! Your loan has been approved at 6.875% APR.' },
  'active': { type: 'success', icon: '🏠', title: 'Loan Active', message: 'Your loan is now active. First payment due March 1, 2025.' },
};

export default function BorrowerPortal() {
  const [phase, setPhase] = useState('apply');
  const [notifications, setNotifications] = useState([]);
  const { toasts, addToast, removeToast } = useToasts();

  const handleSubmit = useCallback(() => {
    setPhase('tracking');
    addToast({ type: 'info', icon: '📝', title: 'Application Submitted', message: 'Your application is now being processed by our AI assistant.' });
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
        <StatusTracker onNotification={handleNotification} />
        <NotificationFeed notifications={notifications} />
        <NotificationToast toasts={toasts} onDismiss={removeToast} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 52px)', background: 'var(--bg-void)' }}>
      <ApplicationForm onSubmit={handleSubmit} />
      <DocumentUpload />
      <NotificationToast toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
