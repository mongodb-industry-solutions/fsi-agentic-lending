import { palette } from "@leafygreen-ui/palette";
import { spacing } from "@leafygreen-ui/tokens";

export { palette, spacing };

export const fonts = {
  display: "'Manrope', sans-serif",
  body: "'DM Sans', sans-serif",
  mono: "'JetBrains Mono', monospace",
};

export const radii = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
};

export const domainColors = {
  voyage: "#6341e0",
  voyageDim: "rgba(99,65,224,0.07)",
  voyageGlow: "rgba(99,65,224,0.18)",
  agentCyan: "#0891b2",
  agentCyanDim: "rgba(8,145,178,0.07)",
  toolBlue: "#2563eb",
  toolBlueDim: "rgba(37,99,235,0.07)",
  hitlAmber: "#d97706",
  hitlAmberDim: "rgba(217,119,6,0.06)",
  hitlAmberGlow: "rgba(217,119,6,0.18)",
  langsmith: "#64748b",
};

export const uiTokens = {
  bgVoid: palette.gray.light3,
  bgBase: palette.white,
  bgSurface: "#f1f5f9",
  bgRaised: "#e2e8f0",
  bgOverlay: "#cbd5e1",
  borderDim: palette.gray.light2,
  borderBase: "#cbd5e1",
  borderBright: palette.gray.base,
  textPrimary: palette.gray.dark3,
  textSecondary: palette.gray.dark1,
  textDim: palette.gray.base,
  mongo: palette.green.dark1,
  mongoDim: "rgba(0,136,74,0.06)",
  mongoGlow: "rgba(0,136,74,0.18)",
  mongoBright: "#00b864",
  danger: palette.red.base,
  dangerDim: "rgba(220,38,38,0.06)",
  success: palette.green.base,
  successDim: "rgba(5,150,105,0.07)",
  shadowCard: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
  shadowHover: "0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)",
  transitionFast: "all 150ms cubic-bezier(0.33, 1, 0.68, 1)",
  transitionMedium: "all 220ms cubic-bezier(0.33, 1, 0.68, 1)",
  headerBg: palette.green.dark2,
};
