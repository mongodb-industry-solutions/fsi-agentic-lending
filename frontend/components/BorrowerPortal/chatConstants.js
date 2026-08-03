export const API_BASE = '/api/backend';

// --- Category system for suggested questions ---
export const CATEGORY_COLORS = {
  status: 'var(--agent-cyan)',
  documents: 'var(--tool-blue)',
  financial: 'var(--mongo)',
  action: 'var(--hitl-amber)',
};

// --- Unified catalog of generative-UI capabilities (single source of truth) ---
// Each entry drives welcome tiles, capability bar, pre-announcement metadata,
// and the capabilities info panel.
export const COMPONENTS_CATALOG = [
  {
    key: 'affordability_calculator',
    label: 'Calculator',
    longLabel: 'Affordability Calculator',
    color: 'var(--mongo)',
    iconType: 'calculator',
    welcomeSublabel: 'Interactive sliders',
    quickSublabel: 'Interactive tool',
    description: 'Sliders for rate, term, and down payment',
    message: 'Show me an affordability calculator for my application',
    triggerKeywords: ['afford', 'monthly payment', 'calculator'],
    surfaces: ['welcome', 'quickAction', 'preAppWelcome'],
  },
  {
    key: 'document_checklist',
    label: 'Documents',
    longLabel: 'Document Checklist',
    color: 'var(--tool-blue)',
    iconType: 'documents',
    welcomeSublabel: 'Track what\u2019s needed',
    quickSublabel: 'AI checklist',
    description: 'Track required and submitted documents',
    message: 'Show me a checklist of my required documents',
    triggerKeywords: ['document', 'checklist', 'missing'],
    surfaces: ['welcome', 'quickAction', 'preAppWelcome'],
  },
  {
    key: 'rate_comparison',
    label: 'Rates',
    longLabel: 'Rate Comparison',
    color: 'var(--voyage)',
    iconType: 'rates',
    welcomeSublabel: 'Side-by-side rates',
    quickSublabel: 'Compare options',
    description: 'Compare fixed, variable, and hybrid rates',
    message: 'Compare the available rate options for me',
    triggerKeywords: ['rate', 'compare rate', 'interest rate'],
    surfaces: ['welcome', 'quickAction'],
  },
  {
    key: 'payment_schedule',
    label: 'Schedule',
    longLabel: 'Payment Schedule',
    color: 'var(--mongo)',
    iconType: 'schedule',
    welcomeSublabel: 'Amortization view',
    quickSublabel: 'Amortization',
    description: 'Monthly amortization breakdown',
    message: 'Show me my payment schedule and amortization breakdown',
    triggerKeywords: ['amortization', 'schedule', 'payment breakdown'],
    surfaces: ['welcome'],
  },
  {
    key: 'scenario_comparison',
    label: 'Scenarios',
    longLabel: 'Scenario Comparison',
    color: 'var(--mongo)',
    iconType: 'calculator',
    welcomeSublabel: 'What-if tool',
    quickSublabel: 'What-if tool',
    description: 'Compare different down payment amounts',
    message: 'Compare different down payment scenarios',
    triggerKeywords: ['what if i put', 'compare down', 'scenario'],
    surfaces: [],
  },
  {
    key: 'closing_timeline',
    label: 'Closing',
    longLabel: 'Closing Timeline',
    color: 'var(--success)',
    iconType: 'schedule',
    welcomeSublabel: 'Steps to keys',
    quickSublabel: 'Steps to keys',
    description: 'Steps from approval to keys',
    message: 'Show me the closing timeline',
    triggerKeywords: ['closing', 'next steps after approval'],
    surfaces: [],
    minStatus: 'approved',
  },
];

// --- Derived: welcome tiles (shown inside WelcomeCard). ---
// Pre-app (no applicationId) shows only tiles marked 'preAppWelcome'.
export const CAPABILITY_TILES = COMPONENTS_CATALOG
  .filter(c => c.surfaces.includes('welcome'))
  .map(c => ({
    label: c.longLabel,
    sublabel: c.welcomeSublabel,
    color: c.color,
    iconType: c.iconType,
    message: c.message,
  }));

export const PRE_APP_TILES = COMPONENTS_CATALOG
  .filter(c => c.surfaces.includes('preAppWelcome'))
  .map(c => ({
    label: c.longLabel,
    sublabel: c.welcomeSublabel,
    color: c.color,
    iconType: c.iconType,
    message: c.message,
  }));

// --- Derived: capability bar above input. ---
const STATUS_ORDER = ['submitted', 'processing', 'underwriting', 'review', 'approved', 'declined', 'closing'];

const QUICK_ACTION_BASE = COMPONENTS_CATALOG
  .filter(c => c.surfaces.includes('quickAction'))
  .map(c => ({
    label: c.label,
    sublabel: c.quickSublabel,
    color: c.color,
    iconType: c.iconType,
    message: c.message,
    minStatus: c.minStatus,
    key: c.key,
  }));

