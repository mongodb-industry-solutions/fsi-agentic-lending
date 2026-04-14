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
  supervisor:    { label: 'Supervisor',           abbr: 'S',  color: NODE_COLORS.supervisor, w: 120, h: 44, type: NODE_TYPES.agent },
  appAgent:      { label: 'Loan App Agent',       abbr: 'A',  color: NODE_COLORS.appAgent,   w: 114, h: 42, type: NODE_TYPES.agent },
  underwriter:   { label: 'Underwriting',         abbr: 'U',  color: NODE_COLORS.underwriter, w: 120, h: 42, type: NODE_TYPES.agent },
  servicingAgent:  { label: 'Servicing Agent',    abbr: 'SA', color: NODE_COLORS.servicingAgent, w: 114, h: 42, type: NODE_TYPES.agent },
  creditAPI:     { label: 'Credit Bureau',        abbr: 'C',  color: NODE_COLORS.creditAPI,   w: 104, h: 34, type: NODE_TYPES.tool },
  voyageEmbed:   { label: 'Voyage MM 3.5',        abbr: 'V',  color: NODE_COLORS.voyageEmbed, w: 104, h: 34, type: NODE_TYPES.tool },
  vectorSearch:  { label: 'Vector Search',        abbr: 'VS', color: NODE_COLORS.vectorSearch, w: 110, h: 34, type: NODE_TYPES.tool },
  graphLookup:   { label: '$graphLookup',         abbr: 'GL', color: NODE_COLORS.graphLookup, w: 104, h: 34, type: NODE_TYPES.tool },
  aggregation:   { label: 'Aggregation',          abbr: 'AG', color: NODE_COLORS.aggregation, w: 104, h: 34, type: NODE_TYPES.tool },
  changeStream:  { label: 'Change Streams',       abbr: 'CS', color: NODE_COLORS.changeStream, w: 110, h: 34, type: NODE_TYPES.output },
  timeSeries:    { label: 'Time Series',          abbr: 'TS', color: NODE_COLORS.timeSeries,  w: 96,  h: 34, type: NODE_TYPES.tool },
  hitlGate:      { label: 'HITL Gate',            abbr: 'H',  color: NODE_COLORS.hitlGate,    w: 96,  h: 42, type: NODE_TYPES.gate },
  checkpoint:    { label: 'Checkpointer',         abbr: 'CP', color: NODE_COLORS.checkpoint,  w: 110, h: 34, type: NODE_TYPES.storage },
  memory:        { label: 'Memory Store',         abbr: 'ME', color: NODE_COLORS.memory,      w: 110, h: 34, type: NODE_TYPES.storage },
  mongoAtlas:    { label: 'MongoDB Atlas',        abbr: 'M',  color: NODE_COLORS.mongoAtlas,  w: 140, h: 46, type: NODE_TYPES.storage },
  decision:      { label: 'DECISION',             abbr: 'D',  color: NODE_COLORS.decision,    w: 100, h: 42, type: NODE_TYPES.gate },
  fundingEngine: { label: 'Funding Engine',       abbr: 'F',  color: NODE_COLORS.fundingEngine, w: 114, h: 38, type: NODE_TYPES.output },
  ledger:        { label: 'Loan Ledger',          abbr: 'L',  color: NODE_COLORS.fundingEngine, w: 100, h: 34, type: NODE_TYPES.storage },
  closingEngine: { label: 'Closing Engine',       abbr: 'CL', color: NODE_COLORS.closingEngine, w: 114, h: 38, type: NODE_TYPES.output },
  eSign:         { label: 'E-Sign',               abbr: 'ES', color: NODE_COLORS.eSign, w: 96,  h: 34, type: NODE_TYPES.gate },
  modificationOffer:  { label: 'Modification Offer', abbr: 'MO', color: NODE_COLORS.servicingAgent, w: 110, h: 34, type: NODE_TYPES.output },
};

