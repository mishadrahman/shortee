export const RESERVED_ROUTES = new Set([
  'shortee',
  'dashboard',
  'login',
  'signup',
  'forgot-password',
  'auth',
  'settings',
  'analytics',
  'links',
  'api',
  '404',
  'terms',
  'privacy',
  'about',
  'pricing',
  'profile',
  'admin'
]);

/**
 * Validates a long URL according to requirements:
 * Only allow http:// and https://.
 * Reject javascript:, data:, file:, vbscript:, malformed URLs.
 */
export function validateLongUrl(input: string): { valid: boolean; error?: string; cleanUrl?: string } {
  if (!input || !input.trim()) {
    return { valid: false, error: 'Please enter a URL to shorten.' };
  }

  const trimmed = input.trim();
  const lower = trimmed.toLowerCase();

  // Reject dangerous or non-web schemes
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('file:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('blob:')
  ) {
    return { valid: false, error: 'Protocol not allowed. Only HTTP and HTTPS URLs are supported.' };
  }

  if (!lower.startsWith('http://') && !lower.startsWith('https://')) {
    return {
      valid: false,
      error: 'URL must begin with http:// or https:// (e.g., https://example.com)'
    };
  }

  try {
    const parsed = new URL(trimmed);

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { valid: false, error: 'Only http:// and https:// protocols are permitted.' };
    }

    if (!parsed.hostname || !parsed.hostname.includes('.')) {
      return { valid: false, error: 'Please enter a valid domain name (e.g., https://example.com).' };
    }

    // Guard against recursion / shortening our own short URLs
    if (typeof window !== 'undefined' && parsed.host === window.location.host) {
      return { valid: false, error: 'Cannot shorten links pointing to this shortener domain.' };
    }

    return { valid: true, cleanUrl: parsed.href };
  } catch {
    return { valid: false, error: 'Malformed URL. Please enter a valid, complete web address.' };
  }
}

/**
 * Generates a random 6-character alphanumeric code
 */
export function generateRandomShortCode(length = 6): string {
  const characters = '23456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ'; // excluding ambiguous chars like 0/O, 1/l/I
  let result = '';
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

/**
 * Validates custom alias format and reserved words
 */
export function validateCustomAlias(alias: string): { valid: boolean; error?: string; cleanAlias?: string } {
  const trimmed = alias.trim();
  if (!trimmed) {
    return { valid: true, cleanAlias: '' };
  }

  if (trimmed.length < 3 || trimmed.length > 32) {
    return { valid: false, error: 'Custom alias must be between 3 and 32 characters.' };
  }

  const aliasRegex = /^[a-zA-Z0-9_-]+$/;
  if (!aliasRegex.test(trimmed)) {
    return { valid: false, error: 'Alias can only contain letters, numbers, hyphens, and underscores.' };
  }

  if (RESERVED_ROUTES.has(trimmed.toLowerCase())) {
    return { valid: false, error: `"${trimmed}" is a reserved system path. Please choose a different alias.` };
  }

  return { valid: true, cleanAlias: trimmed };
}

export const DEFAULT_BRAND_DOMAIN = 'shortee.xyz';

/**
 * Builds the full short URL.
 * If useBrandDomain is true or when on custom domain, formats with shortee.xyz.
 * By default in browser, works seamlessly both on current origin and shortee.xyz.
 */
export function buildShortUrl(shortCode: string, displayOnly = false): string {
  if (displayOnly) {
    return `https://${DEFAULT_BRAND_DOMAIN}/${shortCode}`;
  }
  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    const hostname = window.location.hostname;
    // If hosted on username.github.io/repo-name, preserve the repo subpath for valid clickability
    if (hostname.endsWith('.github.io')) {
      const firstSegment = window.location.pathname.split('/').filter(Boolean)[0];
      if (firstSegment) {
        return `${origin}/${firstSegment}/${shortCode}`;
      }
    }
    return `${origin}/${shortCode}`;
  }
  return `https://${DEFAULT_BRAND_DOMAIN}/${shortCode}`;
}

export function getDisplayShortUrl(shortCode: string): string {
  return `${DEFAULT_BRAND_DOMAIN}/${shortCode}`;
}

/**
 * Safely parse device type from client without fingerprinting
 */
