// Backend-preferred document access with a bundled fallback for seed apps.
//
// The backend `documents` collection is the source of truth; when it is empty
// (unseeded database) and the application is one of the 5 seeded applications,
// the frontend falls back to the bundled snapshot in lib/data/seedDocuments.js
// so the demo still displays the borrower's documents. Backend behavior is
// unchanged — this helper only decides WHERE the client reads from.

import { apiGet } from './api';
import {
  isSeedAppId,
  isSeedDocId,
  getSeedDocuments,
  getSeedDocument,
} from './data/seedDocuments';

/**
 * Document list for an application (the shape returned by
 * GET /applications/{id}/documents). Backend preferred; bundled fallback.
 */
export async function getApplicationDocuments(applicationId) {
  const fromApi = await apiGet(`/applications/${applicationId}/documents`);
  if (Array.isArray(fromApi) && fromApi.length > 0) return fromApi;
  if (isSeedAppId(applicationId)) return getSeedDocuments(applicationId);
  return Array.isArray(fromApi) ? fromApi : [];
}

/**
 * Full document record for the DocumentViewer. Bundled seed docs resolve from
 * the snapshot (no backend call); real docs go to GET /documents/{id}/json.
 */
export async function getDocumentRecord(docId) {
  if (isSeedDocId(docId)) return getSeedDocument(docId);
  return apiGet(`/documents/${docId}/json`);
}

/**
 * PDF URL for the DocumentViewer's preview pane. Bundled seed docs return null
 * (the PDF is served only by the seeded backend); the viewer renders a graceful
 * placeholder instead of a broken <object>.
 */
export function getDocumentPdfUrl(docId) {
  if (isSeedDocId(docId)) return null;
  return `/api/backend/documents/${docId}/pdf`;
}
