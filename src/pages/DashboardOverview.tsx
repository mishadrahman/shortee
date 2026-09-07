import React, { useState, useEffect } from 'react';
import {
  Link2,
  MousePointerClick,
  Plus,
  ExternalLink,
  Copy,
  Check,
  QrCode,
  BarChart2,
  Trash2,
  ArrowUpRight,
  Clock,
  Sparkles,
  AlertCircle,
  RefreshCw,
  Laptop,
  Smartphone,
  Tablet,
  Globe,
  Activity,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAppRouter } from '../lib/router';
import {
  getUserLinks,
  deleteShortLink,
  getLocalLinks,
  subscribeToUserLinks,
  subscribeToUserClickEvents,
  getUserRecentClickEvents,
} from '../services/linkService';
import { LinkItem, ClickEvent } from '../types';
import { buildShortUrl } from '../lib/urlUtils';

interface DashboardOverviewProps {
  onOpenCreateModal: () => void;
  onOpenQrModal: (link: LinkItem) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  onOpenCreateModal,
  onOpenQrModal,
}) => {
  const { currentUser, userProfile } = useAuth();
  const { navigate } = useAppRouter();

  const [links, setLinks] = useState<LinkItem[]>(() => {
    if (typeof window !== 'undefined') {
      return getLocalLinks();
    }
    return [];
  });
  const [clickEvents, setClickEvents] = useState<ClickEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return getLocalLinks().length === 0;
    }
    return true;
  });
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchLinks = async (showLoadingState = true) => {
    if (!currentUser) return;
    try {
      if (showLoadingState) setRefreshing(true);
      const [data, events] = await Promise.all([
        getUserLinks(currentUser.uid),
        getUserRecentClickEvents(currentUser.uid, 10),
      ]);
      setLinks(data);
      setClickEvents(events);
    } catch (err: any) {
      console.error('Failed to load links:', err);
      setError('Unable to load your dashboard links. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!currentUser) return;

    // 1. Initial fresh fetch
    fetchLinks(false);

    // 2. Real-time Firestore subscription to user's links
    const unsubLinks = subscribeToUserLinks(
      currentUser.uid,
      (freshLinks) => {
        setLinks(freshLinks);
        setLoading(false);
      },
      (err) => console.warn('Realtime subscription warning:', err)
    );

    // 3. Real-time Firestore subscription to recent click events
    const unsubEvents = subscribeToUserClickEvents(
      currentUser.uid,
      (freshEvents) => {
        setClickEvents(freshEvents);
      }
    );

    // 4. Listen for tab focus / visibilitychange so returning to tab is always 100% updated
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchLinks(false);
      }
    };
    window.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);

    return () => {
      unsubLinks();
      unsubEvents();
      window.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
    };
  }, [currentUser]);

  const totalLinks = links.length;
  const totalClicks = links.reduce((acc, curr) => acc + (curr.clicks || 0), 0);
  const recentLinks = links.slice(0, 5);

  const handleCopy = async (link: LinkItem) => {
    const shortUrl = buildShortUrl(link.shortCode);
    await navigator.clipboard.writeText(shortUrl);
    setCopiedId(link.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = async (linkId: string) => {
    if (!confirm('Are you sure you want to delete this shortened link? Redirection will stop immediately.')) {
      return;
    }
    setDeletingId(linkId);
    try {
      await deleteShortLink(linkId);
      setLinks((prev) => prev.filter((l) => l.id !== linkId));
    } catch (err) {
      console.error('Failed to delete link:', err);
      alert('Could not delete link. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-8 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Dashboard
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Welcome back, {userProfile?.displayName || currentUser?.email?.split('@')[0]}. Here is an overview of your links and engagement.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={() => fetchLinks(true)}
            disabled={refreshing}
            title="Refresh links and analytics"
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold text-xs transition-all shadow-xs cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-slate-900 dark:text-white' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            id="overview-create-link-btn"
            onClick={onOpenCreateModal}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 font-semibold text-xs transition-all shadow-sm active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Shorten New URL</span>
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="mt-6 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => fetchLinks(true)}
            className="underline font-semibold hover:text-rose-950 dark:hover:text-rose-100 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mt-6">
        {/* Total Links Card */}
        <div
          className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:shadow-md animate-fade-in"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Links</span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center">
              <Link2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900 dark:text-white">
              {loading ? '...' : totalLinks}
            </span>
            <span className="text-xs text-slate-500">active URLs</span>
          </div>
        </div>

        {/* Total Clicks Card */}
        <div
          className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:shadow-md animate-fade-in"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Clicks</span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center">
              <MousePointerClick className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900 dark:text-white">
              {loading ? '...' : totalClicks.toLocaleString()}
            </span>
            <span className="text-xs text-slate-500">all-time visits</span>
          </div>
        </div>

        {/* Average Engagement Card */}
        <div
          className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:shadow-md animate-fade-in"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Avg. Clicks / Link</span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center">
              <BarChart2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900 dark:text-white">
              {loading ? '...' : totalLinks > 0 ? (totalClicks / totalLinks).toFixed(1) : '0'}
            </span>
            <span className="text-xs text-slate-500">clicks per URL</span>
          </div>
        </div>
      </div>

      {/* Recent Links Section */}
      <div className="mt-10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Recent Links</h2>
            <p className="text-xs text-slate-500">Your latest shortened links and quick actions</p>
          </div>
          {links.length > 5 && (
            <button
              onClick={() => navigate('/dashboard/links')}
              className="text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center gap-1"
            >
              <span>View all ({totalLinks})</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
            <div className="w-6 h-6 border-2 border-slate-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-slate-500">Loading your shortened links...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && links.length === 0 && (
          <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-4">
              <Link2 className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-sm text-slate-900 dark:text-white">No shortened links yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-5">
              Create your first shortened link to get a unique short URL, QR code, and click analytics.
            </p>
            <button
              onClick={onOpenCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              Shorten Your First URL
            </button>
          </div>
        )}

        {/* Links Table/Cards */}
        {!loading && recentLinks.length > 0 && (
          <div className="overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {recentLinks.map((link, idx) => {
                const shortUrl = buildShortUrl(link.shortCode);
                const isCopied = copiedId === link.id;
                const isDeleting = deletingId === link.id;

                return (
                  <div
                    key={link.id}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    {/* Link Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                          {link.title || link.shortCode}
                        </h3>
                        <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {link.clicks} {link.clicks === 1 ? 'click' : 'clicks'}
                        </span>
                      </div>

                      {/* URLs */}
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-xs">
                        <span className="font-mono text-slate-800 dark:text-slate-200 font-medium">
                          {shortUrl}
                        </span>
                        <span className="hidden sm:inline text-slate-300 dark:text-slate-700">•</span>
                        <span className="text-slate-400 dark:text-slate-500 truncate max-w-xs sm:max-w-md">
                          {link.originalUrl}
                        </span>
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>Created {new Date(link.createdAt).toLocaleDateString()}</span>
                        </div>

                        {link.expiresAt && (() => {
                          const isExpired = new Date(link.expiresAt).getTime() <= Date.now();
                          return isExpired ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 font-semibold uppercase">
                              Expired
                            </span>
                          ) : (
                            <span
                              className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 font-medium"
                              title={`Expires on ${new Date(link.expiresAt).toLocaleString()}`}
                            >
                              Expires {new Date(link.expiresAt).toLocaleDateString()}
                            </span>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                      {/* Copy */}
                      <button
                        onClick={() => handleCopy(link)}
                        title="Copy short link"
                        className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
                      >
                        {isCopied ? (
                          <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>

                      {/* Open */}
                      <a
                        href={shortUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open short link"
                        className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>

                      {/* QR */}
                      <button
                        onClick={() => onOpenQrModal(link)}
                        title="View QR Code"
                        className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
                      >
                        <QrCode className="w-4 h-4" />
                      </button>

                      {/* Analytics */}
                      <button
                        onClick={() => navigate(`/dashboard/analytics/${link.id}`)}
                        title="View Link Analytics"
                        className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
                      >
                        <BarChart2 className="w-4 h-4" />
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => handleDelete(link.id)}
                        disabled={isDeleting}
                        title="Delete Link"
                        className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Live Click Activities Stream */}
        <div className="mt-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  Recent Click Activity
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                    Live
                  </span>
                </h2>
                <p className="text-xs text-slate-500">Real-time visitor interactions across your links</p>
              </div>
            </div>

            <span className="text-xs font-mono text-slate-400">
              {clickEvents.length} {clickEvents.length === 1 ? 'event' : 'events'} recorded
            </span>
          </div>

          {clickEvents.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-400">
              <p>No recent click events recorded yet.</p>
              <p className="mt-1 text-slate-500">Share or test any of your links above to see live activity streams appear here instantly.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {clickEvents.slice(0, 8).map((evt, idx) => (
                <div
                  key={evt.id || idx}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
                      {evt.deviceType === 'Mobile' ? (
                        <Smartphone className="w-4 h-4" />
                      ) : evt.deviceType === 'Tablet' ? (
                        <Tablet className="w-4 h-4" />
                      ) : (
                        <Laptop className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-slate-900 dark:text-white">
                          /{evt.shortCode}
                        </span>
                        {evt.linkTitle && evt.linkTitle !== evt.shortCode && (
                          <span className="text-xs text-slate-500 truncate max-w-[200px]">
                            • {evt.linkTitle}
                          </span>
                        )}
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
                          {evt.deviceType}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                        <span>Source: <strong className="text-slate-600 dark:text-slate-300 font-normal">{evt.referrer || 'Direct'}</strong></span>
                        <span>•</span>
                        <span>Browser: <strong className="text-slate-600 dark:text-slate-300 font-normal">{evt.browser}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center">
                    <span className="text-xs font-mono text-slate-400">
                      {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                    <button
                      onClick={() => navigate(`/dashboard/analytics/${evt.linkId}`)}
                      className="p-1.5 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                      title="View Link Analytics"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
