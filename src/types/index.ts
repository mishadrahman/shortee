export interface RetargetingPixels {
  metaPixelId?: string; // Meta / Facebook Pixel ID (e.g., 123456789012345)
  googleTagId?: string; // Google Ads / GA4 Conversion ID (e.g., AW-123456789, G-XXXXXXXXXX)
  tiktokPixelId?: string; // TikTok Pixel ID (e.g., C1234567890)
  linkedinPartnerId?: string; // LinkedIn Partner ID (e.g., 1234567)
  twitterPixelId?: string; // Twitter / X Pixel ID (e.g., o1234)
}

export interface LinkItem {
  id: string;
  userId: string;
  originalUrl: string;
  shortCode: string;
  title: string;
  clicks: number;
  uniqueVisitors?: number; // Deduplicated visitor count
  tags?: string[]; // Marketing tags e.g. 'Social', 'Campaign'
  isActive?: boolean;
  createdAt: string; // ISO 8601 string
  updatedAt: string; // ISO 8601 string
  expiresAt?: string | null; // ISO 8601 string or null if never expires
  maxClicks?: number | null; // Optional click limit e.g. 50, 100, 500 clicks
  countries?: Record<string, number>; // Country code -> click count aggregation
  password?: string | null; // Optional password to protect link access
  isPasswordProtected?: boolean; // Convenience flag indicating password protection
  retargeting?: RetargetingPixels; // Retargeting tracking pixel IDs
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogSiteName?: string;
}

export interface ClickEvent {
  id?: string;
  linkId: string;
  userId?: string;
  linkTitle?: string;
  shortCode: string;
  timestamp: string;
  referrer: string;
  deviceType: 'Desktop' | 'Mobile' | 'Tablet';
  browser: string;
  operatingSystem?: string;
  country?: string; // Country name e.g. 'Bangladesh', 'United States'
  countryCode?: string; // ISO 2-letter code e.g. 'BD', 'US'
  city?: string;
  isUnique?: boolean;
  visitorId?: string;
}

export interface UtmParams {
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  createdAt?: string;
}

export type ThemeMode = 'light' | 'dark' | 'system';
