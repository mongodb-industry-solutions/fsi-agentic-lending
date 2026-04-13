export function ModifiedParamsBadge({ settings }) {
  if (!settings) return null;
  const mods = [];
  if (settings.docVerify && !settings.docVerify.enabled) mods.push('Doc verify: off');
  if (settings.bankingEnrich && !settings.bankingEnrich.enabled) mods.push('Banking: off');
  if (settings.fraudScan && !settings.fraudScan.enabled) mods.push('Fraud scan: off');
  if (settings.riskScore && settings.riskScore.threshold !== 65) mods.push(`Risk threshold: ${settings.riskScore.threshold}`);
  if (settings.fraudScan && settings.fraudScan.enabled && settings.fraudScan.hops !== 3) mods.push(`Graph depth: ${settings.fraudScan.hops}`);
  if (mods.length === 0) return null;
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 8px', borderRadius: 8,
      background: 'var(--hitl-amber-dim)', color: 'var(--hitl-amber)',
      fontSize: 9, fontWeight: 600, fontFamily: 'var(--font-mono)',
    }}>
      {mods.join(' · ')}
    </div>
  );
}
