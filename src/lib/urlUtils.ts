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
 * Safely parse browser name from user agent
 */
export function getSafeBrowserName(): string {
  if (typeof window === 'undefined') return 'Other';
  const ua = navigator.userAgent;
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
 * Clean human-readable referrer
 */
export function getSafeReferrer(): string {
  if (typeof document === 'undefined' || !document.referrer) {
    return 'Direct / None';
  }
  try {
    const refUrl = new URL(document.referrer);
    const host = refUrl.hostname.toLowerCase();
    if (host.includes('google.')) return 'Google Search';
    if (host.includes('twitter.com') || host.includes('x.com')) return 'X / Twitter';
    if (host.includes('linkedin.com')) return 'LinkedIn';
    if (host.includes('facebook.com') || host.includes('fb.me')) return 'Facebook';
    if (host.includes('reddit.com')) return 'Reddit';
    if (host.includes('youtube.com')) return 'YouTube';
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
