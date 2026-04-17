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
NODE_TO_STAGE['complete'] = WORKFLOW_STAGES.length - 1;

/**
 * Map a backend agent name to its workflow stage index.
 *
 * Returns null for `supervisor` and unknown agents — callers should use
 * `setWorkflowStage((prev) => Math.max(prev, idx))` to preserve monotonic
 * progression. Supervisor runs between every stage, so if it advanced the
 * stage forward/backward it would cause the Stage Progress Bar to flicker.
 */
export function agentToStageIdx(agent) {
  if (!agent) return null;
  if (agent === 'supervisor') return null; // never advance/regress on supervisor
  if (NODE_TO_STAGE[agent] !== undefined) return NODE_TO_STAGE[agent];
  const a = agent.toLowerCase();
  if (a === 'supervisor' || a.includes('supervisor')) return null;
  if (a.includes('doc_verifier') || a.includes('credit_puller') || a.includes('loan_app')) return 0;
  if (a.includes('underwriter')) return 1;
  if (a.includes('hitl')) return 2;
  if (a === 'complete') return WORKFLOW_STAGES.length - 1;
  return null;
}
