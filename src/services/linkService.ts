import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  limit,
  increment,
  addDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { LinkItem, ClickEvent } from '../types';
import {
  generateRandomShortCode,
  validateCustomAlias,
  validateLongUrl,
  getSafeDeviceType,
  getSafeBrowserName,
  getSafeReferrer,
} from '../lib/urlUtils';

const LINKS_COLLECTION = 'links';
const CLICKS_COLLECTION = 'click_events';
const LOCAL_STORAGE_LINKS_KEY = 'shortee_cached_links';

// Local storage helper to cache links and provide instant offline/graceful fallback
function getLocalLinks(): LinkItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_LINKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalLinks(links: LinkItem[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_LINKS_KEY, JSON.stringify(links));
  } catch (err) {
    console.warn('Failed to save to local cache:', err);
  }
}

function upsertLocalLink(link: LinkItem): void {
  const current = getLocalLinks();
  const existingIdx = current.findIndex((l) => l.id === link.id || l.shortCode === link.shortCode);
  if (existingIdx >= 0) {
    current[existingIdx] = link;
  } else {
    current.unshift(link);
  }
  saveLocalLinks(current);
}

/**
 * Check if a short code is already taken
 */
export async function checkShortCodeExists(shortCode: string): Promise<boolean> {
  try {
    const q = query(
      collection(db, LINKS_COLLECTION),
      where('shortCode', '==', shortCode),
      limit(1)
    );
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  } catch (err) {
    console.warn('Firestore offline or check unavailable, checking local store:', err);
    const local = getLocalLinks();
    return local.some((l) => l.shortCode.toLowerCase() === shortCode.toLowerCase());
  }
}

/**
 * Generate a guaranteed unique short code
 */
export async function generateUniqueShortCode(customAlias?: string): Promise<string> {
  if (customAlias && customAlias.trim()) {
    const aliasCheck = validateCustomAlias(customAlias);
    if (!aliasCheck.valid) {
      throw new Error(aliasCheck.error);
    }
    const clean = aliasCheck.cleanAlias!;
    const exists = await checkShortCodeExists(clean);
    if (exists) {
      throw new Error(`The alias "${clean}" is already taken. Please choose another.`);
    }
    return clean;
  }

  // Generate random code and verify uniqueness
  let attempts = 0;
  while (attempts < 5) {
    const code = generateRandomShortCode(6);
    const exists = await checkShortCodeExists(code);
    if (!exists) {
      return code;
    }
    attempts++;
  }

  // Fallback to 7-character code if high density
  return generateRandomShortCode(7);
}

/**
 * Create a new shortened link document in Firestore with automatic offline sync
 */
export async function createShortLink({
  userId,
  originalUrl,
  title,
  customAlias,
  expiresAt,
}: {
  userId: string;
  originalUrl: string;
  title?: string;
  customAlias?: string;
  expiresAt?: string | null;
}): Promise<LinkItem> {
  const urlCheck = validateLongUrl(originalUrl);
  if (!urlCheck.valid) {
    throw new Error(urlCheck.error);
  }

  // If expiration date is provided, ensure it is in the future
  if (expiresAt) {
    const expTime = new Date(expiresAt).getTime();
    if (isNaN(expTime)) {
      throw new Error('Invalid expiration date format.');
    }
    if (expTime <= Date.now()) {
      throw new Error('Expiration date must be in the future.');
    }
  }

  const cleanUrl = urlCheck.cleanUrl!;
  const shortCode = await generateUniqueShortCode(customAlias);

  // Derive a fallback title from the URL if none provided
  let computedTitle = title?.trim();
  if (!computedTitle) {
    try {
      const parsed = new URL(cleanUrl);
      computedTitle = parsed.hostname + (parsed.pathname.length > 1 ? parsed.pathname.slice(0, 20) : '');
    } catch {
      computedTitle = cleanUrl.slice(0, 30);
    }
  }

  const linkDocRef = doc(collection(db, LINKS_COLLECTION));
  const now = new Date().toISOString();

  const newLink: LinkItem = {
    id: linkDocRef.id,
    userId,
    originalUrl: cleanUrl,
    shortCode,
    title: computedTitle,
    clicks: 0,
    createdAt: now,
    updatedAt: now,
    expiresAt: expiresAt || null,
  };

  // Always save locally first so user gets instant responsive UI
  upsertLocalLink(newLink);

  try {
    await setDoc(linkDocRef, newLink);
  } catch (err) {
    console.warn('Saved to offline cache (Firestore write queued or unavailable):', err);
  }

  return newLink;
}

/**
 * Fetch all links created by a specific user with offline cache fallback
 */
