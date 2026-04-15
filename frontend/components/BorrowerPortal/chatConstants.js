export const API_BASE = '/api/backend';

export const STATUS_SUGGESTIONS = {
  submitted: [
    'What documents were submitted with my application?',
    'How long does the verification process take?',
  ],
  processing: [
    'What documents were submitted?',
    'How long will verification take?',
    'What happens during document verification?',
  ],
  underwriting: [
    'What is the mortgage stress test?',
    'How is my risk score calculated?',
    'What are the GDS and TDS ratios?',
  ],
  review: [
    'What does officer review mean?',
    'How long does officer review take?',
    'Can I provide additional documents?',
  ],
  approved: [
    'What are the next steps after approval?',
    'When is my first payment due?',
    'What was my final interest rate?',
  ],
  closing: [
    'What documents do I need to sign?',
    'How long does closing take?',
    'What happens after I sign?',
  ],
  declined: [
    'Why was my application declined?',
    'Can I reapply with changes?',
    'What can I do to improve my application?',
  ],
  default: [
    'What is the status of my application?',
    'What are the next steps in the process?',
    'Explain the mortgage stress test',
  ],
};

const INTERVENTION_QUESTIONS = {
  missing_document: 'What documents am I missing?',
  document_processing_error: 'Why couldn\'t my document be processed?',
  stress_test_failure: 'What is the stress test and how can I pass it?',
  credit_data_unavailable: 'Why couldn\'t my credit data be retrieved?',
  credit_score_required: 'How is my credit score used in the application?',
  income_data_required: 'How do I verify my income?',
  additional_info_required: 'Why does my application need officer review?',
};

export function getContextualSuggestions(status, localInterventions) {
  const base = STATUS_SUGGESTIONS[status] || STATUS_SUGGESTIONS.default;
  const contextual = [];

  const pending = (localInterventions || []).filter(i => !i._resolved);
  if (pending.length > 0) {
    for (const intv of pending) {
      const q = INTERVENTION_QUESTIONS[intv.type];
      if (q && !contextual.includes(q)) {
        contextual.push(q);
        if (contextual.length >= 2) break;
      }
    }
    if (contextual.length === 0) {
      contextual.push('What action do I need to take?');
    }
  }

  if (status === 'approved') {
    contextual.push('How much did the AI save me?');
  } else if (status === 'declined') {
    contextual.push('What can I improve for a re-application?');
  }

  const combined = [...contextual, ...base];
  const unique = [...new Set(combined)];
  return unique.slice(0, 4);
}

// Quick action pills shown above the chat input. Each can optionally specify
// a minStatus — the action is hidden until the application reaches that stage.
export const QUICK_ACTIONS = [
  { label: 'Calculator', icon: '\uD83D\uDCCA', message: 'Show me an affordability calculator for my application' },
  { label: 'Documents', icon: '\uD83D\uDCCB', message: 'Show me a checklist of my required documents' },
  { label: 'My Application', icon: '\uD83D\uDCDD', message: 'How strong is my application looking?', minStatus: 'underwriting' },
  { label: 'Rates', icon: '\uD83D\uDCC8', message: 'Compare the available rate options for me' },
];

const STATUS_ORDER = ['submitted', 'processing', 'underwriting', 'review', 'approved', 'declined', 'closing'];

export function getVisibleQuickActions(status) {
  const statusIdx = STATUS_ORDER.indexOf(status);
  return QUICK_ACTIONS.filter(qa => {
    if (!qa.minStatus) return true;
    const minIdx = STATUS_ORDER.indexOf(qa.minStatus);
    return statusIdx >= minIdx;
  });
}

export function createWelcomeMessage() {
  return {
    role: 'assistant',
    content: 'Welcome! I\'m your Personal Lending Assistant. I can help you with document requirements, lending policies, and track your application progress. What would you like to know?',
    timestamp: new Date().toISOString(),
  };
}
