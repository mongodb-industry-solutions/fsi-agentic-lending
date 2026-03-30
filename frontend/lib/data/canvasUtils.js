export function mergeCanvasState(steps, stepIndex) {
  const activeNodes = new Set();
  const activeEdges = new Set();
  const pulsingNodes = new Set();
  const completedNodes = new Set();
  const currentActive = new Set();

  if (stepIndex >= 0 && stepIndex < steps.length) {
    const c = steps[stepIndex].canvas;
    if (c) {
      (c.activeNodes || []).forEach((n) => currentActive.add(n));
      if (c.pulse) c.pulse.forEach((p) => pulsingNodes.add(p));
    }
  }

  for (let i = 0; i <= stepIndex && i < steps.length; i++) {
    const c = steps[i].canvas;
    if (!c) continue;
    (c.activeNodes || []).forEach((n) => activeNodes.add(n));
    (c.activeEdges || []).forEach((e) => activeEdges.add(e));
  }

  activeNodes.forEach((n) => {
    if (!currentActive.has(n) && !pulsingNodes.has(n)) completedNodes.add(n);
  });

  const focusNode = (stepIndex >= 0 && stepIndex < steps.length)
    ? steps[stepIndex].focusNode || null
    : null;

  return {
    activeNodes: [...activeNodes],
    activeEdges: [...activeEdges],
    pulsingNodes: [...pulsingNodes],
    completedNodes: [...completedNodes],
    focusNode,
  };
}
