"use client";

import { useRef, useEffect, useCallback } from 'react';
import { RELEVANT_NODES } from '../../lib/data/demoScenes';
import { NODE_COLORS } from '../../lib/data/nodeColors';

const NODE_TYPES = {
  agent: 'agent',
  tool: 'tool',
  storage: 'storage',
  gate: 'gate',
  output: 'output',
};

const NODES = {
  supervisor:    { label: 'Supervisor',           icon: '🧭', color: NODE_COLORS.supervisor, w: 120, h: 44, type: NODE_TYPES.agent },
  appAgent:      { label: 'Loan App Agent',       icon: '📝', color: NODE_COLORS.appAgent,   w: 114, h: 42, type: NODE_TYPES.agent },
  underwriter:   { label: 'Underwriting',         icon: '🧠', color: NODE_COLORS.underwriter, w: 120, h: 42, type: NODE_TYPES.agent },
  renewalAgent:  { label: 'Renewal Agent',        icon: '🔄', color: NODE_COLORS.renewalAgent, w: 114, h: 42, type: NODE_TYPES.agent },
  creditAPI:     { label: 'Credit Bureau',        icon: '📋', color: NODE_COLORS.creditAPI,   w: 104, h: 34, type: NODE_TYPES.tool },
  voyageEmbed:   { label: 'Voyage MM 3.5',        icon: '🧬', color: NODE_COLORS.voyageEmbed, w: 104, h: 34, type: NODE_TYPES.tool },
  vectorSearch:  { label: 'Vector Search',        icon: '🔎', color: NODE_COLORS.vectorSearch, w: 110, h: 34, type: NODE_TYPES.tool },
  graphLookup:   { label: '$graphLookup',         icon: '🕸', color: NODE_COLORS.graphLookup, w: 104, h: 34, type: NODE_TYPES.tool },
  aggregation:   { label: 'Aggregation',          icon: '📊', color: NODE_COLORS.aggregation, w: 104, h: 34, type: NODE_TYPES.tool },
  changeStream:  { label: 'Change Streams',       icon: '📡', color: NODE_COLORS.changeStream, w: 110, h: 34, type: NODE_TYPES.output },
  timeSeries:    { label: 'Time Series',          icon: '⏱', color: NODE_COLORS.timeSeries,  w: 96,  h: 34, type: NODE_TYPES.tool },
  hitlGate:      { label: 'HITL Gate',            icon: '✋', color: NODE_COLORS.hitlGate,    w: 96,  h: 42, type: NODE_TYPES.gate },
  checkpoint:    { label: 'Checkpointer',         icon: '💾', color: NODE_COLORS.checkpoint,  w: 110, h: 34, type: NODE_TYPES.storage },
  memory:        { label: 'Memory Store',         icon: '🧠', color: NODE_COLORS.memory,      w: 110, h: 34, type: NODE_TYPES.storage },
  mongoAtlas:    { label: 'MongoDB Atlas',        icon: '🍃', color: NODE_COLORS.mongoAtlas,  w: 140, h: 46, type: NODE_TYPES.storage },
  decision:      { label: 'DECISION',             icon: '✅', color: NODE_COLORS.decision,    w: 100, h: 42, type: NODE_TYPES.gate },
  fundingEngine: { label: 'Funding Engine',       icon: '💰', color: NODE_COLORS.fundingEngine, w: 114, h: 38, type: NODE_TYPES.output },
  ledger:        { label: 'Loan Ledger',          icon: '📒', color: NODE_COLORS.fundingEngine, w: 100, h: 34, type: NODE_TYPES.storage },
  renewalOffer:  { label: 'Renewal Offer',        icon: '📋', color: NODE_COLORS.renewalAgent, w: 110, h: 34, type: NODE_TYPES.output },
};

const EDGES = [
  ['supervisor', 'appAgent'],
  ['supervisor', 'underwriter'],
  ['supervisor', 'renewalAgent'],
  ['appAgent', 'creditAPI'],
  ['appAgent', 'voyageEmbed'],
  ['underwriter', 'aggregation'],
  ['underwriter', 'vectorSearch'],
  ['underwriter', 'graphLookup'],
  ['underwriter', 'hitlGate'],
  ['voyageEmbed', 'vectorSearch'],
  ['hitlGate', 'decision'],
  ['aggregation', 'mongoAtlas'],
  ['vectorSearch', 'mongoAtlas'],
  ['graphLookup', 'mongoAtlas'],
  ['changeStream', 'mongoAtlas'],
  ['timeSeries', 'mongoAtlas'],
  ['checkpoint', 'mongoAtlas'],
  ['memory', 'mongoAtlas'],
  ['hitlGate', 'checkpoint'],
  ['decision', 'fundingEngine'],
  ['fundingEngine', 'ledger'],
  ['fundingEngine', 'changeStream'],
  ['ledger', 'mongoAtlas'],
  ['changeStream', 'renewalAgent'],
  ['timeSeries', 'renewalAgent'],
  ['renewalAgent', 'vectorSearch'],
  ['renewalAgent', 'renewalOffer'],
  ['renewalOffer', 'mongoAtlas'],
];