const EDGES = [
  ['supervisor', 'appAgent'],
  ['supervisor', 'underwriter'],
  ['supervisor', 'servicingAgent'],
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
  ['decision', 'closingEngine'],
  ['closingEngine', 'eSign'],
  ['eSign', 'fundingEngine'],
  ['closingEngine', 'mongoAtlas'],
  ['eSign', 'mongoAtlas'],
  ['fundingEngine', 'ledger'],
  ['fundingEngine', 'changeStream'],
  ['ledger', 'mongoAtlas'],
  ['changeStream', 'servicingAgent'],
  ['timeSeries', 'servicingAgent'],
  ['servicingAgent', 'vectorSearch'],
  ['servicingAgent', 'modificationOffer'],
  ['modificationOffer', 'mongoAtlas'],
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
  'decision>closingEngine': 'documents',
  'closingEngine>eSign': 'sign',
  'eSign>fundingEngine': 'disburse',
  'closingEngine>mongoAtlas': 'stored',
  'eSign>mongoAtlas': 'executed',
  'fundingEngine>ledger': 'accounting',
  'fundingEngine>changeStream': 'events',
  'changeStream>servicingAgent': 'alerts',
  'servicingAgent>vectorSearch': 'similarity',
  'servicingAgent>modificationOffer': 'offer',
  'aggregation>mongoAtlas': 'scores',
  'vectorSearch>mongoAtlas': 'results',
  'graphLookup>mongoAtlas': 'graph',
  'checkpoint>mongoAtlas': 'checkpoint',
  'ledger>mongoAtlas': 'ledger',
  'modificationOffer>mongoAtlas': 'stored',
};

const STAGE_COLUMNS = [
  { key: 'origination',  label: 'ORIGINATION',  px: 0.08 },
  { key: 'underwriting', label: 'UNDERWRITING', px: 0.24 },
  { key: 'approval',     label: 'APPROVAL',     px: 0.40 },
  { key: 'closing',      label: 'CLOSING',      px: 0.56 },
  { key: 'funding',      label: 'FUNDING',      px: 0.72 },
  { key: 'servicing',    label: 'SERVICING',    px: 0.90 },
];

