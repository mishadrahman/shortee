/**
 * Cloudflare Worker for Shortee (shortee.xyz)
 * -------------------------------------------------------------
 * Features:
 * 1. Ultra-fast short link redirection
 * 2. Real-time Click & Analytics Tracking directly into Firebase Firestore:
 *    - Increments link clicks atomically
 *    - Tracks unique visitors (24-hour cookie deduplication)
 *    - Records visitor country, city, and region via Cloudflare edge geo (request.cf)
 *    - Detects Device type (Mobile, Tablet, Desktop)
 *    - Detects Browser (Chrome, Safari, Firefox, Edge, Opera, Samsung)
 *    - Detects Operating System (Android, iOS, Windows, macOS, Linux)
 *    - Detects Referrer source
 *    - Inserts detailed log into `click_events` collection
 *    - Background non-blocking execution via ctx.waitUntil()
 * 3. Dynamic Rich Social Media Previews (Open Graph / Twitter Cards):
 *    - Scrapes destination page metadata (title, image, description)
 *    - Clean title truncation (max 75 chars)
 *    - Rich card preview for WhatsApp, Facebook, Telegram, Twitter, LinkedIn
 *    - Automatically filters preview crawlers so bots don't artificially inflate human clicks
 * 4. Cache-Control: 'private, no-cache, no-store, max-age=0, must-revalidate'
 *    - Prevents Cloudflare edge and browser from caching redirects so EVERY click is counted
 */

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
  'favicon-16x16.png',
  'favicon-32x32.png',
  'apple-touch-icon.png',
  'android-chrome-192x192.png',
  'android-chrome-512x512.png',
  'site.webmanifest',
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