const EDGE_LABELS = {
  'appAgent>voyageEmbed': 'embeddings',
  'voyageEmbed>vectorSearch': 'vectors',
  'underwriter>aggregation': 'risk pipeline',
  'underwriter>vectorSearch': 'policy RAG',
  'underwriter>graphLookup': 'fraud scan',
  'underwriter>hitlGate': 'risk score',
  'hitlGate>decision': 'approval',
  'hitlGate>checkpoint': 'state save',
  'decision>fundingEngine': 'disburse',
  'fundingEngine>ledger': 'accounting',
  'fundingEngine>changeStream': 'events',
  'changeStream>renewalAgent': 'alerts',
  'renewalAgent>vectorSearch': 'similarity',
  'renewalAgent>renewalOffer': 'offer',
  'aggregation>mongoAtlas': 'scores',
  'vectorSearch>mongoAtlas': 'results',
  'graphLookup>mongoAtlas': 'graph',
  'checkpoint>mongoAtlas': 'checkpoint',
  'ledger>mongoAtlas': 'ledger',
  'renewalOffer>mongoAtlas': 'stored',
};

const STAGE_COLUMNS = [
  { key: 'origination', label: 'ORIGINATION', px: 0.11 },
  { key: 'decisioning', label: 'DECISIONING', px: 0.30 },
  { key: 'approval',    label: 'APPROVAL',    px: 0.50 },
  { key: 'funding',     label: 'FUNDING',     px: 0.69 },
  { key: 'management',  label: 'MANAGEMENT',  px: 0.89 },
];

const PIPELINE_LAYOUT = {
  supervisor:    { px: 0.11, py: 0.18 },
  appAgent:      { px: 0.11, py: 0.50 },
  creditAPI:     { px: 0.06, py: 0.78 },
  voyageEmbed:   { px: 0.17, py: 0.78 },

  underwriter:   { px: 0.30, py: 0.18 },
  aggregation:   { px: 0.24, py: 0.50 },
  vectorSearch:  { px: 0.36, py: 0.50 },
  graphLookup:   { px: 0.24, py: 0.78 },
  timeSeries:    { px: 0.36, py: 0.78 },

  hitlGate:      { px: 0.50, py: 0.18 },
  checkpoint:    { px: 0.56, py: 0.50 },
  decision:      { px: 0.50, py: 0.78 },

  fundingEngine: { px: 0.69, py: 0.18 },
  ledger:        { px: 0.63, py: 0.50 },
  changeStream:  { px: 0.75, py: 0.50 },

  renewalAgent:  { px: 0.89, py: 0.18 },
  renewalOffer:  { px: 0.89, py: 0.50 },

  mongoAtlas:    { px: 0.50, py: 0.92 },
  memory:        { px: 0.44, py: 0.50 },
};

if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    r = Math.min(r, Math.min(w, h) / 2);
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
  };
}

function layoutNodes(W, H) {
  const result = {};
  for (const [id, pos] of Object.entries(PIPELINE_LAYOUT)) {
    result[id] = { x: pos.px * W, y: pos.py * H };
  }
  return result;
}

function quadPoint(p0x, p0y, cpx, cpy, p1x, p1y, t) {
  const u = 1 - t;
  return {
    x: u * u * p0x + 2 * u * t * cpx + t * t * p1x,
    y: u * u * p0y + 2 * u * t * cpy + t * t * p1y,
  };
}

function quadTangent(p0x, p0y, cpx, cpy, p1x, p1y, t) {
  const u = 1 - t;
  return {
    x: 2 * u * (cpx - p0x) + 2 * t * (p1x - cpx),
    y: 2 * u * (cpy - p0y) + 2 * t * (p1y - cpy),
  };
}

function drawPill(ctx, x, y, w, h) {
  const r = h / 2;
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(x + r, y + h);
  ctx.arc(x + r, y + r, r, Math.PI / 2, -Math.PI / 2);
  ctx.closePath();
}

