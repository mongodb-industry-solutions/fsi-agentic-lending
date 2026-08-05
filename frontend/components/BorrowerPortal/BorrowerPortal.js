'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import BorrowerSelection from './BorrowerSelection';
import ApplicationForm from './ApplicationForm';
import DocumentUpload from './DocumentUpload';
import StatusTracker from './StatusTracker';
import DocumentContext from './DocumentContext';
import ApplicationAgent from './ApplicationAgent';
import NotificationToast, {
  useToasts,
} from '../NotificationToast/NotificationToast';
import ContextualBanner from '../educational/ContextualBanner';
import { apiPost, apiGet, apiSSE } from '../../lib/api';

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
  { label: 'Submitting for review...', done: 'Submitted for review' },
];

function FloatingChatDrawer({ open, onToggle }) {
  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        aria-label={open ? 'Close chat' : 'Ask your Lending Assistant'}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 400,
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: open ? 'var(--text-dim)' : 'var(--mongo)',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: 'var(--shadow-lg)',
          fontSize: 20,
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          transition: 'background 200ms ease, transform 100ms ease',
        }}
      >
        {open ? '\u2715' : '\uD83D\uDCAC'}
      </button>
      {open && (
        <div
          style={{
            position: 'fixed',
            bottom: 84,
            right: 24,
            zIndex: 400,
            width: 360,
            height: 460,
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-dim)',
            boxShadow: 'var(--shadow-xl)',
            overflow: 'hidden',
            animation:
              'cardEnter 0.25s cubic-bezier(0.33, 1, 0.68, 1) both',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--bg-base)',
          }}
        >
          <ApplicationAgent
            applicationId={null}
            applicationStatus={null}
          />
        </div>
      )}
    </>
  );
}