export function getSafeDeviceType(): 'Desktop' | 'Mobile' | 'Tablet' {
  if (typeof window === 'undefined') return 'Desktop';
  const ua = navigator.userAgent.toLowerCase();
  if (/ipad|tablet|(android(?!.*mobile))/i.test(ua)) {
    return 'Tablet';
  }
  if (/mobile|iphone|ipod|blackberry|opera mini|iemobile|wpdesktop/i.test(ua)) {
    return 'Mobile';
  }
  return 'Desktop';
}

/**
 * Safely parse browser name from user agent, prioritizing in-app browsers
 */
export function getSafeBrowserName(): string {
  if (typeof window === 'undefined') return 'Other';
  const ua = navigator.userAgent || '';
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return 'Facebook In-App';
  if (/Instagram/i.test(ua)) return 'Instagram';
  if (/LinkedInApp/i.test(ua)) return 'LinkedIn';
  if (/Twitter|TwitterAndroid|TwitterforiPhone/i.test(ua)) return 'Twitter';
  if (/TikTok/i.test(ua)) return 'TikTok';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('SamsungBrowser')) return 'Samsung Internet';
  if (ua.includes('Opera') || ua.includes('OPR')) return 'Opera';
  if (ua.includes('Edge') || ua.includes('Edg')) return 'Edge';
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Safari')) return 'Safari';
  return 'Other';
}

/**
 * Safely parse Operating System from User Agent
 */
export function getSafeOS(): string {
  if (typeof window === 'undefined') return 'Unknown OS';
  const ua = navigator.userAgent;
  if (/windows nt 10/i.test(ua)) return 'Windows 10/11';
  if (/windows/i.test(ua)) return 'Windows';
  if (/macintosh|mac os x/i.test(ua)) return 'macOS';
  if (/iphone|ipad|ipod/i.test(ua)) return 'iOS';
  if (/android/i.test(ua)) return 'Android';
  if (/linux/i.test(ua)) return 'Linux';
  return 'Other OS';
}

/**
 * Clean human-readable referrer with in-app scheme detection
 */
export function getSafeReferrer(): string {
  if (typeof document === 'undefined') return 'Direct / None';
  const ref = document.referrer || '';
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';

  if (/android-app:\/\/com\.facebook/i.test(ref) || /FBAN|FBAV|FB_IAB/i.test(ua)) {
    return 'Facebook';
  }
  if (/android-app:\/\/com\.instagram/i.test(ref) || /Instagram/i.test(ua)) {
    return 'Instagram';
  }
  if (/android-app:\/\/com\.twitter/i.test(ref)) {
    return 'X / Twitter';
  }
  if (/android-app:\/\/com\.whatsapp/i.test(ref)) {
    return 'WhatsApp';
  }
  if (/android-app:\/\/com\.linkedin/i.test(ref)) {
    return 'LinkedIn';
  }

  if (!ref) {
    return 'Direct / None';
  }

  try {
    const refUrl = new URL(ref);
    const host = refUrl.hostname.toLowerCase();
    if (host.includes('google.')) return 'Google Search';
    if (host.includes('twitter.com') || host.includes('x.com') || host.includes('t.co')) return 'X / Twitter';
    if (host.includes('linkedin.com')) return 'LinkedIn';
    if (host.includes('facebook.com') || host.includes('fb.me') || host.includes('l.facebook.com') || host.includes('lm.facebook.com')) return 'Facebook';
    if (host.includes('reddit.com')) return 'Reddit';
    if (host.includes('youtube.com') || host.includes('youtu.be')) return 'YouTube';
    if (host.includes('github.com')) return 'GitHub';
    if (host.includes('instagram.com')) return 'Instagram';
    if (host.includes('whatsapp.com')) return 'WhatsApp';
    return host;
  } catch {
    return 'Direct / Other';
  }
}

/**
 * Get or create an anonymous visitor identifier stored locally.
 * Respects privacy: random UUID-like string, not tied to personal identity.
 */
export function getOrCreateVisitorId(): string {
  if (typeof window === 'undefined') return 'server-visitor';
  try {
    const key = 'shortee_anon_vid';
    let vid = localStorage.getItem(key);
    if (!vid) {
      vid = 'v_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
      localStorage.setItem(key, vid);
    }
    return vid;
  } catch {
    return 'anon_' + Math.random().toString(36).substring(2, 10);
  }
}

