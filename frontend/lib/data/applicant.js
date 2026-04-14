/**
 * Static applicant data for the DemoFlow scripted walkthrough only.
 * The live BorrowerPortal derives all values from the selected BORROWER_PROFILES entry.
 */
export const APPLICANT = {
  name: "Marcus & Sofia Delgado",
  id: "APP-2026-00001",
  purchasePrice: "$875,000",
  loanAmount: "$700,000",
  product: "5yr Fixed (25yr Amort)",
  income: "$222,700",
  employer: "TechNova Systems / Covenant Health",
  equifax: 784,
  gds: 0.32,
};

export const DOCUMENTS = [
  { id: "doc-gov-id", name: "Government IDs", glyph: "Person" },
  { id: "doc-employment", name: "Employment Letters", glyph: "File" },
  { id: "doc-paystubs", name: "Pay Stubs (6)", glyph: "File" },
  { id: "doc-tax", name: "CRA Tax Notices", glyph: "File" },
  { id: "doc-bank", name: "Bank Statements (3mo)", glyph: "Building" },
  { id: "doc-purchase", name: "Purchase Agreement", glyph: "File" },
  { id: "doc-investments", name: "Investment Statements", glyph: "Charts" },
  { id: "doc-property", name: "Existing Property Docs", glyph: "Building" },
  { id: "doc-application", name: "Mortgage Application", glyph: "Edit" },
  { id: "doc-utilities", name: "Utility Bills", glyph: "Lightbulb" },
  { id: "doc-credit", name: "Credit Reports", glyph: "CreditCard" },
  { id: "doc-carloan", name: "Car Loan Statement", glyph: "CreditCard" },
  { id: "doc-proptax", name: "Property Tax Notice", glyph: "Building" },
  { id: "doc-inspection", name: "Property Inspection", glyph: "MagnifyingGlass" },
];
