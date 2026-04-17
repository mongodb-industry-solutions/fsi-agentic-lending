export const WORKFLOW_STAGES = [
  {
    label: 'Origination',
    currentScene: 'origination',
    activeNodes: ['supervisor', 'docVerifier', 'creditPuller', 'appAgent', 'voyageEmbed', 'creditAPI', 'mongoAtlas'],
    activeEdges: [['supervisor', 'docVerifier'], ['supervisor', 'creditPuller'], ['docVerifier', 'voyageEmbed'], ['creditPuller', 'creditAPI'], ['docVerifier', 'appAgent'], ['creditPuller', 'appAgent']],
    pulsingNodes: ['docVerifier', 'creditPuller'],
    nodeKey: 'loan_app',
  },
  {
    label: 'Underwriting',
    currentScene: 'underwriting',
    activeNodes: ['supervisor', 'underwriter', 'aggregation', 'vectorSearch', 'mongoAtlas'],
    activeEdges: [['supervisor', 'underwriter'], ['underwriter', 'aggregation'], ['underwriter', 'vectorSearch']],
    pulsingNodes: ['underwriter'],
    nodeKey: 'underwriter',
  },
  {
    label: 'HITL Review',
    currentScene: 'approval',
    activeNodes: ['underwriter', 'hitlGate', 'checkpoint', 'mongoAtlas'],
    activeEdges: [['underwriter', 'hitlGate'], ['hitlGate', 'checkpoint'], ['checkpoint', 'mongoAtlas']],
    pulsingNodes: ['hitlGate'],
    nodeKey: 'hitl_gate',
  },
];

export const NODE_TO_STAGE = {};
WORKFLOW_STAGES.forEach((s, i) => { NODE_TO_STAGE[s.nodeKey] = i; });
NODE_TO_STAGE['doc_verifier'] = 0;
NODE_TO_STAGE['credit_puller'] = 0;

/**
 * Map a backend agent name to its workflow stage index (0, 1, or 2).
 * Handles exact matches + common substring variants. Returns null if unknown.
 */
export function agentToStageIdx(agent) {
  if (!agent) return null;
  if (NODE_TO_STAGE[agent] !== undefined) return NODE_TO_STAGE[agent];
  const a = agent.toLowerCase();
  if (a.includes('doc_verifier') || a.includes('credit_puller') || a.includes('loan_app')) return 0;
  if (a.includes('underwriter')) return 1;
  if (a.includes('hitl')) return 2;
  return null;
}