function decodeEntities(str) {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

const COUNTRY_NAMES = {
  BD: 'Bangladesh',
  US: 'United States',
  GB: 'United Kingdom',
  CA: 'Canada',
  AU: 'Australia',
  IN: 'India',
  PK: 'Pakistan',
  AE: 'United Arab Emirates',
  SA: 'Saudi Arabia',
  SG: 'Singapore',
  MY: 'Malaysia',
  DE: 'Germany',
  FR: 'France',
  IT: 'Italy',
  ES: 'Spain',
  NL: 'Netherlands',
  BR: 'Brazil',
  JP: 'Japan',
  KR: 'South Korea',
  CN: 'China',
  RU: 'Russia',
  TR: 'Turkey',
  ZA: 'South Africa',
  NG: 'Nigeria',
  EG: 'Egypt',
  QA: 'Qatar',
  KW: 'Kuwait',
  OM: 'Oman',
  BH: 'Bahrain',
  ID: 'Indonesia',
  PH: 'Philippines',
  VN: 'Vietnam',
  TH: 'Thailand',
  NP: 'Nepal',
  LK: 'Sri Lanka',
  SE: 'Sweden',
  NO: 'Norway',
  DK: 'Denmark',
  FI: 'Finland',
  CH: 'Switzerland',
  AT: 'Austria',
  BE: 'Belgium',
  IE: 'Ireland',
  NZ: 'New Zealand',
  MX: 'Mexico',
  AR: 'Argentina',
  CO: 'Colombia',
  CL: 'Chile',
  PE: 'Peru',
  PL: 'Poland',
  PT: 'Portugal',
  GR: 'Greece',
  RO: 'Romania',
  HU: 'Hungary',
  CZ: 'Czech Republic'
};

function getCountryName(code) {
  if (!code || code === 'XX') return 'Unknown';
  const upper = code.toUpperCase();
  if (COUNTRY_NAMES[upper]) return COUNTRY_NAMES[upper];
  try {
    const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
    const name = regionNames.of(upper);
    if (name) return name;
  } catch {}
  return upper;
}

function isBotOrCrawler(userAgent) {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();

  // Social in-app browsers are real humans clicking links
  if (/fban|fbav|fb_iab|instagram|linkedinapp|twitterandroid|twitterforiphone/i.test(ua)) {
    return false;
  }

  const botSignatures = [
    'facebookexternalhit',
    'facebot',
    'meta-externalagent',
    'facebookcatalog',
    'twitterbot',
    'linkedinbot',
    'telegrambot',
    'slackbot',
    'discordbot',
    'skypeuripreview',
    'pinterestbot',
    'googlebot',
    'bingbot',
    'yandexbot',
    'duckduckbot',
    'baiduspider',
    'whatsapp',
    'applebot',
    'crawler',
    'spider',
    'bot'
  ];

  return botSignatures.some((sig) => ua.includes(sig));
}

function parseVisitorInfo(request) {
  const userAgent = request.headers.get('user-agent') || '';
  const ua = userAgent.toLowerCase();

  // Device Type
  let deviceType = 'Desktop';
  if (/ipad|tablet|(android(?!.*mobile))/i.test(ua)) {
    deviceType = 'Tablet';
  } else if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) {
    deviceType = 'Mobile';
  }

  // Browser Name
  let browser = 'Other';
  if (/edg\//i.test(ua)) browser = 'Edge';
  else if (/opr\/|opera/i.test(ua)) browser = 'Opera';
  else if (/samsungbrowser/i.test(ua)) browser = 'Samsung Internet';
  else if (/chrome|crios/i.test(ua)) browser = 'Chrome';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
  else if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) browser = 'Safari';

  // Operating System
  let operatingSystem = 'Other OS';
  if (/windows/i.test(ua)) operatingSystem = 'Windows';
  else if (/android/i.test(ua)) operatingSystem = 'Android';
  else if (/iphone|ipad|ipod/i.test(ua)) operatingSystem = 'iOS';
  else if (/mac os|macintosh/i.test(ua)) operatingSystem = 'macOS';
  else if (/linux/i.test(ua)) operatingSystem = 'Linux';
  else if (/cros/i.test(ua)) operatingSystem = 'Chrome OS';

  // Referrer source
  let referrer = request.headers.get('referer') || '';
  if (!referrer || referrer === 'null') {
    referrer = 'Direct / None';
  } else {
    try {
      const refUrl = new URL(referrer);
      referrer = refUrl.hostname.replace(/^www\./, '');
    } catch {}
  }

  // Cloudflare Geo detection
  const cf = request.cf || {};
  const countryCode = cf.country || 'XX';
  const country = getCountryName(countryCode);
  const city = cf.city || null;

  return {
    deviceType,
    browser,
    operatingSystem,
    referrer,
    country,
    countryCode,
    city
  };
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

      const doc = data[0].document;
      const fields = doc.fields || {};
      const docId = doc.name ? doc.name.split('/').pop() : cleanCode;

      return {
        id: docId,
        userId: fields.userId?.stringValue || 'guest',
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

async function recordClickToFirestore(link, visitorInfo, isUnique, visitorId) {
  if (!link || !link.id) return;

  const now = new Date().toISOString();
  const sanitizedCountry = (visitorInfo.country || 'Unknown')
    .replace(/[\.\$\[\]\#\/]/g, '_')
    .trim() || 'Unknown';

  // 1. Prepare atomic transform for links document
  const fieldTransforms = [
    {
      fieldPath: 'clicks',
      increment: { integerValue: '1' }
    },
    {
      fieldPath: `countries.${sanitizedCountry}`,
      increment: { integerValue: '1' }
    }
  ];

  if (isUnique) {
    fieldTransforms.push({
      fieldPath: 'uniqueVisitors',
      increment: { integerValue: '1' }
    });
  }

  const commitPayload = {
    writes: [
      {
        update: {
          name: `projects/${FIREBASE_PROJECT_ID}/databases/${FIREBASE_DB_ID}/documents/links/${link.id}`,
          fields: {
            updatedAt: { stringValue: now }
          }
        },
        updateMask: { fieldPaths: ['updatedAt'] }
      },
      {
        transform: {
          document: `projects/${FIREBASE_PROJECT_ID}/databases/${FIREBASE_DB_ID}/documents/links/${link.id}`,
          fieldTransforms
        }
      }
    ]
  };

  // 2. Prepare detailed click event log
  const eventFields = {
    linkId: { stringValue: String(link.id) },
    shortCode: { stringValue: String(link.shortCode) },
    userId: { stringValue: String(link.userId || 'guest') },
    linkTitle: { stringValue: String(link.title || link.shortCode || 'Short Link') },
    timestamp: { stringValue: now },
    referrer: { stringValue: String(visitorInfo.referrer || 'Direct / None') },
    deviceType: { stringValue: String(visitorInfo.deviceType || 'Desktop') },
    browser: { stringValue: String(visitorInfo.browser || 'Other') },
    operatingSystem: { stringValue: String(visitorInfo.operatingSystem || 'Other OS') },
    country: { stringValue: String(visitorInfo.country || 'Unknown') },
    countryCode: { stringValue: String(visitorInfo.countryCode || 'XX') },
    isUnique: { booleanValue: Boolean(isUnique) },
    visitorId: { stringValue: String(visitorId || 'anon') }
  };

  if (visitorInfo.city) {
    eventFields.city = { stringValue: String(visitorInfo.city) };
  }

  const eventPayload = { fields: eventFields };

  try {
    await Promise.allSettled([
      fetch(`${FIRESTORE_API_URL}:commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(commitPayload)
      }),
      fetch(`${FIRESTORE_API_URL}/click_events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventPayload)
      })
    ]);
  } catch (err) {
    console.error('Failed to record click in Firestore:', err);
  }
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
    const rawTitle = getMeta('og:title') || getMeta('twitter:title') || (titleMatch ? titleMatch[1] : '');
    const rawDesc = getMeta('og:description') || getMeta('twitter:description') || getMeta('description') || '';
    const image = getMeta('og:image:secure_url') || getMeta('og:image') || getMeta('twitter:image') || '';
    const rawSiteName = getMeta('og:site_name') || '';

    return {
      title: decodeEntities(rawTitle),
      description: decodeEntities(rawDesc),
      image: image.trim(),
      siteName: decodeEntities(rawSiteName),
    };
  } catch (e) {
    return {};
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.slice(1);
    const shortCode = path.split('/')[0];

    // If reserved route or asset request, pass through
    if (!shortCode || RESERVED_ROUTES.has(shortCode.toLowerCase()) || shortCode.includes('.') || shortCode.startsWith('@')) {
      return fetch(request);
    }

    const link = await getLinkFromFirestore(shortCode);

    if (!link || !link.originalUrl) {
      return fetch(request);
    }

    // Password protected links pass through to web app for password verification
    if (link.isPasswordProtected || (link.password && link.password.trim())) {
      return fetch(request);
    }

    // Paused or expired links pass through to web app for proper alert screens
    if (link.isActive === false || (link.expiresAt && new Date(link.expiresAt).getTime() <= Date.now())) {
      return fetch(request);
    }

    // Determine visitor uniqueness and ID
    const cookieHeader = request.headers.get('cookie') || '';
    const linkCookieName = `shortee_v_${link.id}`;
    const isUnique = !cookieHeader.includes(linkCookieName);

    let visitorId = '';
    const vMatch = cookieHeader.match(/shortee_vid=([a-zA-Z0-9_-]+)/);
    if (vMatch && vMatch[1]) {
      visitorId = vMatch[1];
    } else {
      visitorId = 'cf_' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
    }

    // Check if request is from automated crawler bot
    const userAgent = request.headers.get('user-agent') || '';
    const isBot = isBotOrCrawler(userAgent);

    // If it is a real human user, record click and analytics in Firestore!
    if (!isBot) {
      const visitorInfo = parseVisitorInfo(request);
      const trackingPromise = recordClickToFirestore(link, visitorInfo, isUnique, visitorId);
      if (ctx && typeof ctx.waitUntil === 'function') {
        ctx.waitUntil(trackingPromise);
      } else {
        await trackingPromise;
      }
    }

    // Build Social Media Preview & OpenGraph Metadata
    let ogTitle = link.ogTitle || link.title || '';
    let ogDescription = link.ogDescription || '';
    let ogImage = link.ogImage || '';
    let ogSiteName = link.ogSiteName || '';

    const isDomainFallback = (str) => {
      if (!str || !str.trim()) return true;
      const t = str.trim().toLowerCase();
      try {
        const host = new URL(link.originalUrl).hostname.replace(/^www\./, '').toLowerCase();
        if (t === host || t.includes(host)) return true;
      } catch {}
      return /\.(com|xyz|net|org|co|io|site|shop|store|online|tech|edu|gov|bd)\b/i.test(t);
    };

    // Scrape destination webpage to fetch real product/article title and image
    const scraped = await scrapeMetadata(link.originalUrl);

    if (scraped.title && (isDomainFallback(ogTitle) || !ogTitle)) {
      ogTitle = scraped.title;
    } else if (!ogTitle) {
      ogTitle = link.title || scraped.title || '';
    }

    if (scraped.image && !ogImage) {
      ogImage = scraped.image;
    }
    if (scraped.description && (!ogDescription || isDomainFallback(ogDescription))) {
      ogDescription = scraped.description;
    }
    if (scraped.siteName && !ogSiteName) {
      ogSiteName = scraped.siteName;
    }

    if (!ogSiteName) {
      try {
        ogSiteName = new URL(link.originalUrl).hostname.replace(/^www\./, '');
      } catch {
        ogSiteName = 'shortee.xyz';
      }
    }

    const MAX_TITLE_LENGTH = 75;
    const MAX_DESC_LENGTH = 150;

    if (ogTitle && ogTitle.length > MAX_TITLE_LENGTH) {
      ogTitle = ogTitle.slice(0, MAX_TITLE_LENGTH - 3).trim() + '...';
    }
    if (ogDescription && ogDescription.length > MAX_DESC_LENGTH) {
      ogDescription = ogDescription.slice(0, MAX_DESC_LENGTH - 3).trim() + '...';
    }

    const destination = link.originalUrl;
    const finalTitle = ogTitle || ogSiteName || destination;
    const finalDesc = ogDescription || `Access ${ogSiteName || destination} via Shortee.`;

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
  <script>
    setTimeout(function() {
      window.location.href = ${JSON.stringify(destination)};
    }, 150);
  </script>
</body>
</html>`;

    const headers = new Headers({
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-cache, no-store, max-age=0, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    if (isUnique) {
      headers.append('Set-Cookie', `${linkCookieName}=1; Path=/; Max-Age=86400; SameSite=Lax`);
    }
    if (!vMatch) {
      headers.append('Set-Cookie', `shortee_vid=${visitorId}; Path=/; Max-Age=31536000; SameSite=Lax`);
    }

    return new Response(html, { headers });
  }
};