function drawDiamond(ctx, cx, cy, hw, hh) {
  ctx.moveTo(cx, cy - hh);
  ctx.lineTo(cx + hw, cy);
  ctx.lineTo(cx, cy + hh);
  ctx.lineTo(cx - hw, cy);
  ctx.closePath();
}

function drawCylinder(ctx, x, y, w, h) {
  const cap = 5;
  ctx.moveTo(x, y + cap);
  ctx.lineTo(x, y + h - cap);
  ctx.quadraticCurveTo(x, y + h + 2, x + w / 2, y + h + 2);
  ctx.quadraticCurveTo(x + w, y + h + 2, x + w, y + h - cap);
  ctx.lineTo(x + w, y + cap);
  ctx.quadraticCurveTo(x + w, y - 2, x + w / 2, y - 2);
  ctx.quadraticCurveTo(x, y - 2, x, y + cap);
  ctx.closePath();
}

function hitTest(mx, my, nodePositions) {
  for (const [id, pos] of Object.entries(nodePositions)) {
    const n = NODES[id];
    if (!n) continue;
    const hw = (n.w / 2) + 6;
    const hh = (n.h / 2) + 6;
    if (mx >= pos.x - hw && mx <= pos.x + hw && my >= pos.y - hh && my <= pos.y + hh) {
      return id;
    }
  }
  return null;
}

