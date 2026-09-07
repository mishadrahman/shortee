import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  MousePointerClick,
  Calendar,
  ExternalLink,
  Copy,
  Check,
  QrCode,
  Laptop,
  Smartphone,
  Tablet,
  Globe,
  Clock,
  AlertCircle,
  BarChart2,
  RefreshCw,
} from 'lucide-react';
import { useAppRouter } from '../lib/router';
import {
  getLinkById,
  getLinkClickEvents,
  getLocalLinks,
  subscribeToLink,
  subscribeToLinkClickEvents,
} from '../services/linkService';
import { LinkItem, ClickEvent } from '../types';
import { buildShortUrl } from '../lib/urlUtils';

interface LinkAnalyticsPageProps {
  linkId: string;
  onOpenQrModal: (link: LinkItem) => void;
}

export const LinkAnalyticsPage: React.FC<LinkAnalyticsPageProps> = ({
  linkId,
  onOpenQrModal,
}) => {
  const { navigate } = useAppRouter();
  const [link, setLink] = useState<LinkItem | null>(() => {
    if (typeof window !== 'undefined') {
      return getLocalLinks().find((l) => l.id === linkId || l.shortCode === linkId) || null;
    }
    return null;
  });
  const [clickEvents, setClickEvents] = useState<ClickEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const cached = getLocalLinks().find((l) => l.id === linkId || l.shortCode === linkId);
      return !cached;
    }
    return true;
  });
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadData = async (showLoadingState = false) => {
    if (!linkId) return;
    try {
      if (showLoadingState) setRefreshing(true);
      const linkData = await getLinkById(linkId);
      if (!linkData) {
        setError('Shortened link not found or you do not have permission to view it.');
        return;
      }
      setLink(linkData);

      const events = await getLinkClickEvents(linkData.id);
      setClickEvents(events);
    } catch (err: any) {
      console.error('Error fetching analytics:', err);
      setError('Failed to load link analytics. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData(false);

    let unsubLink = () => {};
    let unsubEvents = () => {};

    // Subscribe once we have or discover the link
    getLinkById(linkId).then((resolvedLink) => {
      if (resolvedLink) {
        setLink(resolvedLink);
        unsubLink = subscribeToLink(resolvedLink.id, (fresh) => {
          if (fresh) setLink(fresh);
        });
        unsubEvents = subscribeToLinkClickEvents(resolvedLink.id, (freshEvents) => {
          setClickEvents(freshEvents);
        });
      }
    });

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadData(false);
      }
    };
    window.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);

    return () => {
      unsubLink();
      unsubEvents();
      window.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
    };
  }, [linkId]);

  const handleCopy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(buildShortUrl(link.shortCode));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 text-center">
        <div className="w-8 h-8 border-2 border-slate-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs text-slate-500">Loading link analytics...</p>
      </div>
    );
  }

  if (error || !link) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950 text-rose-600 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Analytics Unavailable</h2>
        <p className="text-xs text-slate-500 mt-2 mb-6">{error || 'Link could not be retrieved.'}</p>
        <button
          onClick={() => navigate('/dashboard/links')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to My Links
        </button>
      </div>
    );
  }

  const shortUrl = buildShortUrl(link.shortCode);

  // Compute Device Breakdown
  const deviceCounts = clickEvents.reduce(
    (acc, evt) => {
      const type = evt.deviceType || 'Desktop';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    },
    { Desktop: 0, Mobile: 0, Tablet: 0 } as Record<string, number>
  );

  const totalLoggedEvents = clickEvents.length || 1;
  const desktopPct = Math.round((deviceCounts.Desktop / totalLoggedEvents) * 100);
  const mobilePct = Math.round((deviceCounts.Mobile / totalLoggedEvents) * 100);
  const tabletPct = Math.round((deviceCounts.Tablet / totalLoggedEvents) * 100);

  // Compute Referrers Breakdown
  const referrerCounts: Record<string, number> = {};
  clickEvents.forEach((evt) => {
    const ref = evt.referrer || 'Direct / None';
    referrerCounts[ref] = (referrerCounts[ref] || 0) + 1;
  });

  const sortedReferrers: [string, number][] = Object.entries(referrerCounts).sort(
    (a, b) => Number(b[1]) - Number(a[1])
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
      {/* Back button */}
      <div className="mb-6">
        <button
          id="back-to-links-btn"
          onClick={() => navigate('/dashboard/links')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Links
        </button>
      </div>

      {/* Link Header Card */}
      <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Link Analytics
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono font-medium bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                Active
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1 truncate">
              {link.title || link.shortCode}
            </h1>

            {/* Target and Short URL info */}
            <div className="mt-3 space-y-1 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-500">Short URL:</span>
                <span className="font-mono font-medium text-slate-900 dark:text-slate-100 select-all">
                  {shortUrl}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-500">Destination:</span>
                <span className="text-slate-500 truncate max-w-xl">{link.originalUrl}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              title="Refresh stats"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-slate-900 dark:text-white' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy Link'}
            </button>

            <a
              href={shortUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Visit
            </a>

            <button
              onClick={() => onOpenQrModal(link)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950 text-xs font-semibold shadow-sm transition-all"
            >
              <QrCode className="w-3.5 h-3.5" />
              QR Code
            </button>
          </div>
        </div>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Total Clicks</span>
            <MousePointerClick className="w-4 h-4" />
          </div>
          <div className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
            {link.clicks}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Total visitor redirects recorded</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Created Date</span>
            <Calendar className="w-4 h-4" />
          </div>
          <div className="mt-2 text-lg font-bold text-slate-900 dark:text-white">
            {new Date(link.createdAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {new Date(link.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Last Activity</span>
            <Clock className="w-4 h-4" />
          </div>
          <div className="mt-2 text-lg font-bold text-slate-900 dark:text-white">
            {link.updatedAt ? new Date(link.updatedAt).toLocaleDateString() : 'Never'}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Most recent click recorded</p>
        </div>
      </div>

      {/* Analytics Breakdown Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Device Breakdown */}
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Laptop className="w-4 h-4 text-slate-500" />
              Device Distribution
            </h3>
            <span className="text-xs text-slate-400 font-medium">Safe client tracking</span>
          </div>

          <div className="space-y-4">
            {/* Desktop */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="flex items-center gap-2 font-medium">
                  <Laptop className="w-3.5 h-3.5 text-slate-400" /> Desktop
                </span>
                <span className="font-mono text-slate-500">
                  {deviceCounts.Desktop} ({desktopPct}%)
                </span>
              </div>
              <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-slate-800 dark:bg-slate-200 rounded-full" style={{ width: `${desktopPct}%` }} />
              </div>
            </div>

            {/* Mobile */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="flex items-center gap-2 font-medium">
                  <Smartphone className="w-3.5 h-3.5 text-slate-400" /> Mobile
                </span>
                <span className="font-mono text-slate-500">
                  {deviceCounts.Mobile} ({mobilePct}%)
                </span>
              </div>
              <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-slate-800 dark:bg-slate-200 rounded-full" style={{ width: `${mobilePct}%` }} />
              </div>
            </div>

            {/* Tablet */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="flex items-center gap-2 font-medium">
                  <Tablet className="w-3.5 h-3.5 text-slate-400" /> Tablet
                </span>
                <span className="font-mono text-slate-500">
                  {deviceCounts.Tablet} ({tabletPct}%)
                </span>
              </div>
              <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-slate-800 dark:bg-slate-200 rounded-full" style={{ width: `${tabletPct}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Top Referrers */}
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Globe className="w-4 h-4 text-slate-500" />
              Referral Sources
            </h3>
            <span className="text-xs text-slate-400 font-medium">{sortedReferrers.length} channels</span>
          </div>

          {sortedReferrers.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-6 text-center">
              No referral data recorded yet. Test the link by visiting it.
            </p>
          ) : (
            <div className="space-y-3">
              {sortedReferrers.slice(0, 5).map(([ref, count]: [string, number]) => {
                const pct = Math.round((Number(count) / totalLoggedEvents) * 100);
                return (
                  <div key={ref} className="flex items-center justify-between text-xs py-1 border-b border-slate-100 dark:border-slate-800 last:border-none">
                    <span className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[200px]">
                      {ref}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-slate-400">{pct}%</span>
                      <span className="font-semibold font-mono text-slate-700 dark:text-slate-300">
                        {count} {count === 1 ? 'click' : 'clicks'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent Click Events Feed */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-sm text-slate-900 dark:text-white">
              Recent Click Events
            </h3>
            <p className="text-xs text-slate-500">Live feed of visitor redirections</p>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {clickEvents.length} recorded events
          </span>
        </div>

        {clickEvents.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            No click events recorded yet. Share your short URL or click "Visit" to log your first redirect!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-semibold uppercase text-[10px]">
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Device</th>
                  <th className="py-2.5 px-3">Browser</th>
                  <th className="py-2.5 px-3">Referrer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {clickEvents.slice(0, 20).map((evt, idx) => (
                  <tr key={evt.id || idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-400">
                      {new Date(evt.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-800 dark:text-slate-200">
                      {evt.deviceType}
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                      {evt.browser}
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                      {evt.referrer}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