export const QUICK_ACTIONS = QUICK_ACTION_BASE;

export function getVisibleQuickActions(status) {
  const statusIdx = STATUS_ORDER.indexOf(status);
  return QUICK_ACTION_BASE.filter(qa => {
    if (!qa.minStatus) return true;
    const minIdx = STATUS_ORDER.indexOf(qa.minStatus);
    return statusIdx >= minIdx;
  });
}

// Returns quick actions that are newly visible at `status` but were not at
// `prevStatus`. Used to animate newly-unlocked actions (A5).
export function getNewlyUnlockedActions(prevStatus, status) {
  if (!prevStatus || prevStatus === status) return new Set();
  const prev = new Set(getVisibleQuickActions(prevStatus).map(q => q.key));
  const now = getVisibleQuickActions(status).map(q => q.key);
  return new Set(now.filter(k => !prev.has(k)));
}

// --- Derived: component pre-announcement display metadata ---
export const COMPONENT_DISPLAY_NAMES = Object.fromEntries(
  COMPONENTS_CATALOG.map(c => [c.key, { label: c.longLabel, color: c.color }])
);

// --- Derived: capabilities info panel data ---
export const CAPABILITIES_INFO = COMPONENTS_CATALOG.map(c => ({
  name: c.longLabel,
  description: c.description,
  color: c.color,
  message: c.message,
  key: c.key,
}));

export const DATA_SOURCES = [
  { label: 'Your application', color: 'var(--mongo)', bg: 'var(--mongo-dim)' },
  { label: 'Lending policies', color: 'var(--voyage)', bg: 'var(--voyage-dim)' },
  { label: 'Your documents', color: 'var(--tool-blue)', bg: 'var(--tool-blue-dim)' },
  { label: 'Requirements', color: 'var(--agent-cyan)', bg: 'var(--agent-cyan-dim)' },
  { label: 'Action items', color: 'var(--hitl-amber)', bg: 'var(--hitl-amber-dim)' },
];

// --- Suggested questions (status-aware + intervention-aware) ---
export const STATUS_SUGGESTIONS = {
  submitted: [
    { text: 'What documents were submitted with my application?', category: 'documents' },
    { text: 'How long does the verification process take?', category: 'status' },
  ],
  processing: [
    { text: 'What documents were submitted?', category: 'documents' },
    { text: 'How long will verification take?', category: 'status' },
    { text: 'What happens during document verification?', category: 'status' },
  ],
  underwriting: [
    { text: 'What is the mortgage stress test?', category: 'financial' },
    { text: 'How is my risk score calculated?', category: 'financial' },
    { text: 'What are the GDS and TDS ratios?', category: 'financial' },
  ],
  review: [
    { text: 'What does officer review mean?', category: 'status' },
    { text: 'How long does officer review take?', category: 'status' },
    { text: 'Can I provide additional documents?', category: 'documents' },
  ],
  approved: [
    { text: 'What are the next steps after approval?', category: 'status' },
    { text: 'When is my first payment due?', category: 'financial' },
    { text: 'What was my final interest rate?', category: 'financial' },
  ],
  closing: [
    { text: 'What documents do I need to sign?', category: 'documents' },
    { text: 'How long does closing take?', category: 'status' },
    { text: 'What happens after I sign?', category: 'status' },
  ],
  declined: [
    { text: 'Why was my application declined?', category: 'status' },
    { text: 'Can I reapply with changes?', category: 'action' },
    { text: 'What can I do to improve my application?', category: 'action' },
  ],
  default: [
    { text: 'What is the status of my application?', category: 'status' },
    { text: 'What are the next steps in the process?', category: 'status' },
    { text: 'Explain the mortgage stress test', category: 'financial' },
  ],
};

const INTERVENTION_QUESTIONS = {
  missing_document: { text: 'What documents am I missing?', category: 'documents' },
  document_processing_error: { text: 'Why couldn\u2019t my document be processed?', category: 'documents' },
  stress_test_failure: { text: 'What is the stress test and how can I pass it?', category: 'financial' },
  credit_data_unavailable: { text: 'Why couldn\u2019t my credit data be retrieved?', category: 'action' },
  credit_score_required: { text: 'How is my credit score used in the application?', category: 'financial' },
  income_data_required: { text: 'How do I verify my income?', category: 'action' },
  additional_info_required: { text: 'Why does my application need officer review?', category: 'status' },
};

