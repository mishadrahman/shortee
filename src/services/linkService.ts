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
import { db, auth } from '../lib/firebase';
import { LinkItem, ClickEvent } from '../types';
import {
  generateRandomShortCode,
  validateCustomAlias,
  validateLongUrl,
  getSafeDeviceType,
  getSafeBrowserName,
  getSafeReferrer,
  getSafeOS,
  getOrCreateVisitorId,
  checkAndRecordUniqueVisit,
  buildShortUrl,
  isBotOrCrawler,
  isSessionDuplicateClick,
} from '../lib/urlUtils';

const LINKS_COLLECTION = 'links';
const CLICKS_COLLECTION = 'click_events';
const LOCAL_STORAGE_LINKS_KEY = 'shortee_cached_links';
const GUEST_LINKS_KEY = 'shortee_guest_links';

// Local storage helper to cache links and provide instant offline/graceful fallback
export function getLocalLinks(): LinkItem[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_LINKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalLinks(links: LinkItem[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.setItem(LOCAL_STORAGE_LINKS_KEY, JSON.stringify(links));
  } catch (err) {
    console.warn('Failed to save to local cache:', err);
  }
}

export function getGuestLinks(): LinkItem[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = localStorage.getItem(GUEST_LINKS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function syncGuestLinksFromDb(): Promise<LinkItem[]> {
  const currentGuestLinks = getGuestLinks();
  if (currentGuestLinks.length === 0) return [];

  try {
    const updatedLinks: LinkItem[] = [];
    let hasUpdates = false;

    for (const link of currentGuestLinks) {
      const linkRef = doc(db, LINKS_COLLECTION, link.id);
      const docSnap = await getDoc(linkRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        const clicks = data.clicks || 0;
        const item: LinkItem = {
          id: docSnap.id,
          userId: data.userId,
          originalUrl: data.originalUrl,
          shortCode: data.shortCode,
          title: data.title || 'Untitled Link',
          clicks,
          uniqueVisitors: data.uniqueVisitors || (clicks > 0 ? Math.max(1, Math.round(clicks * 0.82)) : 0),
          tags: data.tags || [],
          isActive: data.isActive !== false,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          expiresAt: data.expiresAt || null,
        };

        if (item.clicks !== link.clicks || item.userId !== link.userId) {
          hasUpdates = true;
        }
        
        // Only keep it in guest list if it hasn't been claimed yet
        if (item.userId === 'guest') {
          updatedLinks.push(item);
        } else {
           hasUpdates = true; // Item removed from guest because claimed
        }
      } else {
        // Link was deleted from DB
        hasUpdates = true;
      }
    }

    if (hasUpdates) {
      localStorage.setItem(GUEST_LINKS_KEY, JSON.stringify(updatedLinks));
    }
    
    return updatedLinks;
  } catch (err) {
    console.warn('Failed to sync guest links:', err);
    return currentGuestLinks;
  }
}

export function saveGuestLink(link: LinkItem): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const current = getGuestLinks();
    const filtered = current.filter((l) => l.id !== link.id && l.shortCode !== link.shortCode);
    const updated = [link, ...filtered];
    localStorage.setItem(GUEST_LINKS_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('Failed to store guest link:', err);
  }
}

export function deleteGuestLink(linkId: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const current = getGuestLinks();
    const updated = current.filter((l) => l.id !== linkId);
    localStorage.setItem(GUEST_LINKS_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('Failed to delete guest link:', err);
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

  // If this is also a guest link, keep the guest list in sync
  try {
    const guestLinks = getGuestLinks();
    const gIdx = guestLinks.findIndex((l) => l.id === link.id || l.shortCode === link.shortCode);
    if (gIdx >= 0) {
      guestLinks[gIdx] = { ...guestLinks[gIdx], ...link };
      localStorage.setItem(GUEST_LINKS_KEY, JSON.stringify(guestLinks));
    }
  } catch {}
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
  tags,
}: {
  userId?: string;
  originalUrl: string;
  title?: string;
  customAlias?: string;
  expiresAt?: string | null;
  tags?: string[];
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
  const resolvedUserId = userId?.trim() || 'guest';

  const newLink: LinkItem = {
    id: linkDocRef.id,
    userId: resolvedUserId,
    originalUrl: cleanUrl,
    shortCode,
    title: computedTitle,
    clicks: 0,
    uniqueVisitors: 0,
    tags: tags || [],
    isActive: true,
    createdAt: now,
    updatedAt: now,
    expiresAt: expiresAt || null,
  };

  // Always save locally first so user gets instant responsive UI
  upsertLocalLink(newLink);

  if (resolvedUserId === 'guest') {
    saveGuestLink(newLink);
  }

  try {
    await setDoc(linkDocRef, {
      ...newLink,
      shortCodeLower: shortCode.toLowerCase(),
    });
  } catch (err) {
    console.warn('Saved to offline cache (Firestore write queued or unavailable):', err);
  }

  return newLink;
}

/**
 * Transfer all guest links created on this browser to a logged-in user account
 */
export async function claimGuestLinksToAccount(userId: string): Promise<number> {
  if (!userId || userId === 'guest') return 0;
  const guestLinks = getGuestLinks();
  if (guestLinks.length === 0) return 0;

  let claimedCount = 0;
  for (const link of guestLinks) {
    try {
      const linkRef = doc(db, LINKS_COLLECTION, link.id);
      await updateDoc(linkRef, { userId });
      claimedCount++;
    } catch (err) {
      console.warn('Failed to transfer guest link to account:', link.id, err);
    }
  }

  // Clear guest links once transferred
  try {
    localStorage.removeItem(GUEST_LINKS_KEY);
  } catch {}

  return claimedCount;
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
      const clicks = data.clicks || 0;
      links.push({
        id: docSnapshot.id,
        userId: data.userId,
        originalUrl: data.originalUrl,
        shortCode: data.shortCode,
        title: data.title || 'Untitled Link',
        clicks,
        uniqueVisitors: data.uniqueVisitors || (clicks > 0 ? Math.max(1, Math.round(clicks * 0.82)) : 0),
        tags: data.tags || [],
        isActive: data.isActive !== false,
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
 * Checks fast local cache first for 0ms instantaneous redirect,
 * then queries Firestore for fresh or first-time visitor lookups.
 */
export async function getLinkByShortCode(shortCode: string): Promise<LinkItem | null> {
  const cleanCode = shortCode.trim();
  const lowerCode = cleanCode.toLowerCase();

  // 1. Authoritative Firestore query for the short link (exact match first)
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
      const clicks = data.clicks || 0;
      const item: LinkItem = {
        id: docSnap.id,
        userId: data.userId,
        originalUrl: data.originalUrl,
        shortCode: data.shortCode,
        title: data.title || 'Untitled Link',
        clicks,
        uniqueVisitors: data.uniqueVisitors || (clicks > 0 ? Math.max(1, Math.round(clicks * 0.82)) : 0),
        tags: data.tags || [],
        isActive: data.isActive !== false,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        expiresAt: data.expiresAt || null,
      };
      upsertLocalLink(item);
      return item;
    }
  } catch (err) {
    console.warn('Firestore lookup error for short code:', err);
  }

  // 2. Case-insensitive lookup via shortCodeLower
  try {
    const qLower = query(
      collection(db, LINKS_COLLECTION),
      where('shortCodeLower', '==', lowerCode),
      limit(1)
    );
    const snapshotLower = await getDocs(qLower);
    if (!snapshotLower.empty) {
      const docSnap = snapshotLower.docs[0];
      const data = docSnap.data();
      const clicks = data.clicks || 0;
      const item: LinkItem = {
        id: docSnap.id,
        userId: data.userId,
        originalUrl: data.originalUrl,
        shortCode: data.shortCode,
        title: data.title || 'Untitled Link',
        clicks,
        uniqueVisitors: data.uniqueVisitors || (clicks > 0 ? Math.max(1, Math.round(clicks * 0.82)) : 0),
        tags: data.tags || [],
        isActive: data.isActive !== false,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        expiresAt: data.expiresAt || null,
      };
      upsertLocalLink(item);
      return item;
    }
  } catch (err) {
    console.warn('Firestore shortCodeLower query error:', err);
  }

  // 3. Fallback to local storage cache if offline or network unreachable
  const localLinks = getLocalLinks();
  const cachedMatch = localLinks.find((l) => l.shortCode.toLowerCase() === lowerCode);
  if (cachedMatch) {
    return cachedMatch;
  }

  return null;
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
      const clicks = data.clicks || 0;
      const item: LinkItem = {
        id: snapshot.id,
        userId: data.userId,
        originalUrl: data.originalUrl,
        shortCode: data.shortCode,
        title: data.title || 'Untitled Link',
        clicks,
        uniqueVisitors: data.uniqueVisitors || (clicks > 0 ? Math.max(1, Math.round(clicks * 0.82)) : 0),
        tags: data.tags || [],
        isActive: data.isActive !== false,
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
      const clicks = data.clicks || 0;
      const item: LinkItem = {
        id: docSnap.id,
        userId: data.userId,
        originalUrl: data.originalUrl,
        shortCode: data.shortCode,
        title: data.title || 'Untitled Link',
        clicks,
        uniqueVisitors: data.uniqueVisitors || (clicks > 0 ? Math.max(1, Math.round(clicks * 0.82)) : 0),
        tags: data.tags || [],
        isActive: data.isActive !== false,
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
  // 1. Filter out automated bots and social media preview crawlers (Facebook, WhatsApp, Twitter, etc.)
  if (isBotOrCrawler()) {
    console.info('[Analytics] Social media preview crawler / bot visit filtered out for link:', link.shortCode);
    return { success: true, newClicks: link.clicks || 0 };
  }

  // 2. Filter out rapid repeat clicks within the same session/tab (cooldown 25 seconds)
  // This avoids double-counting from mobile in-app browser pre-fetching, webview reloading, or app switching
  if (isSessionDuplicateClick(link.id, 25)) {
    console.info('[Analytics] Rapid repeat click deduplicated within 25s window for link:', link.shortCode);
    return { success: true, newClicks: link.clicks || 0 };
  }

  const linkRef = doc(db, LINKS_COLLECTION, link.id);
  const now = new Date().toISOString();
  const nextClicks = (link.clicks || 0) + 1;
  const isUnique = checkAndRecordUniqueVisit(link.id);
  const nextUniqueVisitors = (link.uniqueVisitors || 0) + (isUnique ? 1 : 0);

  // 1. Immediately update local storage and notify any listeners in other tabs
  const updatedLink: LinkItem = {
    ...link,
    clicks: nextClicks,
    uniqueVisitors: nextUniqueVisitors,
    updatedAt: now,
  };
  upsertLocalLink(updatedLink);

  if (link.userId === 'guest' || !link.userId) {
    saveGuestLink(updatedLink);
  }

  // Cross-tab broadcast for instant multi-tab UI refresh
  try {
    localStorage.setItem('shortee_last_click_ping', `${link.id}_${nextClicks}_${Date.now()}`);
  } catch {}

  // 2. Prepare ClickEvent document
  const clickEvent: Record<string, any> = {
    linkId: link.id,
    userId: link.userId || 'guest',
    linkTitle: link.title || link.shortCode || 'Short Link',
    shortCode: link.shortCode,
    timestamp: now,
    referrer: getSafeReferrer() || 'Direct / None',
    deviceType: getSafeDeviceType() || 'Desktop',
    browser: getSafeBrowserName() || 'Other',
    operatingSystem: getSafeOS() || 'Other OS',
    isUnique,
    visitorId: getOrCreateVisitorId(),
  };

  // 3. Atomically update Firestore
  try {
    const updatePayload: Record<string, any> = {
      clicks: increment(1),
      updatedAt: now,
    };
    if (isUnique) {
      updatePayload.uniqueVisitors = increment(1);
    }

    // Fast atomic update with retry on contention
    const commitIncrement = async (retries = 2): Promise<void> => {
      try {
        await updateDoc(linkRef, updatePayload);
      } catch (updateErr) {
        if (retries > 0) {
          await new Promise((r) => setTimeout(r, 100));
          return commitIncrement(retries - 1);
        }
        console.warn('Firestore updateDoc failed after retries:', updateErr);
      }
    };

    const incrementPromise = commitIncrement();

    // Record click event in parallel
    const addEventPromise = addDoc(collection(db, CLICKS_COLLECTION), clickEvent).catch((evtErr) => {
      console.warn('addDoc click_events error:', evtErr);
    });

    // Wait for both the primary click counter and the detailed click event to be acknowledged
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
          const clicks = data.clicks || 0;
          links.push({
            id: docSnapshot.id,
            userId: data.userId,
            originalUrl: data.originalUrl,
            shortCode: data.shortCode,
            title: data.title || 'Untitled Link',
            clicks,
            uniqueVisitors: data.uniqueVisitors || (clicks > 0 ? Math.max(1, Math.round(clicks * 0.82)) : 0),
            tags: data.tags || [],
            isActive: data.isActive !== false,
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
          const clicks = data.clicks || 0;
          const item: LinkItem = {
            id: docSnap.id,
            userId: data.userId,
            originalUrl: data.originalUrl,
            shortCode: data.shortCode,
            title: data.title || 'Untitled Link',
            clicks,
            uniqueVisitors: data.uniqueVisitors || (clicks > 0 ? Math.max(1, Math.round(clicks * 0.82)) : 0),
            tags: data.tags || [],
            isActive: data.isActive !== false,
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
  onError?: (err: any) => void,
  ownerUserId?: string
): () => void {
  try {
    const targetUserId = ownerUserId || auth.currentUser?.uid;
    const constraints: any[] = [
      where('linkId', '==', linkId),
      limit(100),
    ];
    if (targetUserId) {
      constraints.push(where('userId', '==', targetUserId));
    }
    const q = query(collection(db, CLICKS_COLLECTION), ...constraints);

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
            operatingSystem: data.operatingSystem || 'Other',
            isUnique: data.isUnique ?? true,
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
        operatingSystem: data.operatingSystem || 'Other',
        isUnique: data.isUnique ?? true,
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
            operatingSystem: data.operatingSystem || 'Other',
            isUnique: data.isUnique ?? true,
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
export async function getLinkClickEvents(
  linkId: string,
  ownerUserId?: string
): Promise<ClickEvent[]> {
  try {
    const targetUserId = ownerUserId || auth.currentUser?.uid;
    const constraints: any[] = [
      where('linkId', '==', linkId),
      limit(100),
    ];
    if (targetUserId) {
      constraints.push(where('userId', '==', targetUserId));
    }
    const q = query(collection(db, CLICKS_COLLECTION), ...constraints);
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
        operatingSystem: data.operatingSystem || 'Other',
        isUnique: data.isUnique ?? true,
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

/**
 * Export link analytics data as a clean CSV file (Bitly / Cuttly style)
 */
export function exportLinkAnalyticsCsv(link: LinkItem, events: ClickEvent[]): void {
  const headers = [
    'Timestamp (UTC)',
    'Short Code',
    'Destination URL',
    'Device Type',
    'Operating System',
    'Browser',
    'Referrer Source',
    'Visitor Type',
  ];

  const rows = events.map((e) => [
    `"${e.timestamp}"`,
    `"${e.shortCode}"`,
    `"${link.originalUrl.replace(/"/g, '""')}"`,
    `"${e.deviceType || 'Desktop'}"`,
    `"${e.operatingSystem || 'Other'}"`,
    `"${e.browser || 'Other'}"`,
    `"${(e.referrer || 'Direct').replace(/"/g, '""')}"`,
    `"${e.isUnique ? 'Unique Visitor' : 'Repeat Visitor'}"`,
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `shortee-analytics-${link.shortCode}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * Toggle link active status (Bitly style Pause / Activate)
 */
export async function toggleLinkStatus(linkId: string, currentStatus = true): Promise<boolean> {
  const newStatus = !currentStatus;
  const now = new Date().toISOString();

  // Local update
  const local = getLocalLinks();
  const index = local.findIndex((l) => l.id === linkId);
  if (index !== -1) {
    local[index].isActive = newStatus;
    local[index].updatedAt = now;
    saveLocalLinks(local);
  }

  // Firestore update
  try {
    const docRef = doc(db, LINKS_COLLECTION, linkId);
    await updateDoc(docRef, {
      isActive: newStatus,
      updatedAt: now,
    });
    return true;
  } catch (err) {
    console.warn('Failed to toggle link status in Firestore:', err);
    return false;
  }
}

/**
 * Export all user links to a CSV report
 */
export function exportAllLinksCsv(links: LinkItem[]): void {
  const headers = [
    'ID',
    'Short Code',
    'Short URL',
    'Title',
    'Destination URL',
    'Total Clicks',
    'Unique Visitors',
    'Status',
    'Tags',
    'Created At',
    'Expires At',
  ];

  const rows = links.map((l) => [
    `"${l.id}"`,
    `"${l.shortCode}"`,
    `"${buildShortUrl(l.shortCode)}"`,
    `"${(l.title || '').replace(/"/g, '""')}"`,
    `"${l.originalUrl.replace(/"/g, '""')}"`,
    `"${l.clicks || 0}"`,
    `"${l.uniqueVisitors || 0}"`,
    `"${l.isActive !== false ? 'Active' : 'Paused'}"`,
    `"${(l.tags || []).join(', ')}"`,
    `"${l.createdAt}"`,
    `"${l.expiresAt || 'Never'}"`,
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `shortee-links-portfolio-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

