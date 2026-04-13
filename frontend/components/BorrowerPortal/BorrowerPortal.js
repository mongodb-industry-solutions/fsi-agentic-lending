"use client";

import { useState, useCallback, useEffect, useRef } from 'react';
import BorrowerSelection from './BorrowerSelection';
import ApplicationForm from './ApplicationForm';
import DocumentUpload from './DocumentUpload';
import StatusTracker from './StatusTracker';
import DocumentContext from './DocumentContext';
import ApplicationAgent from './ApplicationAgent';
import NotificationToast, { useToasts } from '../NotificationToast/NotificationToast';
import ContextualBanner from '../educational/ContextualBanner';
import { apiPost, apiSSE } from '../../lib/api';

function getDemoSessionId() {
  if (typeof window === 'undefined') return '';
  let sid = sessionStorage.getItem('lendflow_demo_session');
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem('lendflow_demo_session', sid);
  }
  return sid;
}

const SUBMIT_STEPS = [
  { label: 'Creating application...', done: 'Application created' },
  { label: 'Attaching documents...', done: 'Documents attached' },
  { label: 'Launching AI agents...', done: 'AI agents running' },
];

function SubmittingOverlay({ currentStep, applicationId }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: 'var(--bg-backdrop, rgba(241, 245, 249, 0.9))',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      animation: 'backdropEnter 0.25s ease-out both',
    }}>
      <div style={{
        width: '100%', maxWidth: 440,
        background: 'var(--bg-base)', borderRadius: 8,
        border: '1px solid var(--border-dim)',
        boxShadow: 'var(--shadow-xl, 0 20px 25px rgba(0,0,0,0.08))',
        padding: 32,
        animation: 'modalEnter 0.3s cubic-bezier(0.33, 1, 0.68, 1) both',
      }}>
        <div style={{
          fontFamily: 'var(--font-display)', fontWeight: 800,
          fontSize: 18, color: 'var(--text-primary)', marginBottom: 4,
        }}>
          Submitting Application
        </div>
        {applicationId && (
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 11,
            color: 'var(--text-dim)', marginBottom: 20,
          }}>
            {applicationId}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {SUBMIT_STEPS.map((step, idx) => {
            const isDone = idx < currentStep;
            const isActive = idx === currentStep;
            const isFuture = idx > currentStep;

            return (
              <div key={idx} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                animation: `cardEnter 0.3s cubic-bezier(0.4, 0, 0.2, 1) ${idx * 0.1}s both`,
              }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                  background: isDone ? 'var(--mongo)' : isActive ? 'transparent' : 'transparent',
                  border: isDone ? 'none' : isActive ? '2.5px solid var(--mongo)' : '1.5px solid var(--border-dim)',
                  transition: 'all 300ms cubic-bezier(0.33, 1, 0.68, 1)',
                }}>
                  {isDone && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2.5 6L5 8.5L9.5 3.5" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                  {isActive && (
                    <div style={{
                      width: 10, height: 10, borderRadius: '50%',
                      border: '2px solid var(--mongo)',
                      borderTopColor: 'transparent',
                      animation: 'spin 0.8s linear infinite',
                    }} />
                  )}
                </div>
                <div style={{
                  fontSize: 14,
                  fontFamily: 'var(--font-display)',
                  fontWeight: isActive ? 600 : 400,
                  color: isFuture ? 'var(--text-dim)' : 'var(--text-primary)',
                  transition: 'color 200ms ease',
                }}>
                  {isDone ? step.done : step.label}
                </div>
                {isDone && (
                  <div style={{
                    fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-mono)',
                    color: 'var(--success)', marginLeft: 'auto',
                  }}>
                    DONE
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function BorrowerPortal() {
  const [phase, setPhase] = useState('select');
  const [borrowerProfile, setBorrowerProfile] = useState(null);
  const [applicationId, setApplicationId] = useState(null);
  const { toasts, addToast, removeToast } = useToasts();
  const [demoSessionId, setDemoSessionId] = useState('');
  const [submitStep, setSubmitStep] = useState(0);
  const [applicationStatus, setApplicationStatus] = useState('submitted');
  const statusSourceRef = useRef(null);

  useEffect(() => {
    setDemoSessionId(getDemoSessionId());
  }, []);

  useEffect(() => {
    if (!applicationId) return;
    const source = apiSSE(
      `/applications/${applicationId}/status`,
      (data) => { if (data.status) setApplicationStatus(data.status); },
      () => {}
    );
    statusSourceRef.current = source;
    return () => { if (statusSourceRef.current) statusSourceRef.current.close(); };
  }, [applicationId]);

  const handleBorrowerSelect = useCallback((profile) => {
    setBorrowerProfile(profile);
    setPhase('apply');
  }, []);

  const handleSubmit = useCallback(async (formData) => {
    setPhase('submitting');
    setSubmitStep(0);

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
      setPhase('apply');
      return;
    }

    if (result.application_id) {
      setApplicationId(result.application_id);
      setSubmitStep(1);

      await new Promise(r => setTimeout(r, 700));
      setSubmitStep(2);

      apiPost(`/agent/${result.application_id}/run?autonomy_level=bounded`)
        .then(r => { if (!r) addToast({ type: 'warning', title: 'Agent Launch', message: 'Agent run may not have started. Check status.' }); })
        .catch(() => addToast({ type: 'warning', title: 'Agent Launch', message: 'Agent run may not have started. Check status.' }));

      await new Promise(r => setTimeout(r, 800));
      setSubmitStep(3);

      await new Promise(r => setTimeout(r, 600));
      addToast({ type: 'info', title: 'Application Submitted', message: 'Your application is now being processed.' });
      setPhase('tracking');
    } else {
      addToast({ type: 'error', title: 'Submission Failed', message: 'No application ID returned.' });
      setPhase('apply');
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

  if (phase === 'submitting') {
    return (
      <>
        <SubmittingOverlay currentStep={submitStep} applicationId={applicationId} />
        <NotificationToast toasts={toasts} onDismiss={removeToast} />
      </>
    );
  }

  if (phase === 'tracking') {
    return (
      <div style={{ display: 'flex', height: 'calc(100vh - 52px)', background: 'var(--bg-void)' }}>
        <StatusTracker applicationId={applicationId} applicationData={borrowerProfile} />
        <DocumentContext applicationId={applicationId} />
        <ApplicationAgent applicationId={applicationId} applicationStatus={applicationStatus} />
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