export function getContextualSuggestions(status, localInterventions, messageCount = 0) {
  const base = STATUS_SUGGESTIONS[status] || STATUS_SUGGESTIONS.default;
  const contextual = [];

  const pending = (localInterventions || []).filter(i => !i._resolved);
  if (pending.length > 0) {
    for (const intv of pending) {
      const q = INTERVENTION_QUESTIONS[intv.type];
      if (q && !contextual.find(c => c.text === q.text)) {
        contextual.push(q);
        if (contextual.length >= 2) break;
      }
    }
    if (contextual.length === 0) {
      contextual.push({ text: 'What action do I need to take?', category: 'action' });
    }
  }

  if (status === 'approved') {
    contextual.push({ text: 'How much did the AI save me?', category: 'financial' });
  } else if (status === 'declined') {
    contextual.push({ text: 'What can I improve for a re-application?', category: 'action' });
  }

  const combined = [...contextual, ...base];
  const seen = new Set();
  const unique = combined.filter(q => {
    if (seen.has(q.text)) return false;
    seen.add(q.text);
    return true;
  });

  // Progressive decay (B5: explicit zero handling — treat as fresh start).
  const count = Number.isFinite(messageCount) ? Math.max(0, messageCount) : 0;
  let maxCount = 3;
  if (count > 5) maxCount = 1;
  else if (count > 2) maxCount = 2;

  // Intervention questions always survive decay
  const interventionTexts = new Set(contextual.map(c => c.text));
  const interventionItems = unique.filter(q => interventionTexts.has(q.text));
  const otherItems = unique.filter(q => !interventionTexts.has(q.text));
  const result = [...interventionItems, ...otherItems].slice(0, Math.max(maxCount, interventionItems.length));

  return result;
}

// E2: Typing-ahead suggestions. Match `input` prefix/substring against the
// pool of status + intervention + default questions. Case-insensitive, min 2
// chars, returns up to 3 matches. Pure function — safe to call every keystroke.
export function getTypeAheadSuggestions(input, status, localInterventions) {
  const q = (input || '').trim().toLowerCase();
  if (q.length < 2) return [];

  const pool = new Map();
  const add = (item) => {
    if (item && !pool.has(item.text)) pool.set(item.text, item);
  };

  (STATUS_SUGGESTIONS[status] || []).forEach(add);
  STATUS_SUGGESTIONS.default.forEach(add);
  (localInterventions || []).filter(i => !i._resolved).forEach(i => {
    const iq = INTERVENTION_QUESTIONS[i.type];
    if (iq) add(iq);
  });
  // UX 3: every catalog entry is a valid user ask the backend can render,
  // including scenario_comparison and closing_timeline which aren't on the
  // welcome tiles or capability bar. Include them all in the type-ahead pool.
  COMPONENTS_CATALOG.forEach(c => {
    add({ text: c.message, category: 'financial' });
  });

  // Review #6: iterate the full pool (bounded ~30 items) before sorting so
  // a starts-with match at the end of the pool isn't lost behind 10 earlier
  // contains-matches.
  const matches = [];
  for (const item of pool.values()) {
    const t = item.text.toLowerCase();
    const startsWith = t.startsWith(q);
    const contains = t.includes(q);
    if (startsWith) matches.push({ ...item, _rank: 0 });
    else if (contains) matches.push({ ...item, _rank: 1 });
  }
  matches.sort((a, b) => a._rank - b._rank);
  return matches.slice(0, 3).map(({ _rank, ...rest }) => rest);
}

// E6: Detect when the LLM's last response discussed a component-worthy topic
// but no UI component was attached. Returns a single suggestion pill or null.
export function getProactiveComponentSuggestion(lastMessage, status) {
  if (!lastMessage || lastMessage.role !== 'assistant') return null;
  if (lastMessage.uiComponents && lastMessage.uiComponents.length > 0) return null;
  const content = (lastMessage.content || '').toLowerCase();
  if (content.length < 30) return null;

  const statusIdx = STATUS_ORDER.indexOf(status);
  for (const comp of COMPONENTS_CATALOG) {
    if (comp.minStatus) {
      const minIdx = STATUS_ORDER.indexOf(comp.minStatus);
      if (statusIdx < minIdx) continue;
    }
    if (comp.triggerKeywords.some(kw => content.includes(kw))) {
      return {
        // UX 6: tighter, more action-oriented copy \u2014 the "Try" badge
        // on the proactive pill already conveys the suggestion framing.
        text: `Show the ${comp.longLabel}`,
        category: 'financial',
        message: comp.message,
        _proactive: true,
        _color: comp.color,
      };
    }
  }
  return null;
}

// --- Dynamic input placeholder ---
export function getPlaceholder(status, interventions) {
  if (interventions?.some(i => !i._resolved)) return 'Ask about your pending action items...';
  if (status === 'approved') return 'Ask about next steps or closing...';
  if (status === 'underwriting') return 'Ask about your risk assessment...';
  if (status === 'review') return 'Ask about the review process...';
  return 'Ask about your application...';
}

export function createWelcomeMessage() {
  return {
    role: 'assistant',
    content: 'I can help with your mortgage journey \u2014 from document prep to closing.',
    timestamp: new Date().toISOString(),
    isWelcome: true,
  };
}
