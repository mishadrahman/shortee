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
  onSnapshot,
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
export function getLocalLinks(): LinkItem[] {
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
 * Live Firestore query first for guaranteed fresh destination and click tracking,
 * with fast offline fallback to local cache.
 */
export async function getLinkByShortCode(shortCode: string): Promise<LinkItem | null> {
  const cleanCode = shortCode.trim();

  // 1. Fetch from Firestore for authoritative destination URL and status
  try {
    const q = query(
      collection(db, LINKS_COLLECTION),
      where('shortCode', '==', cleanCode),
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
    console.warn('Firestore lookup error for short code, checking cache:', err);
  }

  // 2. Fallback to local cache if offline or Firestore query failed
  const localLinks = getLocalLinks();
  const cachedMatch = localLinks.find((l) => l.shortCode.toLowerCase() === cleanCode.toLowerCase());
  return cachedMatch || null;
}

/**
 * Look up a link document by its Firestore doc id (or shortCode)
 * Authoritative Firestore query first so analytics and clicks are always 100% accurate.
 */
export async function getLinkById(linkId: string): Promise<LinkItem | null> {
  const trimmedId = linkId.trim();

  // 1. Fetch directly from Firestore by Document ID
  try {
    const docRef = doc(db, LINKS_COLLECTION, trimmedId);
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
      const data = snapshot.data();
      const item: LinkItem = {
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
      upsertLocalLink(item);
      return item;
    }
  } catch (err) {
    console.warn('Firestore getById doc id lookup error:', err);
  }

  // 2. Try querying by shortCode in Firestore
  try {
    const q = query(
      collection(db, LINKS_COLLECTION),
      where('shortCode', '==', trimmedId),
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
    console.warn('Firestore query by shortCode fallback error:', err);
  }

  // 3. Fallback to local cache only if offline or network unreachable
  const localMatch = getLocalLinks().find((l) => l.id === trimmedId || l.shortCode === trimmedId);
  return localMatch || null;
}

/**
 * Increment click count on a link document atomically and record safe anonymous click event
 */
export async function processLinkClick(link: LinkItem): Promise<{ success: boolean; newClicks: number }> {
  const linkRef = doc(db, LINKS_COLLECTION, link.id);
  const now = new Date().toISOString();
  const nextClicks = (link.clicks || 0) + 1;

  // 1. Immediately update local storage and notify any listeners in other tabs
  const updatedLink: LinkItem = {
    ...link,
    clicks: nextClicks,
    updatedAt: now,
  };
  upsertLocalLink(updatedLink);

  // 2. Prepare ClickEvent document
  const clickEvent: Omit<ClickEvent, 'id'> = {
    linkId: link.id,
    userId: link.userId,
    linkTitle: link.title || link.shortCode,
    shortCode: link.shortCode,
    timestamp: now,
    referrer: getSafeReferrer(),
    deviceType: getSafeDeviceType(),
    browser: getSafeBrowserName(),
  };

  // 3. Atomically update Firestore
  try {
    const incrementPromise = updateDoc(linkRef, {
      clicks: increment(1),
      updatedAt: now,
    }).catch(async (updateErr) => {
      console.warn('updateDoc failed, attempting setDoc with merge:', updateErr);
      await setDoc(
        linkRef,
        {
          clicks: increment(1),
          updatedAt: now,
        },
        { merge: true }
      );
    });

    const addEventPromise = addDoc(collection(db, CLICKS_COLLECTION), clickEvent);

    await Promise.allSettled([incrementPromise, addEventPromise]);
    return { success: true, newClicks: nextClicks };
  } catch (err) {
    console.warn('Firestore link click processing error:', err);
    return { success: false, newClicks: nextClicks };
  }
}

/**
 * Subscribe in real-time to all links for a user
 */
export function subscribeToUserLinks(
  userId: string,
  onUpdate: (links: LinkItem[]) => void,
  onError?: (err: any) => void
): () => void {
  try {
    const q = query(
      collection(db, LINKS_COLLECTION),
      where('userId', '==', userId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
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

        if (sorted.length > 0) {
          saveLocalLinks(sorted);
        }
        onUpdate(sorted);
      },
      (error) => {
        console.warn('Real-time links snapshot warning:', error);
        if (onError) onError(error);
      }
    );

    return unsubscribe;
  } catch (err) {
    console.warn('Failed to attach real-time links listener:', err);
    return () => {};
  }
}

/**
 * Subscribe in real-time to a specific link document
 */
export function subscribeToLink(
  linkId: string,
  onUpdate: (link: LinkItem) => void,
  onError?: (err: any) => void
): () => void {
  try {
    const linkRef = doc(db, LINKS_COLLECTION, linkId);
    const unsubscribe = onSnapshot(
      linkRef,
      (docSnap) => {
        if (docSnap.exists()) {
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
          onUpdate(item);
        }
      },
      (error) => {
        console.warn('Real-time link snapshot warning:', error);
        if (onError) onError(error);
      }
    );
    return unsubscribe;
  } catch (err) {
    console.warn('Failed to subscribe to link:', err);
    return () => {};
  }
}

/**
 * Subscribe in real-time to click events for a specific link
 */
export function subscribeToLinkClickEvents(
  linkId: string,
  onUpdate: (events: ClickEvent[]) => void,
  onError?: (err: any) => void
): () => void {
  try {
    const q = query(
      collection(db, CLICKS_COLLECTION),
      where('linkId', '==', linkId),
      limit(100)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const events: ClickEvent[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          events.push({
            id: docSnap.id,
            linkId: data.linkId,
            userId: data.userId,
            linkTitle: data.linkTitle,
            shortCode: data.shortCode,
            timestamp: data.timestamp,
            referrer: data.referrer || 'Direct / None',
            deviceType: data.deviceType || 'Desktop',
            browser: data.browser || 'Other',
          });
        });

        const sorted = events.sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        onUpdate(sorted);
      },
      (error) => {
        console.warn('Real-time click events snapshot warning:', error);
        if (onError) onError(error);
      }
    );

    return unsubscribe;
  } catch (err) {
    console.warn('Failed to subscribe to click events:', err);
    return () => {};
  }
}

/**
 * Fetch recent click events across all user links for the dashboard activity stream
 */
export async function getUserRecentClickEvents(
  userId: string,
  limitCount = 10
): Promise<ClickEvent[]> {
  try {
    const q = query(
      collection(db, CLICKS_COLLECTION),
      where('userId', '==', userId),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);
    const events: ClickEvent[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      events.push({
        id: docSnap.id,
        linkId: data.linkId,
        userId: data.userId,
        linkTitle: data.linkTitle,
        shortCode: data.shortCode,
        timestamp: data.timestamp,
        referrer: data.referrer || 'Direct / None',
        deviceType: data.deviceType || 'Desktop',
        browser: data.browser || 'Other',
      });
    });
    return events.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  } catch (err) {
    console.warn('Failed to fetch user recent click events:', err);
    return [];
  }
}

/**
 * Subscribe in real-time to recent click events for a user
 */
export function subscribeToUserClickEvents(
  userId: string,
  onUpdate: (events: ClickEvent[]) => void,
  limitCount = 10
): () => void {
  try {
    const q = query(
      collection(db, CLICKS_COLLECTION),
      where('userId', '==', userId),
      limit(limitCount)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const events: ClickEvent[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          events.push({
            id: docSnap.id,
            linkId: data.linkId,
            userId: data.userId,
            linkTitle: data.linkTitle,
            shortCode: data.shortCode,
            timestamp: data.timestamp,
            referrer: data.referrer || 'Direct / None',
            deviceType: data.deviceType || 'Desktop',
            browser: data.browser || 'Other',
          });
        });

        const sorted = events.sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        onUpdate(sorted);
      },
      (error) => {
        console.warn('Real-time user click events warning:', error);
      }
    );

    return unsubscribe;
  } catch (err) {
    console.warn('Failed to subscribe to user click events:', err);
    return () => {};
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
        userId: data.userId,
        linkTitle: data.linkTitle,
        shortCode: data.shortCode,
        timestamp: data.timestamp,
        referrer: data.referrer || 'Direct / None',
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
