export interface DestinationPreviewData {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  favicon?: string;
  url: string;
}

/**
 * Fetch rich Open Graph / Twitter Card metadata for a destination URL
 * via the server-side API proxy (/api/preview-meta).
 */
export async function fetchDestinationPreview(targetUrl: string): Promise<DestinationPreviewData | null> {
  if (!targetUrl || typeof targetUrl !== 'string') return null;

  const trimmed = targetUrl.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return null;
  }

  try {
    const res = await fetch(`/api/preview-meta?url=${encodeURIComponent(trimmed)}`);
    if (!res.ok) {
      // Return basic fallback from URL parsing
      return getFallbackPreview(trimmed);
    }
    const data = await res.json();
    return {
      title: data.title || getHostnameFromUrl(trimmed),
      description: data.description || '',
      image: data.image || '',
      siteName: data.siteName || getHostnameFromUrl(trimmed),
      favicon: data.favicon || `https://www.google.com/s2/favicons?domain=${encodeURIComponent(getHostnameFromUrl(trimmed))}&sz=64`,
      url: trimmed,
    };
  } catch (err) {
    console.warn('Failed to fetch preview from API, using fallback:', err);
    return getFallbackPreview(trimmed);
  }
}

function getHostnameFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function getFallbackPreview(url: string): DestinationPreviewData {
  const host = getHostnameFromUrl(url);
  return {
    title: host,
    description: `Link to ${host}`,
    image: '',
    siteName: host,
    favicon: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`,
    url,
  };
}
