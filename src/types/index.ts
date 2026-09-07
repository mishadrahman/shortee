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
