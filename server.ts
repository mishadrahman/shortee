import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

app.use(express.json());

// Firebase Project details from firebase-applet-config.json
const FIREBASE_PROJECT_ID = 'gen-lang-client-0384720479';
const FIREBASE_DB_ID = 'ai-studio-c657f4f0-89dc-4d68-9b8a-b0bfe6217191';
const FIRESTORE_API_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/${FIREBASE_DB_ID}/documents`;

// Known SPA and static paths that should never be intercepted as short codes
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
  'index.html',
]);

// Social preview crawlers and bot User-Agent patterns
const BOT_USER_AGENTS = [
  'facebookexternalhit',
  'facebot',
  'whatsapp',
  'twitterbot',
  'telegrambot',
  'discordbot',
  'linkedinbot',
  'slackbot',
  'slack-imgproxy',
  'applebot',
  'googlebot',
  'bingbot',
  'pinterest',
  'skypeuripreview',
  'vkshare',
  'viber',
  'meta-externalagent',
  'embedly',
  'quora link preview',
  'yahoo! slurp',
  'outbrain',
  'flipboard',
];

function isSocialCrawler(userAgent: string): boolean {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return BOT_USER_AGENTS.some((bot) => ua.includes(bot));
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&nbsp;/g, ' ');
}

/**
 * Fetch and extract Open Graph, Twitter Cards, and meta tags from a destination URL
 */
async function scrapeUrlMetadata(targetUrl: string): Promise<{
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  favicon?: string;
}> {
  try {
    const parsed = new URL(targetUrl);
    // Prevent SSRF: only allow http and https, block internal IPs
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {};
    }
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.16.') ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.local')
    ) {
      return {};
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 ShorteeBot/1.0',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
      redirect: 'follow',
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        title: parsed.hostname.replace(/^www\./, ''),
        siteName: parsed.hostname.replace(/^www\./, ''),
        favicon: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(parsed.hostname)}&sz=64`,
      };
    }

    // Read only the first 250KB of HTML to keep response times fast
    const reader = response.body?.getReader();
    let html = '';
    if (reader) {
      const decoder = new TextDecoder();
      let bytesRead = 0;
      while (bytesRead < 250000) {
        const { done, value } = await reader.read();
        if (done || !value) break;
        bytesRead += value.length;
        html += decoder.decode(value, { stream: true });
        if (html.includes('</head>')) break;
      }
      reader.cancel().catch(() => {});
    } else {
      html = await response.text();
    }

    // Extract Open Graph & Meta Tags with robust regex
    const getMeta = (propName: string): string | undefined => {
      // Check property="og:..." content="..."
      let match = html.match(
        new RegExp(`<meta[^>]*?(?:property|name)=["']${propName}["'][^>]*?content=["']([^"']*)["']`, 'i')
      );
      if (match && match[1]) return decodeHtmlEntities(match[1].trim());

      // Check content="..." property="og:..."
      match = html.match(
        new RegExp(`<meta[^>]*?content=["']([^"']*)["'][^>]*?(?:property|name)=["']${propName}["']`, 'i')
      );
      if (match && match[1]) return decodeHtmlEntities(match[1].trim());

      return undefined;
    };

    let title =
      getMeta('og:title') ||
      getMeta('twitter:title') ||
      (() => {
        const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
        return titleMatch && titleMatch[1] ? decodeHtmlEntities(titleMatch[1].trim()) : undefined;
      })() ||
      parsed.hostname.replace(/^www\./, '');

    let description =
      getMeta('og:description') ||
      getMeta('twitter:description') ||
      getMeta('description') ||
      '';

    let image = getMeta('og:image:secure_url') || getMeta('og:image') || getMeta('twitter:image');
    if (image && !image.startsWith('http://') && !image.startsWith('https://')) {
      try {
        image = new URL(image, targetUrl).href;
      } catch {}
    }

    let siteName = getMeta('og:site_name') || parsed.hostname.replace(/^www\./, '');

    // Extract Favicon
    let favicon: string | undefined;
    const iconMatch = html.match(/<link[^>]*?rel=["'](?:shortcut )?icon["'][^>]*?href=["']([^"']*)["']/i);
    if (iconMatch && iconMatch[1]) {
      favicon = iconMatch[1].trim();
      if (!favicon.startsWith('http://') && !favicon.startsWith('https://')) {
        try {
          favicon = new URL(favicon, targetUrl).href;
        } catch {
          favicon = undefined;
        }
      }
    }
    if (!favicon) {
      favicon = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(parsed.hostname)}&sz=64`;
    }

    return {
      title,
      description,
      image,
      siteName,
      favicon,
    };
  } catch (err) {
    console.warn('Scraping error for', targetUrl, err);
    try {
      const parsed = new URL(targetUrl);
      return {
        title: parsed.hostname.replace(/^www\./, ''),
        siteName: parsed.hostname.replace(/^www\./, ''),
        favicon: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(parsed.hostname)}&sz=64`,
      };
    } catch {
      return {};
    }
  }
}

