"use client";

import { useState, useCallback, useEffect } from 'react';
import BorrowerSelection from './BorrowerSelection';
import ApplicationForm from './ApplicationForm';
import DocumentUpload from './DocumentUpload';
import StatusPane from './StatusPane';
import DocumentContext from './DocumentContext';
import ApplicationAgent from './ApplicationAgent';
import NotificationToast, { useToasts } from '../NotificationToast/NotificationToast';
import ContextualBanner from '../educational/ContextualBanner';
import { apiPost } from '../../lib/api';

function getDemoSessionId() {
  if (typeof window === 'undefined') return '';
  let sid = sessionStorage.getItem('lendflow_demo_session');
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem('lendflow_demo_session', sid);
  }
  return sid;
}

export default function BorrowerPortal() {
  const [phase, setPhase] = useState('select');
  const [borrowerProfile, setBorrowerProfile] = useState(null);
  const [applicationId, setApplicationId] = useState(null);
  const { toasts, addToast, removeToast } = useToasts();
  const [demoSessionId, setDemoSessionId] = useState('');

  useEffect(() => {
    setDemoSessionId(getDemoSessionId());
  }, []);

  const handleBorrowerSelect = useCallback((profile) => {
    setBorrowerProfile(profile);
    setPhase('apply');
  }, []);

  const handleSubmit = useCallback(async (formData) => {
    addToast({ type: 'info', title: 'Application Submitted', message: 'Your application is now being processed.' });

    const purchasePrice = parseFloat(formData.loanAmount) || 0;
    const downPayment = parseFloat(formData.downPayment) || 0;
    const primaryIncome = parseFloat(formData.annualIncome) || 0;
    const coIncome = parseFloat(formData.coApplicantIncome) || 0;

    const result = await apiPost('/applications', {
      primary_name: `${formData.firstName} ${formData.lastName}`,
      co_applicant_name: formData.coApplicantName || null,
      loan_amount: purchasePrice - downPayment,
      purchase_price: purchasePrice,
      down_payment: downPayment,
      product: formData.productType || '5yr Fixed (25yr Amort)',
      property_address: formData.propertyAddress || formData.address || '',
      property_type: formData.propertyType || 'Detached Home',
      combined_income: primaryIncome + coIncome,
      primary_income: primaryIncome,
      co_applicant_income: coIncome,
      annual_property_tax: parseFloat(formData.annualPropertyTax) || 0,
      profile_id: borrowerProfile?.id || null,
      demo_session_id: demoSessionId || null,
    });

    if (!result) {
      addToast({ type: 'error', title: 'Submission Failed', message: 'Could not connect to backend.' });
      return;
    }

    if (result.application_id) {
      setApplicationId(result.application_id);
      setPhase('tracking');
      await apiPost(`/agent/${result.application_id}/run?autonomy_level=bounded`);
    }
  }, [addToast, borrowerProfile, demoSessionId]);

  if (phase === 'select') {
    return (
      <>
        <BorrowerSelection onSelect={handleBorrowerSelect} />
        <NotificationToast toasts={toasts} onDismiss={removeToast} />
      </>
    );
  }

  if (phase === 'tracking') {
    return (
      <div style={{ display: 'flex', height: 'calc(100vh - 52px)', background: 'var(--bg-void)' }}>
        <StatusPane applicationId={applicationId} applicationData={borrowerProfile} />
        <DocumentContext applicationId={applicationId} />
        <ApplicationAgent applicationId={applicationId} />
        <NotificationToast toasts={toasts} onDismiss={removeToast} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 52px)', background: 'var(--bg-void)' }}>
      <ContextualBanner id="borrower-speed">
        Traditional lending takes <strong>45+ days</strong>. LendFlow AI processes applications in <strong>minutes</strong> using MongoDB and multi-agent AI.
      </ContextualBanner>
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <ApplicationForm onSubmit={handleSubmit} borrowerProfile={borrowerProfile} />
        <DocumentUpload applicationId={applicationId} borrowerProfile={borrowerProfile} />
      </div>
      <NotificationToast toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
