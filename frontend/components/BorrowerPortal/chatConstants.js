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

export function getContextualSuggestions(status, localInterventions) {
  const base = STATUS_SUGGESTIONS[status] || STATUS_SUGGESTIONS.default;
  const contextual = [];

  const pending = (localInterventions || []).filter(i => !i._resolved);
  if (pending.length > 0) {
    const types = pending.map(i => i.type?.replace(/_/g, ' ')).filter(Boolean);
    if (types.length > 0) {
      contextual.push(`Why was my ${types[0]} flagged?`);
    }
    contextual.push('What action do I need to take?');
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

export function createWelcomeMessage() {
  return {
    role: 'assistant',
    content: 'Welcome! I\'m your LendFlow application assistant. I can help you with document requirements, lending policies, and track your application progress. What would you like to know?',
    timestamp: new Date().toISOString(),
  };
}