/**
 * Checks if current visitor is an automated bot, preview crawler, or web scraper.
 * Standard URL shortener filter (e.g., Bitly, Dub): prevents preview bots and automated crawlers
 * from inflating human click analytics, while ensuring all human social clicks (Facebook in-app, etc.) pass.
 */
export function isBotOrCrawler(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;

  const ua = (navigator.userAgent || '').toLowerCase();

  // If this is a real user in Facebook, Instagram, Twitter, or LinkedIn in-app browser, it is ALWAYS a real human visit!
  if (/fban|fbav|fb_iab|instagram|linkedinapp|twitterandroid|twitterforiphone/i.test(ua)) {
    return false;
  }

  // Check automated headless test environments only when not in standard browser
  if (navigator.webdriver && !(window as any).chrome) {
    return true;
  }

  // Specific crawler & preview bot signatures
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
    'baiduspider',
    'duckduckbot',
    'applebot',
    'headlesschrome',
    'phantomjs',
    'bytespider',
    'petalbot',
    'semrushbot',
    'ahrefsbot',
    'mj12bot',
    'crawler',
    'spider',
    'scraper',
    'bot/',
    '/bot',
    '+http://',
    '+https://',
  ];

  return botSignatures.some((signature) => ua.includes(signature));
}

/**
 * Rapid repeat click deduplication for the same visitor/session.
 * Prevents double-counting from single-page re-renders while ensuring distinct user visits are counted.
 * Cooldown: 4 seconds.
 */
export function isSessionDuplicateClick(linkId: string, cooldownSeconds = 4): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const sessionKey = `shortee_session_hit_${linkId}`;
    const now = Date.now();
    const cooldownMs = cooldownSeconds * 1000;

    // Check sessionStorage (per tab / session)
    const sessionHit = sessionStorage.getItem(sessionKey);
    if (sessionHit) {
      const lastSessionTime = parseInt(sessionHit, 10);
      if (!isNaN(lastSessionTime) && now - lastSessionTime < cooldownMs) {
        return true;
      }
    }

    sessionStorage.setItem(sessionKey, now.toString());
    return false;
  } catch {
    return false;
  }
}

/**
 * Checks if this visitor has clicked this specific short link within the last 24 hours.
 * Returns true if this is a Unique Visit (first time or >24h elapsed).
 * Returns false if repeat click within 24 hours (cooldown).
 */
export function checkAndRecordUniqueVisit(linkId: string): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const storageKey = `shortee_last_visit_${linkId}`;
    const lastVisitStr = localStorage.getItem(storageKey);
    const now = Date.now();
    const COOLDOWN_24H = 24 * 60 * 60 * 1000;

    if (lastVisitStr) {
      const lastVisitTime = parseInt(lastVisitStr, 10);
      if (!isNaN(lastVisitTime) && now - lastVisitTime < COOLDOWN_24H) {
        // Repeat visit within 24h window
        return false;
      }
    }

    // First time or cooldown expired
    localStorage.setItem(storageKey, now.toString());
    return true;
  } catch {
    return true;
  }
}

/**
 * Builds a URL with UTM Campaign Parameters
 */
