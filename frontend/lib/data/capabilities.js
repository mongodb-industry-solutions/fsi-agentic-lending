export const CAPABILITIES = [
  {
    id: "document",
    glyph: "File",
    label: "Document Model",
    colorVar: "mongo",
    oneLiner:
      "Store loan applications, extracted fields, embeddings, and validation in one document.",
    replaces: "Relational database",
    description:
      "Store loan applications, extracted document fields, embeddings, and validation results in a single flexible document. No rigid table schemas, no JOIN sprawl, no ETL. Schema flexibility for evolving data sources.",
    code: `db.loanApplications.insertOne({
  _id: "APP-2026-00001",
  borrower: { name: "Marcus Delgado", income: 222700 },
  documents: [
    { type: "CRA_NOA", status: "verified", embeddingId: "emb_..." }
  ],
  riskScore: 72,
  status: "underwriting"
})`,
    demoScene:
      "Scene 1: Application received — Document Model insert + Change Stream trigger.",
  },
  {
    id: "aggregation",
    glyph: "Charts",
    label: "Aggregation Framework",
    colorVar: "agent-cyan",
    oneLiner: "Real-time risk scoring in a single pipeline execution.",
    replaces: "Batch ETL + separate analytics database",
    description:
      "Real-time risk scoring in a single pipeline execution. $lookup credit data, $addFields DTI calculation, $setWindowFields rolling 90-day payment average, $switch risk tiering, $group factor aggregation, $merge materialized view.",
    code: `db.riskScores.aggregate([
  { $lookup: { from: "creditReports", ... } },
  { $addFields: { dti: { $divide: ["$debt", "$income"] } } },
  { $setWindowFields: { output: { rolling90: { $avg: "$payment" } } } },
  { $switch: { branches: [/* tier logic */] } },
  { $group: { _id: "$applicantId", score: { $sum: "$points" } } },
  { $merge: { into: "riskScores", whenMatched: "merge" } }
])`,
    demoScene:
      "Scene 1: Underwriting Agent runs risk scoring pipeline via aggregation.",
  },
  {
    id: "changeStreams",
    glyph: "Visibility",
    label: "Change Streams",
    colorVar: "success",
    oneLiner: "Turn MongoDB into a real-time event engine.",
    replaces: "Message queue + event streaming platform",
    description:
      "watch() with pipeline filters. Resume token mechanism for fault tolerance. Atlas Stream Processing for tumbling/session windows.",
    code: `const changeStream = db.loanApplications.watch([
  { $match: { "fullDocument.status": "documents_complete" } }
]);
changeStream.on("change", (event) => {
  triggerUnderwriting(event.fullDocument._id);
});`,
    demoScene:
      "Scene 1: Underwriting triggered on status change; real-time activity streaming to borrower and officer portals.",
  },
  {
    id: "timeSeries",
    glyph: "TimeSeries",
    label: "$setWindowFields",
    colorVar: "voyage",
    oneLiner:
      "Rolling-window analytics on the payments data you already store.",
    replaces: "A separate payments/analytics store",
    description:
      "An Aggregation Framework stage that computes rolling windows over the payments collection — 90-day delinquency rates, payment trend derivatives, moving averages — right next to the loans they belong to, no separate columnar or analytics store. Windowed metrics flow straight into Early Warning System signals.",
    code: `db.payments.insertOne({
  metadata: { loanId: "L-00001", borrowerId: "B-...", productType: "5yr_fixed" },
  amount: 4047,
  principal: 1240,
  interest: 2852,
  outstandingBalance: 698760,
  daysLate: 0,
  timestamp: new Date()
})`,
    demoScene:
      "Scene 1 & 6: 36-month payment history; rolling 90-day delinquency.",
  },
  {
    id: "vectorSearch",
    glyph: "MagnifyingGlass",
    label: "Atlas Vector Search",
    colorVar: "voyage",
    oneLiner:
      "Semantic search, RAG, and similarity matching natively in MongoDB.",
    replaces: "Standalone vector database",
    description:
      "Paired with voyage-multimodal-3.5: policy lookup by meaning, similar borrower profiling, fraud pattern detection. Sub-15ms across 10M+ documents.",
    code: `db.policies.aggregate([
  { $vectorSearch: {
    index: "policy_embed",
    path: "embedding",
    queryVector: embedding,
    numCandidates: 100,
    limit: 5,
    filter: { docType: "underwriting_guideline" }
  }}
])`,
    demoScene:
      "Scene 1 & 2: Policy RAG for underwriting; similar borrower profiles.",
  },
];
