"use client";

import { colorMap, dimMap, borderMap } from "../../lib/data/colorMaps";

export { colorMap, dimMap } from "../../lib/data/colorMaps";

export { colorMap, dimMap };

export default function FeatureBadge({
  icon,
  label,
  colorVar = "mongo",
  active = false,
  small = false,
  onClick,
}) {
  const color = colorMap[colorVar] || colorMap.mongo;
  const bg = dimMap[colorVar] || dimMap.mongo;
  const border = borderMap[colorVar] || borderMap.mongo;

  const badgeStyle = {
    display: "inline-flex",
    alignItems: "center",
    gap: small ? 4 : 6,
    padding: small ? "2px 8px" : "4px 10px",
    margin: 2,
    borderRadius: "var(--radius-sm)",
    fontSize: small ? 10 : 11,
    fontWeight: 600,
    background: active ? bg : "var(--bg-overlay)",
    color: active ? color : "var(--text-dim)",
    border: `1px solid ${active ? border : "var(--border-dim)"}`,
    opacity: active ? 1 : 0.7,
    transition: "all 0.3s",
    ...(onClick ? { cursor: "pointer" } : {}),
  };

  const Wrapper = onClick ? "button" : "span";
  const wrapperProps = onClick
    ? { type: "button", onClick, style: badgeStyle }
    : { style: badgeStyle };

  return (
    <Wrapper {...wrapperProps}>
      <span style={{ fontSize: small ? 12 : 14 }}>{icon}</span>
      {label}
    </Wrapper>
  );
}
