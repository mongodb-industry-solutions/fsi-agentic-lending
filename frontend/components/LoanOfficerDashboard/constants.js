export const WORKFLOW_STAGES = [
  {
    label: 'Origination',
    currentScene: 'origination',
    activeNodes: ['supervisor', 'appAgent', 'voyageEmbed', 'creditAPI', 'mongoAtlas'],
    activeEdges: [['supervisor', 'appAgent'], ['appAgent', 'voyageEmbed'], ['appAgent', 'creditAPI']],
    pulsingNodes: ['appAgent'],
    nodeKey: 'loan_app',
  },
  {
    label: 'Underwriting',
    currentScene: 'underwriting',
    activeNodes: ['supervisor', 'underwriter', 'aggregation', 'vectorSearch', 'graphLookup', 'mongoAtlas'],
    activeEdges: [['supervisor', 'underwriter'], ['underwriter', 'aggregation'], ['underwriter', 'vectorSearch'], ['underwriter', 'graphLookup']],
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
