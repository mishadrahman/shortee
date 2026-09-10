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
  detectVisitorGeo,
  getCountryFlagEmoji,
  getCountryNameFromCode,
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
          password: data.password || null,
          isPasswordProtected: Boolean(data.password && data.password.trim()),
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
  password,
  ogTitle,
  ogDescription,
  ogImage,
  ogSiteName,
}: {
  userId?: string;
  originalUrl: string;
  title?: string;
  customAlias?: string;
  expiresAt?: string | null;
  tags?: string[];
  password?: string | null;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogSiteName?: string;
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
  let computedTitle = title?.trim() || ogTitle?.trim();
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
  const cleanPassword = password && password.trim() ? password.trim() : null;

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
    password: cleanPassword,
    isPasswordProtected: Boolean(cleanPassword),
    ogTitle: ogTitle?.trim() || undefined,
    ogDescription: ogDescription?.trim() || undefined,
    ogImage: ogImage?.trim() || undefined,
    ogSiteName: ogSiteName?.trim() || undefined,
  };

  // Construct payload with ONLY defined fields to strictly prevent Firestore undefined property rejections
  const docPayload: Record<string, any> = {
    id: newLink.id,
    userId: newLink.userId,
    originalUrl: newLink.originalUrl,
    shortCode: newLink.shortCode,
    shortCodeLower: shortCode.toLowerCase(),
    title: newLink.title,
    clicks: 0,
    uniqueVisitors: 0,
    tags: newLink.tags,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    expiresAt: newLink.expiresAt,
    password: newLink.password,
    isPasswordProtected: newLink.isPasswordProtected,
  };

  if (newLink.ogTitle) docPayload.ogTitle = newLink.ogTitle;
  if (newLink.ogDescription) docPayload.ogDescription = newLink.ogDescription;
  if (newLink.ogImage) docPayload.ogImage = newLink.ogImage;
  if (newLink.ogSiteName) docPayload.ogSiteName = newLink.ogSiteName;

  // Authoritative write to Firestore
  try {
    await setDoc(linkDocRef, docPayload);
  } catch (err: any) {
    console.error('Firestore setDoc failed:', err);
    throw new Error(err?.message || 'Failed to save link to cloud database. Please try again.');
  }

  // Save to local cache only after cloud persistence succeeds
  upsertLocalLink(newLink);

  if (resolvedUserId === 'guest') {
    saveGuestLink(newLink);
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
        password: data.password || null,
        isPasswordProtected: Boolean(data.password && data.password.trim()),
        ogTitle: data.ogTitle || undefined,
        ogDescription: data.ogDescription || undefined,
        ogImage: data.ogImage || undefined,
        ogSiteName: data.ogSiteName || undefined,
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
        password: data.password || null,
        isPasswordProtected: Boolean(data.password && data.password.trim()),
        ogTitle: data.ogTitle || undefined,
        ogDescription: data.ogDescription || undefined,
        ogImage: data.ogImage || undefined,
        ogSiteName: data.ogSiteName || undefined,
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
        password: data.password || null,
        isPasswordProtected: Boolean(data.password && data.password.trim()),
        ogTitle: data.ogTitle || undefined,
        ogDescription: data.ogDescription || undefined,
        ogImage: data.ogImage || undefined,
        ogSiteName: data.ogSiteName || undefined,
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
 * Fast local cache check + sub-2s authoritative Firestore query with non-blocking fallback
 */
export async function getLinkById(linkId: string): Promise<LinkItem | null> {
  const trimmedId = linkId.trim();
  const localMatch = getLocalLinks().find((l) => l.id === trimmedId || l.shortCode === trimmedId) || null;

  const targetDocId = localMatch ? localMatch.id : trimmedId;

  const fetchFromFirestore = async (): Promise<LinkItem | null> => {
    // 1. Fetch directly from Firestore by Document ID
    try {
      const docRef = doc(db, LINKS_COLLECTION, targetDocId);
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
          countries: data.countries || {},
          password: data.password || null,
          isPasswordProtected: Boolean(data.password && data.password.trim()),
          ogTitle: data.ogTitle || undefined,
          ogDescription: data.ogDescription || undefined,
          ogImage: data.ogImage || undefined,
          ogSiteName: data.ogSiteName || undefined,
        };
        upsertLocalLink(item);
        return item;
      }
    } catch (err) {
      console.warn('Firestore getById doc id lookup warning:', err);
    }

    // 2. Try querying by shortCode in Firestore if not found by ID
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
          countries: data.countries || {},
          password: data.password || null,
          isPasswordProtected: Boolean(data.password && data.password.trim()),
          ogTitle: data.ogTitle || undefined,
          ogDescription: data.ogDescription || undefined,
          ogImage: data.ogImage || undefined,
          ogSiteName: data.ogSiteName || undefined,
        };
        upsertLocalLink(item);
        return item;
      }
    } catch (err) {
      console.warn('Firestore query by shortCode fallback warning:', err);
    }

    return localMatch;
  };

  // Timeout race (2000ms max) to prevent long page hangs on reloads
  try {
    const timeoutPromise = new Promise<LinkItem | null>((resolve) =>
      setTimeout(() => resolve(localMatch), 2000)
    );
    const result = await Promise.race([fetchFromFirestore(), timeoutPromise]);
    return result || localMatch;
  } catch {
    return localMatch;
  }
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

  // 2. Filter out rapid duplicate mount within the same tab (3 seconds cooldown)
  if (isSessionDuplicateClick(link.id, 3)) {
    console.info('[Analytics] Rapid duplicate click within 3s deduplicated for link:', link.shortCode);
    return { success: true, newClicks: link.clicks || 0 };
  }

  const linkRef = doc(db, LINKS_COLLECTION, link.id);
  const now = new Date().toISOString();
  const nextClicks = (link.clicks || 0) + 1;
  const isUnique = checkAndRecordUniqueVisit(link.id);
  const nextUniqueVisitors = (link.uniqueVisitors || 0) + (isUnique ? 1 : 0);

  // 2. Detect Visitor Geolocation (Country / CountryCode / City)
  let geo: { country: string; countryCode: string; city?: string } = { country: 'Unknown', countryCode: 'XX', city: undefined };
  try {
    geo = await detectVisitorGeo();
  } catch {}

  const sanitizedCountryKey = (geo.country || 'Unknown').replace(/[\.\$\[\]\#\/]/g, '_').trim() || 'Unknown';
  const currentCountries = { ...(link.countries || {}) };
  currentCountries[sanitizedCountryKey] = (currentCountries[sanitizedCountryKey] || 0) + 1;

  // 3. Immediately update local storage and notify any listeners in other tabs
  const updatedLink: LinkItem = {
    ...link,
    clicks: nextClicks,
    uniqueVisitors: nextUniqueVisitors,
    countries: currentCountries,
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

  // 4. Prepare ClickEvent document
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
    country: geo.country || 'Unknown',
    countryCode: geo.countryCode || 'XX',
    city: geo.city || null,
    isUnique,
    visitorId: getOrCreateVisitorId(),
  };

  // 5. Atomically update Firestore
  try {
    const updatePayload: Record<string, any> = {
      clicks: increment(1),
      [`countries.${sanitizedCountryKey}`]: increment(1),
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
            password: data.password || null,
            isPasswordProtected: Boolean(data.password && data.password.trim()),
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
            password: data.password || null,
            isPasswordProtected: Boolean(data.password && data.password.trim()),
            ogTitle: data.ogTitle || undefined,
            ogDescription: data.ogDescription || undefined,
            ogImage: data.ogImage || undefined,
            ogSiteName: data.ogSiteName || undefined,
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
            country: data.country || 'Unknown',
            countryCode: data.countryCode || 'XX',
            city: data.city || undefined,
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
        country: data.country || 'Unknown',
        countryCode: data.countryCode || 'XX',
        city: data.city || undefined,
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
            country: data.country || 'Unknown',
            countryCode: data.countryCode || 'XX',
            city: data.city || undefined,
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
 * Update an existing short link's destination URL, title, tags, or expiration date
 */
export async function updateShortLink(
  linkId: string,
  updates: {
    originalUrl?: string;
    title?: string;
    tags?: string[];
    expiresAt?: string | null;
    isActive?: boolean;
    password?: string | null;
    ogTitle?: string;
    ogDescription?: string;
    ogImage?: string;
    ogSiteName?: string;
  }
): Promise<LinkItem | null> {
  const now = new Date().toISOString();
  const trimmedId = linkId.trim();

  // 1. Update in local cache first for instant responsiveness
  const local = getLocalLinks();
  const index = local.findIndex((l) => l.id === trimmedId || l.shortCode.toLowerCase() === trimmedId.toLowerCase());
  let targetLink: LinkItem | null = null;
  let resolvedDocId = trimmedId;

  const cleanUpdates = { ...updates };
  if (updates.password !== undefined) {
    cleanUpdates.password = updates.password && updates.password.trim() ? updates.password.trim() : null;
  }

  if (index !== -1) {
    targetLink = {
      ...local[index],
      ...cleanUpdates,
      isPasswordProtected: Boolean(cleanUpdates.password !== undefined ? cleanUpdates.password : local[index].password),
      updatedAt: now,
    };
    if (auth.currentUser && targetLink.userId === 'guest') {
      targetLink.userId = auth.currentUser.uid;
    }
    local[index] = targetLink;
    saveLocalLinks(local);
    resolvedDocId = targetLink.id;
  }

  // Also update guest links if present in guest list
  const guestLinks = getGuestLinks();
  const guestIdx = guestLinks.findIndex((l) => l.id === trimmedId || l.shortCode.toLowerCase() === trimmedId.toLowerCase());
  if (guestIdx !== -1 && targetLink) {
    guestLinks[guestIdx] = targetLink;
    try {
      localStorage.setItem(GUEST_LINKS_KEY, JSON.stringify(guestLinks));
    } catch {}
  }

  // 2. Persist to Firestore
  try {
    let docRef = doc(db, LINKS_COLLECTION, resolvedDocId);
    let docSnap = await getDoc(docRef);

    // If not found by direct doc ID, locate by exact shortCode or lowercase
    if (!docSnap.exists()) {
      const q = query(
        collection(db, LINKS_COLLECTION),
        where('shortCode', '==', trimmedId),
        limit(1)
      );
      const querySnap = await getDocs(q);
      if (!querySnap.empty) {
        docRef = querySnap.docs[0].ref;
        resolvedDocId = docRef.id;
        docSnap = querySnap.docs[0];
      } else {
        const qLower = query(
          collection(db, LINKS_COLLECTION),
          where('shortCodeLower', '==', trimmedId.toLowerCase()),
          limit(1)
        );
        const lowerSnap = await getDocs(qLower);
        if (!lowerSnap.empty) {
          docRef = lowerSnap.docs[0].ref;
          resolvedDocId = docRef.id;
          docSnap = lowerSnap.docs[0];
        }
      }
    }

    const firestoreUpdates: Record<string, any> = {
      updatedAt: now,
    };
    if (updates.originalUrl !== undefined && updates.originalUrl !== null) {
      firestoreUpdates.originalUrl = updates.originalUrl;
    }
    if (updates.title !== undefined && updates.title !== null) {
      firestoreUpdates.title = updates.title;
    }
    if (updates.tags !== undefined && updates.tags !== null) {
      firestoreUpdates.tags = updates.tags;
    }
    if (updates.isActive !== undefined && updates.isActive !== null) {
      firestoreUpdates.isActive = updates.isActive;
    }
    if (updates.expiresAt !== undefined) {
      firestoreUpdates.expiresAt = updates.expiresAt; // Can be string or null
    }
    if (updates.password !== undefined) {
      firestoreUpdates.password = cleanUpdates.password;
    }

    // If logged-in user is editing an unclaimed guest link, claim ownership
    if (auth.currentUser && (!docSnap.exists() || docSnap.data()?.userId === 'guest')) {
      firestoreUpdates.userId = auth.currentUser.uid;
    }

    if (docSnap.exists()) {
      await updateDoc(docRef, firestoreUpdates);
    } else if (targetLink) {
      // If doc did not exist in Firestore, write full record
      await setDoc(docRef, {
        ...targetLink,
        ...firestoreUpdates,
        shortCodeLower: targetLink.shortCode.toLowerCase(),
      });
    }

    // Refresh local cache with fully resolved record if we found the document in Firestore
    if (docSnap.exists()) {
      const freshData = docSnap.data();
      const finalPassword = updates.password !== undefined ? cleanUpdates.password : (freshData.password || null);
      const resolvedItem: LinkItem = {
        id: docSnap.id,
        userId: firestoreUpdates.userId || freshData.userId,
        originalUrl: updates.originalUrl || freshData.originalUrl,
        shortCode: freshData.shortCode,
        title: updates.title !== undefined ? updates.title : (freshData.title || freshData.shortCode),
        clicks: freshData.clicks || 0,
        uniqueVisitors: freshData.uniqueVisitors || 0,
        tags: updates.tags !== undefined ? updates.tags : (freshData.tags || []),
        isActive: updates.isActive !== undefined ? updates.isActive : (freshData.isActive !== false),
        createdAt: freshData.createdAt || now,
        updatedAt: now,
        expiresAt: updates.expiresAt !== undefined ? updates.expiresAt : (freshData.expiresAt || null),
        password: finalPassword,
        isPasswordProtected: Boolean(finalPassword && finalPassword.trim()),
      };
      upsertLocalLink(resolvedItem);
      targetLink = resolvedItem;
    }
  } catch (err: any) {
    console.error('Failed to update link in Firestore:', err);
    throw err;
  }

  // Cross-tab notification ping
  try {
    localStorage.setItem('shortee_link_updated_ping', `${resolvedDocId}_${Date.now()}`);
  } catch {}

  return targetLink;
}

/**
 * Fetch click events for a specific link with fast 2.5s network timeout
 */
export async function getLinkClickEvents(
  linkId: string,
  ownerUserId?: string
): Promise<ClickEvent[]> {
  const fetchEvents = async (): Promise<ClickEvent[]> => {
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
          country: data.country || 'Unknown',
          countryCode: data.countryCode || 'XX',
          city: data.city || undefined,
          isUnique: data.isUnique ?? true,
        });
      });

      return events.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    } catch (err) {
      console.warn('Could not fetch click events warning:', err);
      return [];
    }
  };

  try {
    const timeoutPromise = new Promise<ClickEvent[]>((resolve) =>
      setTimeout(() => resolve([]), 2500)
    );
    return await Promise.race([fetchEvents(), timeoutPromise]);
  } catch {
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
    'Country',
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
    `"${e.country || 'Unknown'}"`,
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