/**
 * Look up a short link from Firestore by shortCode
 */
interface FirestoreLinkData {
  id: string;
  shortCode: string;
  originalUrl: string;
  title?: string;
  isActive?: boolean;
  expiresAt?: string | null;
  password?: string | null;
  isPasswordProtected?: boolean;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogSiteName?: string;
  clicks?: number;
}

async function findLinkInFirestore(code: string): Promise<FirestoreLinkData | null> {
  const cleanCode = code.trim();
  const lowerCode = cleanCode.toLowerCase();

  const runQuery = async (field: string, value: string) => {
    const queryUrl = `${FIRESTORE_API_URL}:runQuery`;
    const res = await fetch(queryUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'links' }],
          where: {
            fieldFilter: {
              field: { fieldPath: field },
              op: 'EQUAL',
              value: { stringValue: value },
            },
          },
          limit: 1,
        },
      }),
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0 || !data[0].document) {
      return null;
    }

    const doc = data[0].document;
    const fields = doc.fields || {};
    const docId = doc.name ? doc.name.split('/').pop() : '';

    return {
      id: docId,
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
      ogSiteName: fields.ogSiteName?.stringValue,
      clicks: fields.clicks?.integerValue ? parseInt(fields.clicks.integerValue, 10) : 0,
    };
  };

  try {
    // 1. Try exact match first
    const exact = await runQuery('shortCode', cleanCode);
    if (exact && exact.originalUrl) return exact;

    // 2. Try lowercase match
    const lower = await runQuery('shortCodeLower', lowerCode);
    if (lower && lower.originalUrl) return lower;
  } catch (err) {
    console.warn('Firestore query error:', err);
  }

  return null;
}

/**
 * Record click event in Firestore in the background
 */
function recordClickInBackground(link: FirestoreLinkData, req: Request) {
  if (!link.id) return;

  const now = new Date().toISOString();
  const nextClicks = (link.clicks || 0) + 1;

  // Asynchronously update link clicks and add click event
  (async () => {
    try {
      // 1. Patch clicks on the link document
      const patchUrl = `${FIRESTORE_API_URL}/links/${link.id}?updateMask.fieldPaths=clicks&updateMask.fieldPaths=updatedAt`;
      await fetch(patchUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            clicks: { integerValue: String(nextClicks) },
            updatedAt: { stringValue: now },
          },
        }),
      });

      // 2. Add click event document
      const userAgent = req.headers['user-agent'] || '';
      const isMobile = /iPhone|iPad|iPod|Android/i.test(userAgent);
      const isTablet = /iPad|Tablet/i.test(userAgent);
      const deviceType = isTablet ? 'Tablet' : isMobile ? 'Mobile' : 'Desktop';
      const referrer = req.headers['referer'] || 'Direct / None';

      const eventUrl = `${FIRESTORE_API_URL}/click_events`;
      await fetch(eventUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            linkId: { stringValue: link.id },
            shortCode: { stringValue: link.shortCode },
            linkTitle: { stringValue: link.title || 'Untitled Link' },
            timestamp: { stringValue: now },
            referrer: { stringValue: String(referrer) },
            deviceType: { stringValue: deviceType },
            browser: { stringValue: 'Web Browser' },
            isUnique: { booleanValue: true },
          },
        }),
      });
    } catch (err) {
      // Non-blocking background analytics
    }
  })().catch(() => {});
}

// ----------------------------------------------------
// 1. Health API Route
// ----------------------------------------------------
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ----------------------------------------------------
// 2. Open Graph Metadata Extraction Proxy API Route
// ----------------------------------------------------
app.get('/api/preview-meta', async (req: Request, res: Response) => {
  const targetUrl = req.query.url;
  if (!targetUrl || typeof targetUrl !== 'string') {
    res.status(400).json({ error: 'Target URL is required' });
    return;
  }

  const meta = await scrapeUrlMetadata(targetUrl);
  res.json({
    success: true,
    ...meta,
    url: targetUrl,
  });
});

