/**
 * Canadian mortgage monthly payment using semi-annual compounding.
 * Standard formula for Canadian fixed-rate mortgages per the Interest Act.
 */
export function calcCanadianMonthlyPayment(principal, annualRate, years) {
  if (principal <= 0 || annualRate <= 0 || years <= 0) return 0;
  const semiAnnualRate = annualRate / 100 / 2;
  const effectiveMonthlyRate = Math.pow(1 + semiAnnualRate, 1 / 6) - 1;
  const n = years * 12;
  return principal * (effectiveMonthlyRate * Math.pow(1 + effectiveMonthlyRate, n)) /
    (Math.pow(1 + effectiveMonthlyRate, n) - 1);
}

export function formatCurrency(val) {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency', currency: 'CAD', maximumFractionDigits: 0,
  }).format(val);
}