export function buildUtmUrl(
  baseUrl: string,
  params: {
    source?: string;
    medium?: string;
    campaign?: string;
    term?: string;
    content?: string;
  }
): string {
  if (!baseUrl.trim()) return baseUrl;
  try {
    const parsed = new URL(baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`);
    if (params.source?.trim()) parsed.searchParams.set('utm_source', params.source.trim());
    if (params.medium?.trim()) parsed.searchParams.set('utm_medium', params.medium.trim());
    if (params.campaign?.trim()) parsed.searchParams.set('utm_campaign', params.campaign.trim());
    if (params.term?.trim()) parsed.searchParams.set('utm_term', params.term.trim());
    if (params.content?.trim()) parsed.searchParams.set('utm_content', params.content.trim());
    return parsed.href;
  } catch {
    return baseUrl;
  }
}

/**
 * Common timezone prefix to Country & Code mapping for instantaneous offline/fallback geo detection
 */
const TIMEZONE_COUNTRY_MAP: Record<string, { country: string; code: string }> = {
  // Asia
  'Asia/Dhaka': { country: 'Bangladesh', code: 'BD' },
  'Asia/Kolkata': { country: 'India', code: 'IN' },
  'Asia/Calcutta': { country: 'India', code: 'IN' },
  'Asia/Karachi': { country: 'Pakistan', code: 'PK' },
  'Asia/Colombo': { country: 'Sri Lanka', code: 'LK' },
  'Asia/Kathmandu': { country: 'Nepal', code: 'NP' },
  'Asia/Dubai': { country: 'United Arab Emirates', code: 'AE' },
  'Asia/Riyadh': { country: 'Saudi Arabia', code: 'SA' },
  'Asia/Qatar': { country: 'Qatar', code: 'QA' },
  'Asia/Kuwait': { country: 'Kuwait', code: 'KW' },
  'Asia/Singapore': { country: 'Singapore', code: 'SG' },
  'Asia/Kuala_Lumpur': { country: 'Malaysia', code: 'MY' },
  'Asia/Bangkok': { country: 'Thailand', code: 'TH' },
  'Asia/Jakarta': { country: 'Indonesia', code: 'ID' },
  'Asia/Manila': { country: 'Philippines', code: 'PH' },
  'Asia/Ho_Chi_Minh': { country: 'Vietnam', code: 'VN' },
  'Asia/Hong_Kong': { country: 'Hong Kong', code: 'HK' },
  'Asia/Taipei': { country: 'Taiwan', code: 'TW' },
  'Asia/Tokyo': { country: 'Japan', code: 'JP' },
  'Asia/Seoul': { country: 'South Korea', code: 'KR' },
  'Asia/Shanghai': { country: 'China', code: 'CN' },
  // Europe
  'Europe/London': { country: 'United Kingdom', code: 'GB' },
  'Europe/Paris': { country: 'France', code: 'FR' },
  'Europe/Berlin': { country: 'Germany', code: 'DE' },
  'Europe/Rome': { country: 'Italy', code: 'IT' },
  'Europe/Madrid': { country: 'Spain', code: 'ES' },
  'Europe/Amsterdam': { country: 'Netherlands', code: 'NL' },
  'Europe/Brussels': { country: 'Belgium', code: 'BE' },
  'Europe/Zurich': { country: 'Switzerland', code: 'CH' },
  'Europe/Vienna': { country: 'Austria', code: 'AT' },
  'Europe/Stockholm': { country: 'Sweden', code: 'SE' },
  'Europe/Oslo': { country: 'Norway', code: 'NO' },
  'Europe/Copenhagen': { country: 'Denmark', code: 'DK' },
  'Europe/Helsinki': { country: 'Finland', code: 'FI' },
  'Europe/Dublin': { country: 'Ireland', code: 'IE' },
  'Europe/Warsaw': { country: 'Poland', code: 'PL' },
  'Europe/Prague': { country: 'Czech Republic', code: 'CZ' },
  'Europe/Lisbon': { country: 'Portugal', code: 'PT' },
  'Europe/Athens': { country: 'Greece', code: 'GR' },
  'Europe/Istanbul': { country: 'Turkey', code: 'TR' },
  'Europe/Moscow': { country: 'Russia', code: 'RU' },
  // Americas
  'America/New_York': { country: 'United States', code: 'US' },
  'America/Chicago': { country: 'United States', code: 'US' },
  'America/Denver': { country: 'United States', code: 'US' },
  'America/Los_Angeles': { country: 'United States', code: 'US' },
  'America/Phoenix': { country: 'United States', code: 'US' },
  'America/Anchorage': { country: 'United States', code: 'US' },
  'America/Honolulu': { country: 'United States', code: 'US' },
  'America/Toronto': { country: 'Canada', code: 'CA' },
  'America/Vancouver': { country: 'Canada', code: 'CA' },
  'America/Montreal': { country: 'Canada', code: 'CA' },
  'America/Mexico_City': { country: 'Mexico', code: 'MX' },
  'America/Sao_Paulo': { country: 'Brazil', code: 'BR' },
  'America/Buenos_Aires': { country: 'Argentina', code: 'AR' },
  'America/Bogota': { country: 'Colombia', code: 'CO' },
  'America/Santiago': { country: 'Chile', code: 'CL' },
  'America/Lima': { country: 'Peru', code: 'PE' },
  // Oceania
  'Australia/Sydney': { country: 'Australia', code: 'AU' },
  'Australia/Melbourne': { country: 'Australia', code: 'AU' },
  'Australia/Brisbane': { country: 'Australia', code: 'AU' },
  'Australia/Perth': { country: 'Australia', code: 'AU' },
  'Pacific/Auckland': { country: 'New Zealand', code: 'NZ' },
  // Africa
  'Africa/Cairo': { country: 'Egypt', code: 'EG' },
  'Africa/Johannesburg': { country: 'South Africa', code: 'ZA' },
  'Africa/Lagos': { country: 'Nigeria', code: 'NG' },
  'Africa/Nairobi': { country: 'Kenya', code: 'KE' },
  'Africa/Casablanca': { country: 'Morocco', code: 'MA' },
};

/**
 * Converts 2-letter ISO country code into Unicode flag emoji (e.g., 'BD' -> 🇧🇩, 'US' -> 🇺🇸)
 */
export function getCountryFlagEmoji(countryCode?: string): string {
  if (!countryCode || countryCode.length !== 2) return '🌐';
  const code = countryCode.toUpperCase();
  if (code === 'XX' || code === 'UN') return '🌐';
  const codePoints = code
    .split('')
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

/**
 * Gets standard country display name from 2-letter code
 */
export function getCountryNameFromCode(code?: string, defaultName = 'Unknown Location'): string {
  if (!code) return defaultName;
  const upper = code.toUpperCase();
  try {
    const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
    const name = regionNames.of(upper);
    if (name) return name;
  } catch {}
  return defaultName;
}

/**
 * Detects visitor geolocation (Country, Code, City) with caching and fast multi-provider fallback.
 * Uses lightweight client-side cache -> fast IP geo API -> timezone fallback.
 */
export async function detectVisitorGeo(): Promise<{ country: string; countryCode: string; city?: string }> {
  if (typeof window === 'undefined') {
    return { country: 'Unknown', countryCode: 'XX' };
  }

  const CACHE_KEY = 'shortee_geo_cache';

  // 1. Check local session cache (only if valid, not placeholder)
  try {
    const cached = sessionStorage.getItem(CACHE_KEY) || localStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed?.country && parsed?.countryCode && parsed.country !== 'Unknown' && parsed.countryCode !== 'XX') {
        return parsed;
      }
    }
  } catch {}

  // 2. Prepare timezone fallback
  let fallbackCountry = 'Unknown';
  let fallbackCode = 'XX';
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && TIMEZONE_COUNTRY_MAP[tz]) {
      fallbackCountry = TIMEZONE_COUNTRY_MAP[tz].country;
      fallbackCode = TIMEZONE_COUNTRY_MAP[tz].code;
    }
  } catch {}

  // 3. Provider 1: freeipapi.com (Reliable, fast HTTPS, CORS open)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1200);

    const response = await fetch('https://freeipapi.com/api/json', {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data?.countryName && data?.countryCode) {
        const result = {
          country: data.countryName,
          countryCode: String(data.countryCode).toUpperCase(),
          city: data.cityName || undefined,
        };
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify(result));
          localStorage.setItem(CACHE_KEY, JSON.stringify(result));
        } catch {}
        return result;
      }
    }
  } catch {}

  // 4. Provider 2: api.country.is fallback
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1000);

    const response = await fetch('https://api.country.is/', {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data?.country && typeof data.country === 'string' && data.country.length === 2) {
        const code = data.country.toUpperCase();
        const countryName = getCountryNameFromCode(code, fallbackCountry !== 'Unknown' ? fallbackCountry : code);
        const result = { country: countryName, countryCode: code };
        
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify(result));
          localStorage.setItem(CACHE_KEY, JSON.stringify(result));
        } catch {}
        return result;
      }
    }
  } catch {}

  // 5. Return timezone fallback
  const result = { country: fallbackCountry !== 'Unknown' ? fallbackCountry : 'Unknown', countryCode: fallbackCode };
  return result;
}