const PIPELINE_LAYOUT = {
  supervisor:    { px: 0.08, py: 0.18 },
  appAgent:      { px: 0.08, py: 0.50 },
  creditAPI:     { px: 0.03, py: 0.78 },
  voyageEmbed:   { px: 0.14, py: 0.78 },

  underwriter:   { px: 0.24, py: 0.18 },
  aggregation:   { px: 0.18, py: 0.50 },
  vectorSearch:  { px: 0.30, py: 0.50 },
  graphLookup:   { px: 0.18, py: 0.78 },
  timeSeries:    { px: 0.30, py: 0.78 },

  hitlGate:      { px: 0.40, py: 0.18 },
  checkpoint:    { px: 0.46, py: 0.50 },
  decision:      { px: 0.40, py: 0.78 },

  closingEngine: { px: 0.56, py: 0.18 },
  eSign:         { px: 0.56, py: 0.50 },

  fundingEngine: { px: 0.72, py: 0.18 },
  ledger:        { px: 0.66, py: 0.50 },
  changeStream:  { px: 0.78, py: 0.50 },

  servicingAgent:      { px: 0.90, py: 0.18 },
  modificationOffer:   { px: 0.90, py: 0.50 },

  mongoAtlas:    { px: 0.50, py: 0.92 },
  memory:        { px: 0.34, py: 0.50 },
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

function drawShapePath(ctx, nodeType, cx, cy, hw, hh) {
  if (nodeType === NODE_TYPES.gate) {
    drawDiamond(ctx, cx, cy, hw + 3, hh + 3);
  } else if (nodeType === NODE_TYPES.storage) {
    drawCylinder(ctx, cx - hw, cy - hh, hw * 2, hh * 2);
  } else if (nodeType === NODE_TYPES.tool) {
    drawPill(ctx, cx - hw, cy - hh, hw * 2, hh * 2);
  } else {
    ctx.roundRect(cx - hw, cy - hh, hw * 2, hh * 2, 10);
  }
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

const NODE_TECH = {
  supervisor: 'LangGraph Orchestrator',
  appAgent: 'LangGraph Agent Node',
  underwriter: 'LangGraph Agent Node',
  creditAPI: 'Experian API (Simulated)',
  voyageEmbed: 'Voyage AI Multimodal',
  vectorSearch: 'Atlas Vector Search',
  graphLookup: 'MongoDB $graphLookup',
  aggregation: 'MongoDB Agg Pipeline',
  hitlGate: 'LangGraph interrupt()',
  checkpoint: 'MongoDBSaver Checkpoint',
  memory: 'LangGraph MemoryStore',
  mongoAtlas: 'MongoDB Atlas',
  changeStream: 'MongoDB Change Streams',
  timeSeries: 'MongoDB Time Series',
  decision: 'LangGraph State Machine',
  closingEngine: 'Document Generation',
  eSign: 'Digital Signature Service',
  fundingEngine: 'Payment Disbursement',
  ledger: 'MongoDB Transactions',
  servicingAgent: 'LangGraph Agent Node',
  modificationOffer: 'Modification Generator',
};

// Pipeline nodes downstream of HITL gate (excludes infrastructure nodes like changeStream/timeSeries)
const DOWNSTREAM_OF_HITL = new Set(['closingEngine', 'eSign', 'fundingEngine', 'ledger', 'servicingAgent', 'modificationOffer', 'decision']);

export default function WorkflowCanvas({
  activeNodes = [],
  activeEdges = [],
  pulsingNodes = [],
  completedNodes = [],
  currentScene = null,
  onNodeHover = null,
  onNodeClick = null,
  highlightNode = null,
  // Canvas elevation props
  liveAgentOutput = null, // Reserved: stored in stateRef for future data annotations on nodes
  hitlActive = false,
  hitlStartTime = null,
  hitlResolution = null,
  hitlResolutionTime = null,
}) {
  const canvasRef = useRef(null);
  const redrawRef = useRef(null);
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
  state.hitlActive = hitlActive;
  state.hitlStartTime = hitlStartTime;
  state.hitlResolution = hitlResolution;
  state.hitlResolutionTime = hitlResolutionTime;
  state.liveAgentOutput = liveAgentOutput;
  state.completedSet = new Set(completedNodes);
  state.sceneRelevantSet = currentScene && RELEVANT_NODES[currentScene]
    ? new Set(RELEVANT_NODES[currentScene])
    : null;
  state.highlightNode = highlightNode;

  const nowRef = useRef(Date.now());

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
      if (redrawRef.current) redrawRef.current();
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
    if (redrawRef.current) redrawRef.current();
  }, [onNodeHover]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let W, H, animId;
    let theme = {};

    const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
      if (redrawRef.current) redrawRef.current();
    };

    // Record entry times for newly active nodes (inside effect, not render)
    state.activeSet.forEach((id) => {
      if (!state.nodeEntryTimes[id]) state.nodeEntryTimes[id] = Date.now();
    });

    let needsAnimation = false;
    const scheduleRedraw = () => {
      cancelAnimationFrame(animId);
      animId = requestAnimationFrame(draw);
    };
    redrawRef.current = scheduleRedraw;

    const draw = () => {
      if (!ctx || !W) return;
      needsAnimation = false;
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
        } else {
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
          const sourceColor = NODES[a].color;
          // HITL deceleration: particles slow to stop over 500ms
          const decelFactor = state.hitlActive && state.hitlStartTime
            ? Math.max(0, 1 - ((now - state.hitlStartTime) / 500))
            : 1;

          if (prefersReducedMotion || decelFactor <= 0) {
            // Reduced motion / frozen: single static dot at midpoint
            const pt = quadPoint(pa.x, pa.y, mx, my, pb.x, pb.y, 0.5);
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2);
            ctx.fillStyle = sourceColor;
            ctx.globalAlpha = 0.5;
            ctx.fill();
            ctx.globalAlpha = 1;
          } else {
            needsAnimation = true;
            const period = 1400;
            const particleCount = 3;
            for (let p = 0; p < particleCount; p++) {
              const rawT = ((now * decelFactor % period) / period + p / particleCount) % 1;
              // Trail positions (2 trailing dots)
              for (let trail = 1; trail >= 0; trail--) {
                const tt = ((rawT - trail * 0.035) + 1) % 1;
                const trailPt = quadPoint(pa.x, pa.y, mx, my, pb.x, pb.y, tt);
                ctx.beginPath();
                ctx.arc(trailPt.x, trailPt.y, 1.8 - trail * 0.5, 0, Math.PI * 2);
                ctx.fillStyle = sourceColor;
                ctx.globalAlpha = trail === 1 ? 0.12 : 0.3;
                ctx.fill();
              }
              // Lead particle
              const leadPt = quadPoint(pa.x, pa.y, mx, my, pb.x, pb.y, rawT);
              ctx.beginPath();
              ctx.arc(leadPt.x, leadPt.y, 2.5, 0, Math.PI * 2);
              ctx.fillStyle = sourceColor;
              ctx.globalAlpha = 0.8;
              ctx.fill();
              // White core
              ctx.beginPath();
              ctx.arc(leadPt.x, leadPt.y, 1, 0, Math.PI * 2);
              ctx.fillStyle = '#ffffff';
              ctx.globalAlpha = 0.9;
              ctx.fill();
            }
            ctx.globalAlpha = 1;
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

      // HITL barrier line and waiting state
      if (state.hitlActive && state.hitlStartTime && nodePositions.hitlGate) {
        const gatePos = nodePositions.hitlGate;
        const hitlElapsed = now - state.hitlStartTime;
        const barrierProgress = prefersReducedMotion ? 1 : Math.min(hitlElapsed / 400, 1);
        const extent = barrierProgress * H * 0.45;

        const needsBarrierAnim = hitlElapsed < 400;
        const needsPulseAnim = barrierProgress >= 1 && !prefersReducedMotion;
        needsAnimation = needsAnimation || needsBarrierAnim || needsPulseAnim;

        // Vertical dashed barrier line
        ctx.save();
        ctx.setLineDash([8, 6]);
        ctx.strokeStyle = '#d9770688';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(gatePos.x, gatePos.y - extent);
        ctx.lineTo(gatePos.x, gatePos.y + extent);
        ctx.stroke();
        ctx.setLineDash([]);

        // Concentric amber rings on gate (waiting state)
        if (barrierProgress >= 1) {
          const pulseT = prefersReducedMotion ? 0 : Math.sin(now / 1000) * 0.05;
          const gateN = NODES.hitlGate;
          const ghw = gateN.w / 2;
          const ghh = gateN.h / 2;
          for (let ring = 0; ring < 2; ring++) {
            const ringScale = ring === 0 ? 1.4 + pulseT : 1.8 + pulseT;
            ctx.beginPath();
            drawShapePath(ctx, NODE_TYPES.gate, gatePos.x, gatePos.y, ghw * ringScale, ghh * ringScale);
            ctx.strokeStyle = '#d97706';
            ctx.globalAlpha = ring === 0 ? 0.08 : 0.04;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
        }
        ctx.restore();
      }

      // HITL resolution animation
      if (state.hitlResolution && state.hitlResolutionTime && nodePositions.hitlGate) {
        const gatePos = nodePositions.hitlGate;
        const resolveColor = state.hitlResolution === 'approved' ? '#059669' : '#DB3030';
        const resolveSince = now - state.hitlResolutionTime;
        if (resolveSince >= 0 && resolveSince < 600) {
          needsAnimation = true;
          const t = resolveSince / 600;
          const radius = t * 180;
          ctx.beginPath();
          ctx.arc(gatePos.x, gatePos.y, radius, 0, Math.PI * 2);
          ctx.strokeStyle = resolveColor;
          ctx.globalAlpha = 0.25 * (1 - t);
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }

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
        if (isPulsing || ((isActive || isCompleted) && entryAge < 300)) needsAnimation = true;

        // Determine opacity tier
        const isDownstreamOfHitl = state.hitlActive && DOWNSTREAM_OF_HITL.has(id);
        if (isDownstreamOfHitl) {
          ctx.globalAlpha = 0.12;
        } else if (isActive || isPulsing) {
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
        const nodeType = n.type;

        // Layered glow (replaces shadowBlur for consistency across DPR)
        if ((isActive || isPulsing || isHovered || isHighlighted) && !isCompleted && !isDownstreamOfHitl) {
          const pulseScale = isPulsing && !prefersReducedMotion ? 1 + Math.sin(now / 600) * 0.02 : 1;
          // Outer halo
          ctx.beginPath();
          drawShapePath(ctx, nodeType, pos.x, pos.y, hw * 1.15 * pulseScale, hh * 1.15 * pulseScale);
          ctx.fillStyle = n.color + (isPulsing ? '0c' : '08');
          ctx.fill();
          // Inner glow
          ctx.beginPath();
          drawShapePath(ctx, nodeType, pos.x, pos.y, hw * 1.06, hh * 1.06);
          ctx.fillStyle = n.color + (isPulsing ? '18' : '10');
          ctx.fill();
        }

        // Draw shape
        ctx.beginPath();
        drawShapePath(ctx, nodeType, pos.x, pos.y, hw, hh);

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

        // Labels
        const showAbbr = (isActive || isPulsing || isCompleted || isSceneRelevant);
        if (nodeType === NODE_TYPES.agent && showAbbr) {
          ctx.font = `700 11px "Euclid Circular A", Manrope, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = n.color;
          ctx.fillText(n.abbr, pos.x, pos.y - 7);

          ctx.font = `700 9px "Euclid Circular A", Manrope, sans-serif`;
          ctx.fillStyle = isCompleted ? theme.textInactive : (isActive || isPulsing) ? theme.textActive : theme.textInactive;
          ctx.fillText(n.label, pos.x, pos.y + 9);
        } else {
          ctx.font = `600 ${showAbbr ? 8.5 : 7.5}px "Euclid Circular A", Manrope, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          // HITL gate label override when awaiting
          if (id === 'hitlGate' && state.hitlActive) {
            ctx.fillStyle = '#d97706';
            ctx.font = '700 8px "Euclid Circular A", Manrope, sans-serif';
            ctx.fillText('AWAITING', pos.x, pos.y - 4);
            ctx.fillText('OFFICER', pos.x, pos.y + 7);
          } else {
            ctx.fillStyle = (isActive || isPulsing) ? theme.textActive : theme.textInactive;
            const label = showAbbr ? n.abbr + ' ' + n.label : n.label;
            ctx.fillText(label, pos.x, pos.y);
          }
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

      // Rich hover tooltip
      if (state.hoveredNode && nodePositions[state.hoveredNode]) {
        const hId = state.hoveredNode;
        const hNode = NODES[hId];
        const hPos = nodePositions[hId];
        const isHActive = state.activeSet.has(hId);
        const isHCompleted = state.completedSet.has(hId);
        const isHPulsing = state.pulseSet.has(hId);
        const statusText = isHPulsing ? 'RUNNING' : isHCompleted ? 'DONE' : isHActive ? 'ACTIVE' : 'IDLE';
        const statusColor = isHPulsing ? hNode.color : isHCompleted ? '#059669' : isHActive ? '#0891b2' : '#94a3b8';
        const techText = NODE_TECH[hId] || '';
        const entryT = state.nodeEntryTimes[hId];
        const elapsedText = (isHActive || isHPulsing) && entryT ? `${((now - entryT) / 1000).toFixed(1)}s elapsed` : '';

        const tooltipW = 160;
        const tooltipH = techText ? (elapsedText ? 56 : 46) : 28;
        const tx = Math.max(2, Math.min(hPos.x - tooltipW / 2, W - tooltipW - 2));
        const ty = Math.max(2, hPos.y - (hNode.h / 2) - tooltipH - 8);

        // Background
        ctx.fillStyle = 'rgba(0, 30, 43, 0.90)';
        ctx.beginPath();
        ctx.roundRect(tx, ty, tooltipW, tooltipH, 6);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.textAlign = 'left';
        let lineY = ty + 12;

        // Line 1: Label
        ctx.font = '700 10px "Euclid Circular A", Manrope, sans-serif';
        ctx.fillStyle = hNode.color;
        ctx.textBaseline = 'middle';
        ctx.fillText(hNode.label, tx + 8, lineY);
        lineY += 13;

        // Line 2: Technology
        if (techText) {
          ctx.font = '500 7.5px "Source Code Pro", monospace';
          ctx.fillStyle = '#94a3b8';
          ctx.fillText(techText, tx + 8, lineY);
          lineY += 12;
        }

        // Line 3: Status dot + text
        ctx.beginPath();
        ctx.arc(tx + 12, lineY, 3, 0, Math.PI * 2);
        ctx.fillStyle = statusColor;
        ctx.fill();
        ctx.font = '600 7.5px "Euclid Circular A", Manrope, sans-serif';
        ctx.fillStyle = '#cbd5e1';
        ctx.fillText(statusText, tx + 18, lineY);

        // Line 4: Elapsed
        if (elapsedText) {
          ctx.font = '500 7px "Source Code Pro", monospace';
          ctx.fillStyle = '#64748b';
          ctx.fillText(elapsedText, tx + tooltipW - ctx.measureText(elapsedText).width - 8, lineY);
        }

        ctx.textAlign = 'center';
      }

      if (needsAnimation) {
        animId = requestAnimationFrame(draw);
      }
    };

    resize();
    window.addEventListener('resize', resize);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    return () => {
      redrawRef.current = null;
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('click', handleClick);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      cancelAnimationFrame(animId);
    };
  }, [activeNodes, activeEdges, pulsingNodes, completedNodes, currentScene, highlightNode, hitlActive, hitlStartTime, hitlResolution, hitlResolutionTime, handleMouseMove, handleClick, handleMouseLeave]);

  return <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />;
}

export const ALL_NODE_IDS = Object.keys(NODES);
export const ALL_EDGES = EDGES;