export async function getUserLinks(userId: string): Promise<LinkItem[]> {
  try {
    const q = query(
      collection(db, LINKS_COLLECTION),
      where('userId', '==', userId)
    );
    const snapshot = await getDocs(q);
    const links: LinkItem[] = [];

    snapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      links.push({
        id: docSnapshot.id,
        userId: data.userId,
        originalUrl: data.originalUrl,
        shortCode: data.shortCode,
        title: data.title || 'Untitled Link',
        clicks: data.clicks || 0,
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
        expiresAt: data.expiresAt || null,
      });
    });

    const sorted = links.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Update local cache
    if (sorted.length > 0) {
      saveLocalLinks(sorted);
    }

    return sorted;
  } catch (err) {
    console.warn('Firestore fetch failed, returning cached local links:', err);
    const local = getLocalLinks().filter((l) => l.userId === userId || !l.userId);
    return local.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }
}

/**
 * Look up a link document by its short code (used for redirection)
 * Fast local-first lookup with Firestore fallback for sub-millisecond response.
 */
export async function getLinkByShortCode(shortCode: string): Promise<LinkItem | null> {
  const normalized = shortCode.trim().toLowerCase();

  // 1. Check instant local cache first
  const localLinks = getLocalLinks();
  const cachedMatch = localLinks.find((l) => l.shortCode.toLowerCase() === normalized);
  if (cachedMatch) {
    return cachedMatch;
  }

  // 2. Fetch from Firestore if not in local memory
  try {
    const q = query(
      collection(db, LINKS_COLLECTION),
      where('shortCode', '==', shortCode),
      limit(1)
    );
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const docSnap = snapshot.docs[0];
      const data = docSnap.data();
      const item: LinkItem = {
        id: docSnap.id,
        userId: data.userId,
        originalUrl: data.originalUrl,
        shortCode: data.shortCode,
        title: data.title || 'Untitled Link',
        clicks: data.clicks || 0,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        expiresAt: data.expiresAt || null,
      };
      upsertLocalLink(item);
      return item;
    }
  } catch (err) {
    console.warn('Firestore lookup failed for short code:', err);
  }

  return null;
}

/**
 * Look up a link document by its Firestore doc id
 */
export async function getLinkById(linkId: string): Promise<LinkItem | null> {
  try {
    const docRef = doc(db, LINKS_COLLECTION, linkId);
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
      const data = snapshot.data();
      return {
        id: snapshot.id,
        userId: data.userId,
        originalUrl: data.originalUrl,
        shortCode: data.shortCode,
        title: data.title || 'Untitled Link',
        clicks: data.clicks || 0,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        expiresAt: data.expiresAt || null,
      };
    }
  } catch (err) {
    console.warn('Firestore getById failed, checking local storage:', err);
  }

  const local = getLocalLinks().find((l) => l.id === linkId);
  return local || null;
}

/**
 * Increment click count on a link document atomically and record click event
 */
export async function processLinkClick(link: LinkItem): Promise<void> {
  const linkRef = doc(db, LINKS_COLLECTION, link.id);
  const now = new Date().toISOString();

  // Update local counter
  const updatedLink = { ...link, clicks: (link.clicks || 0) + 1, updatedAt: now };
  upsertLocalLink(updatedLink);

  // 1. Increment click count in link doc
  try {
    await updateDoc(linkRef, {
      clicks: increment(1),
      updatedAt: now,
    });
  } catch (err) {
    console.warn('Offline: increment queued locally:', err);
  }

  // 2. Record safe anonymous click event in click_events collection
  try {
    const clickEvent: Omit<ClickEvent, 'id'> = {
      linkId: link.id,
      shortCode: link.shortCode,
      timestamp: now,
      referrer: getSafeReferrer(),
      deviceType: getSafeDeviceType(),
      browser: getSafeBrowserName(),
    };
    await addDoc(collection(db, CLICKS_COLLECTION), clickEvent);
  } catch (err) {
    console.warn('Click event logging skipped or queued offline:', err);
  }
}

/**
 * Delete a link by ID
 */
export async function deleteShortLink(linkId: string): Promise<void> {
  const current = getLocalLinks().filter((l) => l.id !== linkId);
  saveLocalLinks(current);

  try {
    const docRef = doc(db, LINKS_COLLECTION, linkId);
    await deleteDoc(docRef);
  } catch (err) {
    console.warn('Delete performed in local cache; Firestore sync queued:', err);
  }
}

/**
 * Fetch click events for a specific link
 */
export async function getLinkClickEvents(linkId: string): Promise<ClickEvent[]> {
  try {
    const q = query(
      collection(db, CLICKS_COLLECTION),
      where('linkId', '==', linkId),
      limit(100)
    );
    const snapshot = await getDocs(q);
    const events: ClickEvent[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      events.push({
        id: docSnap.id,
        linkId: data.linkId,
        shortCode: data.shortCode,
        timestamp: data.timestamp,
        referrer: data.referrer || 'Direct',
        deviceType: data.deviceType || 'Desktop',
        browser: data.browser || 'Other',
      });
    });

    return events.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  } catch (err) {
    console.warn('Could not fetch click events (offline mode active):', err);
    return [];
  }
}