function SubmittingOverlay({ currentStep, applicationId }) {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 500,
        background: 'var(--bg-backdrop, rgba(241, 245, 249, 0.9))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'backdropEnter 0.25s ease-out both',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 440,
          background: 'var(--bg-base)',
          borderRadius: 8,
          border: '1px solid var(--border-dim)',
          boxShadow: 'var(--shadow-xl, 0 20px 25px rgba(0,0,0,0.08))',
          padding: 32,
          animation:
            'modalEnter 0.3s cubic-bezier(0.33, 1, 0.68, 1) both',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 18,
            color: 'var(--text-primary)',
            marginBottom: 4,
          }}
        >
          Submitting Application
        </div>
        {applicationId && (
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--text-dim)',
              marginBottom: 20,
            }}
          >
            {applicationId}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {SUBMIT_STEPS.map((step, idx) => {
            const isDone = idx < currentStep;
            const isActive = idx === currentStep;
            const isFuture = idx > currentStep;

            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  animation: `cardEnter 0.3s cubic-bezier(0.4, 0, 0.2, 1) ${idx * 0.1}s both`,
                }}
              >
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    background: isDone
                      ? 'var(--mongo)'
                      : isActive
                        ? 'transparent'
                        : 'transparent',
                    border: isDone
                      ? 'none'
                      : isActive
                        ? '2.5px solid var(--mongo)'
                        : '1.5px solid var(--border-dim)',
                    transition:
                      'all 300ms cubic-bezier(0.33, 1, 0.68, 1)',
                  }}
                >
                  {isDone && (
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="none"
                    >
                      <path
                        d="M2.5 6L5 8.5L9.5 3.5"
                        stroke="#FFFFFF"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                  {isActive && (
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        border: '2px solid var(--mongo)',
                        borderTopColor: 'transparent',
                        animation: 'spin 0.8s linear infinite',
                      }}
                    />
                  )}
                </div>
                <div
                  style={{
                    fontSize: 14,
                    fontFamily: 'var(--font-display)',
                    fontWeight: isActive ? 600 : 400,
                    color: isFuture
                      ? 'var(--text-dim)'
                      : 'var(--text-primary)',
                    transition: 'color 200ms ease',
                  }}
                >
                  {isDone ? step.done : step.label}
                </div>
                {isDone && (
                  <div
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--success)',
                      marginLeft: 'auto',
                    }}
                  >
                    DONE
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function BorrowerPortal() {
  const [phase, setPhase] = useState('select');
  const [borrowerProfile, setBorrowerProfile] = useState(null);
  const [applicationId, setApplicationId] = useState(null);
  const { toasts, addToast, removeToast } = useToasts();
  const [demoSessionId, setDemoSessionId] = useState('');
  const [submitStep, setSubmitStep] = useState(0);
  const [applicationStatus, setApplicationStatus] =
    useState('submitted');
  const [chatOpen, setChatOpen] = useState(false);
  const [submittedApps, setSubmittedApps] = useState({});
  const statusSourceRef = useRef(null);

  // Restore session state after hydration (avoids SSR/client mismatch)
  useEffect(() => {
    setDemoSessionId(getDemoSessionId());
    const savedPhase = sessionStorage.getItem('lendflow_phase');
    const savedAppId = sessionStorage.getItem('lendflow_app_id');
    const savedBorrower = sessionStorage.getItem('lendflow_borrower');
    if (savedPhase === 'tracking' && savedAppId) {
      setApplicationId(savedAppId);
      if (savedBorrower) {
        try { setBorrowerProfile(JSON.parse(savedBorrower)); } catch { /* ignore */ }
      }
      setPhase('tracking');
    }
    const savedApps = sessionStorage.getItem('lendflow_submitted_apps');
    if (savedApps) {
      try { setSubmittedApps(JSON.parse(savedApps)); } catch { /* ignore */ }
    }
  }, []);

  // Trigger immediate DocumentContext refresh after InterventionCard uploads
  const [docRefreshTrigger, setDocRefreshTrigger] = useState(0);

  // Persist key state to sessionStorage for page refresh resilience
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (phase === 'tracking' && applicationId) {
      sessionStorage.setItem('lendflow_phase', 'tracking');
      sessionStorage.setItem('lendflow_app_id', applicationId);
      if (borrowerProfile) sessionStorage.setItem('lendflow_borrower', JSON.stringify(borrowerProfile));
    } else if (phase === 'select') {
      sessionStorage.removeItem('lendflow_phase');
      sessionStorage.removeItem('lendflow_app_id');
      sessionStorage.removeItem('lendflow_borrower');
    }
  }, [phase, applicationId, borrowerProfile]);

  // Persist submittedApps to sessionStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (Object.keys(submittedApps).length > 0) {
      sessionStorage.setItem('lendflow_submitted_apps', JSON.stringify(submittedApps));
    } else {
      sessionStorage.removeItem('lendflow_submitted_apps');
    }
  }, [submittedApps]);

  // Sync current applicationStatus back into submittedApps map
  useEffect(() => {
    if (!borrowerProfile?.id || !applicationId) return;
    setSubmittedApps(prev => {
      const entry = prev[borrowerProfile.id];
      if (!entry || entry.applicationId !== applicationId || entry.lastKnownStatus === applicationStatus) return prev;
      return { ...prev, [borrowerProfile.id]: { ...entry, lastKnownStatus: applicationStatus } };
    });
  }, [applicationStatus, borrowerProfile, applicationId]);

  useEffect(() => {
    if (!applicationId) return;
    let sseAlive = false;
    let pollInterval = null;

    const source = apiSSE(
      `/applications/${applicationId}/status`,
      (data) => {
        sseAlive = true;
        if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
        if (data.status) setApplicationStatus(data.status);
      },
      () => {},
    );
    statusSourceRef.current = source;

    apiGet(`/applications/${applicationId}`).then((app) => {
      if (app?.status) setApplicationStatus(app.status);
    }).catch(() => {});

    pollInterval = setInterval(() => {
      if (sseAlive) { clearInterval(pollInterval); pollInterval = null; return; }
      apiGet(`/applications/${applicationId}`).then((app) => {
        if (app?.status) setApplicationStatus(app.status);
      }).catch(() => {});
    }, 5000);

    return () => {
      if (statusSourceRef.current) statusSourceRef.current.close();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [applicationId]);

  const handleResumeTracking = useCallback((profileId) => {
    const entry = submittedApps[profileId];
    if (!entry) return;
    setBorrowerProfile(entry.borrowerProfile);
    setApplicationId(entry.applicationId);
    setApplicationStatus(entry.lastKnownStatus || 'submitted');
    setPhase('tracking');
  }, [submittedApps]);

  const handleBorrowerSelect = useCallback((profile) => {
    if (submittedApps[profile.id]) {
      handleResumeTracking(profile.id);
    } else {
      setBorrowerProfile(profile);
      setPhase('apply');
    }
  }, [submittedApps, handleResumeTracking]);

  const handleBackToSelect = useCallback(() => {
    setBorrowerProfile(null);
    setApplicationId(null);
    setPhase('select');
  }, []);

  const handleChangeBorrower = useCallback(() => {
    // Close SSE synchronously before nulling applicationId to prevent late-fire status corruption
    if (statusSourceRef.current) {
      statusSourceRef.current.close();
      statusSourceRef.current = null;
    }
    setApplicationStatus('submitted');
    setApplicationId(null);
    setBorrowerProfile(null);
    setPhase('select');
  }, []);

  const handleSubmit = useCallback(
    async (formData) => {
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
        property_address:
          formData.propertyAddress || formData.address || '',
        property_type: formData.propertyType || 'Detached Home',
        combined_income: primaryIncome + coIncome,
        primary_income: primaryIncome,
        co_applicant_income: coIncome,
        annual_property_tax:
          parseFloat(formData.annualPropertyTax) || 0,
        existing_monthly_debt:
          parseFloat(formData.existingDebt) || 0,
        profile_id: borrowerProfile?.id || null,
        demo_session_id: demoSessionId || null,
      });

      if (!result) {
        addToast({
          type: 'error',
          title: 'Submission Failed',
          message: 'Could not connect to backend.',
        });
        setPhase('apply');
        return;
      }

      if (result.application_id) {
        setApplicationId(result.application_id);
        setSubmitStep(1);

        await new Promise((r) => setTimeout(r, 700));
        setSubmitStep(2);

        apiPost(
          `/agent/${result.application_id}/run?autonomy_level=bounded`,
        )
          .then((r) => {
            if (!r)
              addToast({
                type: 'warning',
                title: 'Agent Launch',
                message:
                  'Agent run may not have started. Check status.',
              });
          })
          .catch(() =>
            addToast({
              type: 'warning',
              title: 'Agent Launch',
              message:
                'Agent run may not have started. Check status.',
            }),
          );

        await new Promise((r) => setTimeout(r, 800));
        setSubmitStep(3);

        await new Promise((r) => setTimeout(r, 600));
        if (borrowerProfile?.id) {
          setSubmittedApps(prev => ({
            ...prev,
            [borrowerProfile.id]: { applicationId: result.application_id, borrowerProfile, lastKnownStatus: 'submitted' },
          }));
        }
        addToast({
          type: 'info',
          title: 'Application Submitted',
          message: 'Your application is now being processed.',
        });
        setPhase('tracking');
      } else {
        addToast({
          type: 'error',
          title: 'Submission Failed',
          message: 'No application ID returned.',
        });
        setPhase('apply');
      }
    },
    [addToast, borrowerProfile, demoSessionId],
  );

  if (phase === 'select') {
    return (
      <>
        <BorrowerSelection onSelect={handleBorrowerSelect} submittedApps={submittedApps} />
        <NotificationToast toasts={toasts} onDismiss={removeToast} />
      </>
    );
  }

  if (phase === 'submitting') {
    return (
      <>
        <SubmittingOverlay
          currentStep={submitStep}
          applicationId={applicationId}
        />
        <NotificationToast toasts={toasts} onDismiss={removeToast} />
      </>
    );
  }

  if (phase === 'tracking') {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: 'calc(100vh - 52px)',
          background: 'var(--bg-void)',
        }}
      >
        {/* Navigation bar */}
        <div style={{
          display: 'flex', alignItems: 'center',
          padding: '6px 16px',
          borderBottom: '1px solid var(--border-dim)',
          background: 'var(--bg-surface)', flexShrink: 0,
        }}>
          <button
            type="button"
            onClick={handleChangeBorrower}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 11, fontFamily: 'var(--font-display)', fontWeight: 600,
              color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 4,
              padding: '2px 0',
            }}
          >
            {'\u2190'} Select Another Borrower
          </button>
          {Object.keys(submittedApps).length > 1 && (
            <span style={{
              marginLeft: 8, padding: '1px 6px', borderRadius: 8,
              background: 'var(--mongo-dim)', color: 'var(--mongo)',
              fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-mono)',
            }}>
              {Object.keys(submittedApps).length} apps tracked
            </span>
          )}
        </div>

        {/* Upper zone: existing 3-column layout */}
        <div style={{ flex: 1, display: 'flex', minHeight: 280, overflow: 'hidden' }}>
          <DocumentContext applicationId={applicationId} refreshTrigger={docRefreshTrigger} />
          <StatusTracker
            applicationId={applicationId}
            applicationData={borrowerProfile}
            onOpenChat={() => setChatOpen(true)}
          />
          <ApplicationAgent
            applicationId={applicationId}
            applicationStatus={applicationStatus}
            borrowerProfile={borrowerProfile}
            onDocumentUploaded={() => setDocRefreshTrigger(p => p + 1)}
          />
        </div>

        <NotificationToast toasts={toasts} onDismiss={removeToast} />
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 52px)',
        background: 'var(--bg-void)',
      }}
    >
      <ContextualBanner id="borrower-speed">
        Traditional lending takes <strong>45+ days</strong>. Agentic
        Lending Platform processes applications in{' '}
        <strong>minutes</strong> using MongoDB and multi-agent AI.
      </ContextualBanner>
      <div style={{ padding: '0 64px', paddingTop: 8 }}>
        <button
          type="button"
          onClick={handleBackToSelect}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 600,
            color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 0',
          }}
        >
          {'\u2190'} Change Borrower
        </button>
      </div>
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <ApplicationForm
          onSubmit={handleSubmit}
          borrowerProfile={borrowerProfile}
        />
        <DocumentUpload
          applicationId={applicationId}
          borrowerProfile={borrowerProfile}
        />
      </div>
      <NotificationToast toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
