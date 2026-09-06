export const RESERVED_ROUTES = new Set([
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

/**
 * Builds the full short URL
 */
export function buildShortUrl(shortCode: string): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/${shortCode}`;
  }
  return `/${shortCode}`;
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
    if (host.includes('facebook.com')) return 'Facebook';
    if (host.includes('reddit.com')) return 'Reddit';
    if (host.includes('youtube.com')) return 'YouTube';
    if (host.includes('github.com')) return 'GitHub';
    return host;
  } catch {
    return 'Direct / Other';
  }
}
