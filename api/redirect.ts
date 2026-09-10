import type { Request, Response } from 'express';

const FIREBASE_PROJECT_ID = 'gen-lang-client-0384720479';
const FIREBASE_DB_ID = 'ai-studio-c657f4f0-89dc-4d68-9b8a-b0bfe6217191';
const FIRESTORE_API_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/${FIREBASE_DB_ID}/documents`;

function escapeHtml(str: string): string {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

export default async function handler(req: any, res: any) {
  const code = (req.query.code || req.query.shortCode || '').toString().trim();
  if (!code) {
    return res.redirect(302, '/');
  }

  try {
    const queryUrl = `${FIRESTORE_API_URL}:runQuery`;
    const firestoreRes = await fetch(queryUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'links' }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'shortCode' },
              op: 'EQUAL',
              value: { stringValue: code },
            },
          },
          limit: 1,
        },
      }),
    });

    if (!firestoreRes.ok) {
      return res.redirect(302, '/');
    }

    const data = await firestoreRes.json();
    if (!Array.isArray(data) || data.length === 0 || !data[0].document) {
      return res.redirect(302, '/');
    }

    const fields = data[0].document.fields || {};
    const originalUrl = fields.originalUrl?.stringValue;
    if (!originalUrl) {
      return res.redirect(302, '/');
    }

    const title = fields.ogTitle?.stringValue || fields.title?.stringValue || originalUrl;
    const description = fields.ogDescription?.stringValue || `Access ${originalUrl} via Shortee.`;
    const image = fields.ogImage?.stringValue || '';
    const siteName = fields.ogSiteName?.stringValue || 'Shortee';

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=60');

    return res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${escapeHtml(originalUrl)}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  ${image ? `<meta property="og:image" content="${escapeHtml(image)}">` : ''}
  ${siteName ? `<meta property="og:site_name" content="${escapeHtml(siteName)}">` : ''}
  <meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  ${image ? `<meta name="twitter:image" content="${escapeHtml(image)}">` : ''}
  <meta http-equiv="refresh" content="0;url=${escapeHtml(originalUrl)}">
  <script>window.location.replace(${JSON.stringify(originalUrl)});</script>
</head>
<body>
  <p>Redirecting to <a href="${escapeHtml(originalUrl)}">${escapeHtml(originalUrl)}</a>...</p>
</body>
</html>`);
  } catch (err) {
    return res.redirect(302, '/');
  }
}