// ----------------------------------------------------
// 3. Short Link Social Preview & Redirection Handler
// ----------------------------------------------------
app.get('/:shortCode', async (req: Request, res: Response, next: NextFunction) => {
  const { shortCode } = req.params;

  // Skip reserved routes, API endpoints, and files with extensions (e.g. bundle.js, style.css)
  if (RESERVED_ROUTES.has(shortCode.toLowerCase()) || shortCode.includes('.') || shortCode.startsWith('@')) {
    return next();
  }

  const userAgent = req.headers['user-agent'] || '';
  const isCrawler = isSocialCrawler(userAgent);

  try {
    const link = await findLinkInFirestore(shortCode);

    if (!link || !link.originalUrl) {
      // Link not found, pass to SPA router to render 404 page
      return next();
    }

    // 1. Check if link is paused
    if (link.isActive === false) {
      res.status(403).send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Link Paused | Shortee</title>
          <style>
            body { margin:0; padding:2rem; background:#0f172a; color:#f8fafc; font-family:system-ui,-apple-system,sans-serif; display:flex; align-items:center; justify-content:center; min-height:100vh; }
            .card { max-width:440px; text-align:center; padding:2.5rem; background:#1e293b; border-radius:16px; border:1px solid #334155; }
            h1 { font-size:1.25rem; margin-bottom:0.5rem; color:#f59e0b; }
            p { font-size:0.875rem; color:#94a3b8; line-height:1.6; }
            a { display:inline-block; margin-top:1.5rem; padding:0.6rem 1.25rem; background:#334155; color:#fff; text-decoration:none; border-radius:8px; font-size:0.875rem; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Link Paused</h1>
            <p>This shortened link has been temporarily paused by its creator and is not accepting visitors.</p>
            <a href="/">Go to Shortee Homepage</a>
          </div>
        </body>
        </html>
      `);
      return;
    }

    // 2. Check if link is expired
    if (link.expiresAt && new Date(link.expiresAt).getTime() <= Date.now()) {
      res.status(410).send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Link Expired | Shortee</title>
          <style>
            body { margin:0; padding:2rem; background:#0f172a; color:#f8fafc; font-family:system-ui,-apple-system,sans-serif; display:flex; align-items:center; justify-content:center; min-height:100vh; }
            .card { max-width:440px; text-align:center; padding:2.5rem; background:#1e293b; border-radius:16px; border:1px solid #334155; }
            h1 { font-size:1.25rem; margin-bottom:0.5rem; color:#f43f5e; }
            p { font-size:0.875rem; color:#94a3b8; line-height:1.6; }
            a { display:inline-block; margin-top:1.5rem; padding:0.6rem 1.25rem; background:#334155; color:#fff; text-decoration:none; border-radius:8px; font-size:0.875rem; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Link Expired</h1>
            <p>This shortened link has expired and is no longer available.</p>
            <a href="/">Go to Shortee Homepage</a>
          </div>
        </body>
        </html>
      `);
      return;
    }

    // 3. Check if password protected
    if (link.isPasswordProtected || (link.password && link.password.trim())) {
      // For password-protected links:
      // If crawler: do NOT leak the destination URL's sensitive preview!
      if (isCrawler) {
        res.send(`
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <title>🔒 Protected Link | Shortee</title>
            <meta name="description" content="This short link is password-protected. Enter the passcode to proceed.">
            <meta property="og:title" content="🔒 Protected Link | Shortee">
            <meta property="og:description" content="This link is password-protected. Enter the passcode to access the destination.">
            <meta property="og:site_name" content="Shortee">
            <meta name="twitter:card" content="summary">
          </head>
          <body style="background:#0f172a;color:#f8fafc;font-family:system-ui,-apple-system,sans-serif;text-align:center;padding:3rem;">
            <h2>Protected Link</h2>
            <p>Enter the passcode to view this link.</p>
          </body>
          </html>
        `);
        return;
      }

      // If human browser: pass through to SPA React router so RedirectHandler displays the password input modal!
      return next();
    }

    // 4. Standard (Unprotected) Short Link:
    // User goal: "Jeno share krle destination er url er preview ta dekhay"
    // Extract Destination Metadata (cached or on-the-fly)
    let ogTitle = link.ogTitle || link.title;
    let ogDescription = link.ogDescription;
    let ogImage = link.ogImage;
    let ogSiteName = link.ogSiteName;

    // If metadata was not cached on link creation, scrape it on the fly
    if (!ogTitle || !ogImage || !ogDescription) {
      const scraped = await scrapeUrlMetadata(link.originalUrl);
      ogTitle = ogTitle || scraped.title;
      ogDescription = ogDescription || scraped.description;
      ogImage = ogImage || scraped.image;
      ogSiteName = ogSiteName || scraped.siteName;
    }

    const destinationUrl = link.originalUrl;
    const finalTitle = ogTitle || destinationUrl;
    const finalDesc = ogDescription || `Access ${destinationUrl} securely via Shortee.`;

    // Asynchronously record click analytics (only for real visitors, deduplicated from social bots)
    if (!isCrawler) {
      recordClickInBackground(link, req);
    }

    // Return HTML with dynamic Destination Open Graph / Twitter Card tags!
    // Both social bots (WhatsApp, Facebook, Discord, etc.) and direct clicking visitors
    // receive the rich metadata, and visitors are immediately redirected via JS and meta refresh!
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${escapeHtml(finalTitle)}</title>
        <meta name="description" content="${escapeHtml(finalDesc)}">

        <!-- Open Graph / Facebook / WhatsApp / LinkedIn / Discord -->
        <meta property="og:type" content="website">
        <meta property="og:url" content="${escapeHtml(destinationUrl)}">
        <meta property="og:title" content="${escapeHtml(finalTitle)}">
        <meta property="og:description" content="${escapeHtml(finalDesc)}">
        ${ogImage ? `<meta property="og:image" content="${escapeHtml(ogImage)}">` : ''}
        ${ogImage ? `<meta property="og:image:secure_url" content="${escapeHtml(ogImage)}">` : ''}
        ${ogImage ? `<meta property="og:image:alt" content="${escapeHtml(finalTitle)}">` : ''}
        ${ogSiteName ? `<meta property="og:site_name" content="${escapeHtml(ogSiteName)}">` : ''}

        <!-- Twitter Cards -->
        <meta name="twitter:card" content="${ogImage ? 'summary_large_image' : 'summary'}">
        <meta name="twitter:title" content="${escapeHtml(finalTitle)}">
        <meta name="twitter:description" content="${escapeHtml(finalDesc)}">
        ${ogImage ? `<meta name="twitter:image" content="${escapeHtml(ogImage)}">` : ''}

        <!-- Instant Redirection for human visitors -->
        <meta http-equiv="refresh" content="0;url=${escapeHtml(destinationUrl)}">
        <link rel="canonical" href="${escapeHtml(destinationUrl)}">
        <script>
          window.location.replace(${JSON.stringify(destinationUrl)});
        </script>
      </head>
      <body style="margin:0;padding:0;background:#0b0f19;color:#f1f5f9;font-family:system-ui,-apple-system,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;">
        <div style="max-width:440px;margin:20px;padding:32px;background:#131b2e;border:1px solid #1e293b;border-radius:16px;text-align:center;box-shadow:0 10px 25px -5px rgba(0,0,0,0.5);">
          ${
            ogImage
              ? `<img src="${escapeHtml(ogImage)}" alt="Preview" style="width:100%;height:180px;object-fit:cover;border-radius:10px;margin-bottom:20px;background:#1e293b;" onerror="this.style.display='none'" />`
              : ''
          }
          <p style="font-size:12px;color:#94a3b8;margin:0 0 8px 0;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Redirecting...</p>
          <h1 style="font-size:17px;line-height:1.4;margin:0 0 12px 0;color:#f8fafc;word-break:break-word;">${escapeHtml(finalTitle)}</h1>
          ${
            ogDescription
              ? `<p style="font-size:13px;line-height:1.5;color:#94a3b8;margin:0 0 20px 0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${escapeHtml(ogDescription)}</p>`
              : ''
          }
          <a href="${escapeHtml(destinationUrl)}" style="display:inline-block;padding:10px 24px;background:#3b82f6;color:#ffffff;text-decoration:none;border-radius:8px;font-size:13px;font-weight:600;">Continue to Destination &rarr;</a>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    console.error('Error handling short link:', err);
    next();
  }
});

// ----------------------------------------------------
// 4. Vite Dev Server / Production Static Serving
// ----------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
