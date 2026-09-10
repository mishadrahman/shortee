const FIREBASE_PROJECT_ID = 'gen-lang-client-0384720479';
const FIREBASE_DB_ID = 'ai-studio-c657f4f0-89dc-4d68-9b8a-b0bfe6217191';
const FIRESTORE_API_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/${FIREBASE_DB_ID}/documents`;

const RESERVED_ROUTES = new Set([
  '',
  'api',
  'dashboard',
  'analytics',
  'login',
  'signup',
  'register',
  'settings',
  '404',
  'terms',
  'privacy',
  'about',
  'favicon.ico',
  'favicon.svg',
  'robots.txt',
  'sitemap.xml',
  'manifest.json',
  'index.html'
]);

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function getLinkFromFirestore(code) {
  const cleanCode = code.trim();
  const lowerCode = cleanCode.toLowerCase();

  const queryField = async (field, val) => {
    try {
      const res = await fetch(`${FIRESTORE_API_URL}:runQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: 'links' }],
            where: {
              fieldFilter: {
                field: { fieldPath: field },
                op: 'EQUAL',
                value: { stringValue: val }
              }
            },
            limit: 1
          }
        })
      });

      if (!res.ok) return null;
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0 || !data[0].document) return null;

      const fields = data[0].document.fields || {};
      return {
        shortCode: fields.shortCode?.stringValue || cleanCode,
        originalUrl: fields.originalUrl?.stringValue || '',
        title: fields.title?.stringValue,
        isActive: fields.isActive ? fields.isActive.booleanValue : true,
        expiresAt: fields.expiresAt?.stringValue || null,
        password: fields.password?.stringValue || null,
        isPasswordProtected: Boolean(fields.password?.stringValue || fields.isPasswordProtected?.booleanValue),
        ogTitle: fields.ogTitle?.stringValue,
        ogDescription: fields.ogDescription?.stringValue,
        ogImage: fields.ogImage?.stringValue,
        ogSiteName: fields.ogSiteName?.stringValue
      };
    } catch (e) {
      return null;
    }
  };

  const exact = await queryField('shortCode', cleanCode);
  if (exact && exact.originalUrl) return exact;

  const lower = await queryField('shortCodeLower', lowerCode);
  if (lower && lower.originalUrl) return lower;

  return null;
}

async function scrapeMetadata(targetUrl) {
  try {
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 ShorteeBot/1.0',
        'Accept': 'text/html,application/xhtml+xml'
      }
    });
    if (!res.ok) return {};

    const text = await res.text();
    const getMeta = (prop) => {
      let m = text.match(new RegExp(`<meta[^>]*?(?:property|name)=["']${prop}["'][^>]*?content=["']([^"']*)["']`, 'i'));
      if (m && m[1]) return m[1];
      m = text.match(new RegExp(`<meta[^>]*?content=["']([^"']*)["'][^>]*?(?:property|name)=["']${prop}["']`, 'i'));
      return m && m[1] ? m[1] : '';
    };

    const titleMatch = text.match(/<title[^>]*>([^<]*)<\/title>/i);
    const title = getMeta('og:title') || getMeta('twitter:title') || (titleMatch ? titleMatch[1] : '');
    const description = getMeta('og:description') || getMeta('twitter:description') || getMeta('description') || '';
    const image = getMeta('og:image:secure_url') || getMeta('og:image') || getMeta('twitter:image') || '';
    const siteName = getMeta('og:site_name') || '';

    return { title, description, image, siteName };
  } catch (e) {
    return {};
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.slice(1);
    const shortCode = path.split('/')[0];

    if (!shortCode || RESERVED_ROUTES.has(shortCode.toLowerCase()) || shortCode.includes('.') || shortCode.startsWith('@')) {
      return fetch(request);
    }

    const link = await getLinkFromFirestore(shortCode);

    if (!link || !link.originalUrl) {
      return fetch(request);
    }

    if (link.isPasswordProtected || (link.password && link.password.trim())) {
      return fetch(request);
    }

    if (link.isActive === false || (link.expiresAt && new Date(link.expiresAt).getTime() <= Date.now())) {
      return fetch(request);
    }

    let ogTitle = link.ogTitle || link.title;
    let ogDescription = link.ogDescription;
    let ogImage = link.ogImage;
    let ogSiteName = link.ogSiteName;

    if (!ogTitle || !ogImage) {
      const scraped = await scrapeMetadata(link.originalUrl);
      ogTitle = ogTitle || scraped.title;
      ogDescription = ogDescription || scraped.description;
      ogImage = ogImage || scraped.image;
      ogSiteName = ogSiteName || scraped.siteName;
    }

    const destination = link.originalUrl;
    const finalTitle = ogTitle || destination;
    const finalDesc = ogDescription || `Access ${destination} via Shortee.`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(finalTitle)}</title>
  <meta name="description" content="${escapeHtml(finalDesc)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${escapeHtml(destination)}">
  <meta property="og:title" content="${escapeHtml(finalTitle)}">
  <meta property="og:description" content="${escapeHtml(finalDesc)}">
  ${ogImage ? `<meta property="og:image" content="${escapeHtml(ogImage)}">` : ''}
  ${ogImage ? `<meta property="og:image:secure_url" content="${escapeHtml(ogImage)}">` : ''}
  ${ogSiteName ? `<meta property="og:site_name" content="${escapeHtml(ogSiteName)}">` : ''}
  <meta name="twitter:card" content="${ogImage ? 'summary_large_image' : 'summary'}">
  <meta name="twitter:title" content="${escapeHtml(finalTitle)}">
  <meta name="twitter:description" content="${escapeHtml(finalDesc)}">
  ${ogImage ? `<meta name="twitter:image" content="${escapeHtml(ogImage)}">` : ''}
  <meta http-equiv="refresh" content="0;url=${escapeHtml(destination)}">
  <link rel="canonical" href="${escapeHtml(destination)}">
  <script>window.location.replace(${JSON.stringify(destination)});</script>
</head>
<body style="background:#0f172a;color:#f8fafc;font-family:sans-serif;text-align:center;padding:50px;">
  <p>Redirecting to <a href="${escapeHtml(destination)}" style="color:#38bdf8;">${escapeHtml(destination)}</a>...</p>
</body>
</html>`;

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=60'
      }
    });
  }
};