export default function WorkflowCanvas({
  activeNodes = [],
  activeEdges = [],
  pulsingNodes = [],
  completedNodes = [],
  currentScene = null,
  onNodeHover = null,
  onNodeClick = null,
  highlightNode = null,
}) {
  const canvasRef = useRef(null);
  const stateRef = useRef({
    activeSet: new Set(),
    edgeSet: new Set(),
    pulseSet: new Set(),
    completedSet: new Set(),
    sceneRelevantSet: null,
    highlightNode: null,
    hoveredNode: null,
    nodePositions: {},
    nodeEntryTimes: {},
  });

  const state = stateRef.current;
  state.activeSet = new Set(activeNodes);
  state.edgeSet = new Set(activeEdges.map((e) => `${e[0]}>${e[1]}`));
  state.pulseSet = new Set(pulsingNodes);
  state.completedSet = new Set(completedNodes);
  state.sceneRelevantSet = currentScene && RELEVANT_NODES[currentScene]
    ? new Set(RELEVANT_NODES[currentScene])
    : null;
  state.highlightNode = highlightNode;

  const nowRef = useRef(Date.now());
  activeNodes.forEach((id) => {
    if (!state.nodeEntryTimes[id]) state.nodeEntryTimes[id] = Date.now();
  });

  const handleMouseMove = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const hit = hitTest(mx, my, state.nodePositions);
    if (hit !== state.hoveredNode) {
      state.hoveredNode = hit;
      canvas.style.cursor = hit ? 'pointer' : 'default';
      if (onNodeHover) onNodeHover(hit);
    }
  }, [onNodeHover]);

  const handleClick = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const hit = hitTest(mx, my, state.nodePositions);
    if (hit && onNodeClick) onNodeClick(hit);
  }, [onNodeClick]);

  const handleMouseLeave = useCallback(() => {
    state.hoveredNode = null;
    if (onNodeHover) onNodeHover(null);
  }, [onNodeHover]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let W, H, animId;
    let theme = {};

    const readTheme = () => {
      const s = getComputedStyle(canvas);
      theme = {
        grid: s.getPropertyValue('--canvas-grid').trim() || '#f1f5f9',
        inactiveStroke: s.getPropertyValue('--canvas-inactive-stroke').trim() || '#cbd5e1',
        inactiveFill: s.getPropertyValue('--canvas-inactive-fill').trim() || '#f8fafc',
        textActive: s.getPropertyValue('--canvas-text-active').trim() || '#001E2B',
        textInactive: s.getPropertyValue('--canvas-text-inactive').trim() || '#94a3b8',
      };
    };

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.parentElement.getBoundingClientRect();
      W = rect.width;
      H = rect.height;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      state.nodePositions = layoutNodes(W, H);
      readTheme();
    };

    const draw = () => {
      if (!ctx || !W) return;
      const now = Date.now();
      nowRef.current = now;
      ctx.clearRect(0, 0, W, H);

      const nodePositions = state.nodePositions;
      const atlasPos = nodePositions.mongoAtlas;
      const relevantSet = state.sceneRelevantSet;

      // Radial gradient background centered on mongoAtlas
      if (atlasPos) {
        const grad = ctx.createRadialGradient(atlasPos.x, atlasPos.y, 20, atlasPos.x, atlasPos.y, Math.max(W, H) * 0.7);
        grad.addColorStop(0, NODES.mongoAtlas.color + '06');
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
      }

      // Stage column labels
      STAGE_COLUMNS.forEach((col) => {
        const cx = col.px * W;
        const isCurrentStage = currentScene === col.key;
        ctx.font = `700 8px "Euclid Circular A", Manrope, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = isCurrentStage
          ? (theme.textActive || '#001E2B')
          : (theme.textInactive || '#94a3b8');
        ctx.globalAlpha = isCurrentStage ? 0.7 : 0.25;
        ctx.fillText(col.label, cx, 6);

        if (isCurrentStage) {
          const tw = ctx.measureText(col.label).width;
          ctx.strokeStyle = NODES.mongoAtlas.color + '44';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(cx - tw / 2 - 4, 18);
          ctx.lineTo(cx + tw / 2 + 4, 18);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      });

      // Draw all edges
      EDGES.forEach(([a, b]) => {
        const pa = nodePositions[a];
        const pb = nodePositions[b];
        if (!pa || !pb) return;

        const key = `${a}>${b}`;
        const isActive = state.edgeSet.has(key);
        const aCompleted = state.completedSet.has(a);
        const bCompleted = state.completedSet.has(b);
        const bothCompleted = aCompleted && bCompleted;
        const isHighlightEdge = (state.hoveredNode === a || state.hoveredNode === b || state.highlightNode === a || state.highlightNode === b);

        const aRelevant = !relevantSet || relevantSet.has(a);
        const bRelevant = !relevantSet || relevantSet.has(b);
        const bothRelevant = aRelevant && bRelevant;
        const eitherRelevant = aRelevant || bRelevant;

        const mx = (pa.x + pb.x) / 2;
        const my = (pa.y + pb.y) / 2 - 12;

        if (!isActive) {
          ctx.globalAlpha = bothRelevant ? 0.30 : eitherRelevant ? 0.20 : 0.18;
          ctx.setLineDash([3, 3]);
        } else if (bothCompleted) {
          ctx.globalAlpha = 0.5;
        } else if (isHighlightEdge && isActive) {
          ctx.globalAlpha = 1;
        }

        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.quadraticCurveTo(mx, my, pb.x, pb.y);
        const edgeColor = isActive
          ? (bothCompleted ? '#059669' : NODES[a].color)
          : theme.inactiveStroke;
        ctx.strokeStyle = edgeColor + (isActive ? (bothCompleted ? '77' : 'bb') : '');
        ctx.lineWidth = isActive ? (isHighlightEdge ? 2.5 : 1.5) : 1.0;
        ctx.stroke();
        ctx.setLineDash([]);

        // Arrowhead
        if (ctx.globalAlpha > 0.08) {
          const tang = quadTangent(pa.x, pa.y, mx, my, pb.x, pb.y, 0.92);
          const angle = Math.atan2(tang.y, tang.x);
          const arrowLen = isActive ? 6 : 4;
          const arrowPt = quadPoint(pa.x, pa.y, mx, my, pb.x, pb.y, 0.90);
          ctx.beginPath();
          ctx.moveTo(arrowPt.x + arrowLen * Math.cos(angle), arrowPt.y + arrowLen * Math.sin(angle));
          ctx.lineTo(arrowPt.x + arrowLen * Math.cos(angle + 2.5), arrowPt.y + arrowLen * Math.sin(angle + 2.5));
          ctx.lineTo(arrowPt.x + arrowLen * Math.cos(angle - 2.5), arrowPt.y + arrowLen * Math.sin(angle - 2.5));
          ctx.closePath();
          ctx.fillStyle = edgeColor + (isActive ? 'cc' : '');
          ctx.fill();
        }

        // Edge label for active edges
        if (isActive && !bothCompleted) {
          const labelText = EDGE_LABELS[key];
          if (labelText) {
            const labelPt = quadPoint(pa.x, pa.y, mx, my, pb.x, pb.y, 0.5);
            ctx.font = '500 7px "Euclid Circular A", Manrope, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const tw = ctx.measureText(labelText).width + 6;
            ctx.fillStyle = theme.inactiveFill;
            ctx.globalAlpha = 0.9;
            ctx.beginPath();
            ctx.roundRect(labelPt.x - tw / 2, labelPt.y - 6, tw, 12, 3);
            ctx.fill();
            ctx.strokeStyle = edgeColor + '44';
            ctx.lineWidth = 0.5;
            ctx.stroke();
            ctx.globalAlpha = 1;
            ctx.fillStyle = edgeColor;
            ctx.fillText(labelText, labelPt.x, labelPt.y);
          }
        }

        // Flow particles on active non-completed edges
        if (isActive && !bothCompleted && ctx.globalAlpha > 0.3) {
          const particleCount = 1;
          for (let p = 0; p < particleCount; p++) {
            const offset = 0;
            const t = ((now % 1400) / 1400 + offset) % 1;
            const pt = quadPoint(pa.x, pa.y, mx, my, pb.x, pb.y, t);
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2);
            ctx.fillStyle = NODES[a].color;
            const savedAlpha = ctx.globalAlpha;
            ctx.globalAlpha = 0.8;
            ctx.fill();
            ctx.globalAlpha = savedAlpha;
          }
        }

        // Completed edge checkmark
        if (isActive && bothCompleted) {
          const midPt = quadPoint(pa.x, pa.y, mx, my, pb.x, pb.y, 0.5);
          ctx.font = '700 7px "Euclid Circular A", Manrope, sans-serif';
          ctx.fillStyle = '#059669';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('✓', midPt.x, midPt.y);
        }

        ctx.globalAlpha = 1;
      });

      // Draw all nodes
      Object.keys(nodePositions).forEach((id) => {
        const n = NODES[id];
        const pos = nodePositions[id];
        if (!n || !pos) return;

        const isActive = state.activeSet.has(id);
        const isPulsing = state.pulseSet.has(id);
        const isCompleted = state.completedSet.has(id);
        const isHovered = state.hoveredNode === id;
        const isHighlighted = state.highlightNode === id;
        const isAtlas = id === 'mongoAtlas';
        const isSceneRelevant = !relevantSet || relevantSet.has(id) || isAtlas;
        const entryTime = state.nodeEntryTimes[id] || now;
        const entryAge = now - entryTime;
        const entryScale = isActive || isCompleted
          ? Math.min(entryAge / 300, 1) * 0.08 + 0.92
          : 1;

        // Determine opacity tier
        if (isActive || isPulsing) {
          ctx.globalAlpha = 1;
        } else if (isCompleted) {
          ctx.globalAlpha = 0.65;
        } else if (isSceneRelevant) {
          ctx.globalAlpha = 0.55;
        } else {
          ctx.globalAlpha = 0.42;
        }

        const scale = isAtlas ? 1.1 : entryScale;
        const hw = (n.w * scale) / 2;
        const hh = (n.h * scale) / 2;

        // Glow for active/pulsing/hovered
        if ((isActive || isPulsing || isHovered || isHighlighted) && !isCompleted) {
          ctx.shadowColor = n.color + (isPulsing ? '66' : '33');
          ctx.shadowBlur = isPulsing
            ? 16 + Math.sin(now / 300) * 2
            : isHovered || isHighlighted ? 12 : 8;
        }

        // Draw shape
        ctx.beginPath();
        const nodeType = n.type;
        if (nodeType === NODE_TYPES.gate) {
          drawDiamond(ctx, pos.x, pos.y, hw + 3, hh + 3);
        } else if (nodeType === NODE_TYPES.storage) {
          drawCylinder(ctx, pos.x - hw, pos.y - hh, hw * 2, hh * 2);
        } else if (nodeType === NODE_TYPES.tool) {
          drawPill(ctx, pos.x - hw, pos.y - hh, hw * 2, hh * 2);
        } else {
          ctx.roundRect(pos.x - hw, pos.y - hh, hw * 2, hh * 2, 10);
        }

        // Fill
        if (isCompleted) {
          ctx.fillStyle = n.color + '0a';
        } else if (isActive || isPulsing) {
          ctx.fillStyle = n.color + '18';
        } else if (isSceneRelevant) {
          ctx.fillStyle = n.color + '08';
        } else {
          ctx.fillStyle = theme.inactiveFill;
        }
        ctx.fill();

        // Border
        if (isAtlas && (isActive || isCompleted)) {
          ctx.strokeStyle = n.color;
          ctx.lineWidth = 2.5;
          ctx.stroke();
          ctx.beginPath();
          if (nodeType === NODE_TYPES.storage) {
            drawCylinder(ctx, pos.x - hw - 3, pos.y - hh - 3, (hw + 3) * 2, (hh + 3) * 2);
          } else {
            ctx.roundRect(pos.x - hw - 3, pos.y - hh - 3, (hw + 3) * 2, (hh + 3) * 2, 14);
          }
          ctx.strokeStyle = n.color + '33';
          ctx.lineWidth = 1;
          ctx.stroke();
        } else if (nodeType === NODE_TYPES.agent && (isActive || isPulsing)) {
          ctx.strokeStyle = n.color;
          ctx.lineWidth = 2.5;
          ctx.stroke();
        } else if (isHovered || isHighlighted) {
          ctx.strokeStyle = n.color;
          ctx.lineWidth = 2;
          ctx.stroke();
        } else {
          const useColor = (isActive || isCompleted || isSceneRelevant) ? n.color : theme.inactiveStroke;
          ctx.strokeStyle = (isActive || isCompleted) ? useColor + '88' : isSceneRelevant ? useColor + '66' : useColor;
          ctx.lineWidth = isActive ? 1.5 : 1.0;
          if (!isActive && !isCompleted) ctx.setLineDash([3, 2]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;

        // Labels
        const showIcon = (isActive || isPulsing || isCompleted || isSceneRelevant);
        if (nodeType === NODE_TYPES.agent && showIcon) {
          ctx.font = '12px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(n.icon, pos.x, pos.y - 7);

          ctx.font = `700 9px "Euclid Circular A", Manrope, sans-serif`;
          ctx.fillStyle = isCompleted ? theme.textInactive : (isActive || isPulsing) ? theme.textActive : theme.textInactive;
          ctx.fillText(n.label, pos.x, pos.y + 9);
        } else {
          ctx.font = `600 ${showIcon ? 8.5 : 7.5}px "Euclid Circular A", Manrope, sans-serif`;
          ctx.fillStyle = (isActive || isPulsing) ? theme.textActive : theme.textInactive;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const label = showIcon ? n.icon + ' ' + n.label : n.label;
          ctx.fillText(label, pos.x, pos.y);
        }

        // Status badge
        if (isActive || isPulsing || isCompleted) {
          const bx = pos.x + hw - 3;
          const by = pos.y - hh + 2;
          if (isPulsing) {
            const pulseR = 4 + Math.sin(now / 200) * 2;
            ctx.beginPath();
            ctx.arc(bx, by, pulseR, 0, Math.PI * 2);
            ctx.fillStyle = n.color + '44';
            ctx.fill();
            ctx.beginPath();
            ctx.arc(bx, by, 3, 0, Math.PI * 2);
            ctx.fillStyle = n.color;
            ctx.fill();
          } else if (isCompleted) {
            ctx.beginPath();
            ctx.arc(bx, by, 5, 0, Math.PI * 2);
            ctx.fillStyle = '#059669';
            ctx.fill();
            ctx.font = '700 6px "Euclid Circular A", Manrope, sans-serif';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('✓', bx, by);
          } else {
            ctx.beginPath();
            ctx.arc(bx, by, 3, 0, Math.PI * 2);
            ctx.fillStyle = n.color;
            ctx.fill();
          }
        }

        ctx.globalAlpha = 1;
      });

      // Hover tooltip
      if (state.hoveredNode && nodePositions[state.hoveredNode]) {
        const hId = state.hoveredNode;
        const hNode = NODES[hId];
        const hPos = nodePositions[hId];
        const isActive = state.activeSet.has(hId);
        const isCompleted = state.completedSet.has(hId);
        const status = state.pulseSet.has(hId) ? 'RUNNING' : isCompleted ? 'DONE' : isActive ? 'ACTIVE' : 'IDLE';
        const tooltipText = `${hNode.label}  ·  ${status}`;

        ctx.font = '600 9px "Euclid Circular A", Manrope, sans-serif';
        const tw = ctx.measureText(tooltipText).width + 14;
        const tx = Math.max(2, Math.min(hPos.x - tw / 2, W - tw - 2));
        const ty = hPos.y - (hNode.h / 2) - 22;

        ctx.fillStyle = theme.textActive + 'ee';
        ctx.beginPath();
        ctx.roundRect(tx, ty, tw, 18, 5);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(tooltipText, tx + tw / 2, ty + 9);
      }

      animId = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener('resize', resize);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    animId = requestAnimationFrame(draw);
    return () => {
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('click', handleClick);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      cancelAnimationFrame(animId);
    };
  }, [activeNodes, activeEdges, pulsingNodes, completedNodes, currentScene, highlightNode, handleMouseMove, handleClick, handleMouseLeave]);

  return <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />;
}
