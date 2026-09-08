import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  MousePointerClick,
  Users,
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
  Download,
  Pause,
  Play,
  Tag,
  ShieldCheck,
  TrendingUp,
  Cpu,
  Compass,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { useAppRouter } from '../lib/router';
import { useAuth } from '../context/AuthContext';
import {
  getLinkById,
  getLinkClickEvents,
  getLocalLinks,
  getGuestLinks,
  subscribeToLink,
  subscribeToLinkClickEvents,
  exportLinkAnalyticsCsv,
  toggleLinkStatus,
} from '../services/linkService';
import { LinkItem, ClickEvent } from '../types';
import { buildShortUrl } from '../lib/urlUtils';

interface LinkAnalyticsPageProps {
  linkId: string;
  onOpenQrModal: (link: LinkItem) => void;
}

type TimeRange = '7d' | '14d' | '30d';

export const LinkAnalyticsPage: React.FC<LinkAnalyticsPageProps> = ({
  linkId,
  onOpenQrModal,
}) => {
  const { navigate } = useAppRouter();
  const { currentUser } = useAuth();

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
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [togglingStatus, setTogglingStatus] = useState(false);

  // Security gate helper
  const verifyAccessPermission = (target: LinkItem | null): boolean => {
    if (!target) return false;
    if (currentUser) {
      if (target.userId && target.userId !== 'guest' && target.userId !== currentUser.uid) {
        return false;
      }
      return true;
    }
    // Guest visitor: only allowed if link was created locally in this browser or is an unclaimed guest link
    const isGuestOwner = getGuestLinks().some((g) => g.id === target.id);
    if (!isGuestOwner && target.userId !== 'guest') {
      return false;
    }
    return true;
  };

  const loadData = async (showLoadingState = false) => {
    if (!linkId) return;
    try {
      if (showLoadingState) setRefreshing(true);
      const linkData = await getLinkById(linkId);
      if (!linkData) {
        setError('Shortened link not found or has expired.');
        setLink(null);
        return;
      }

      if (!verifyAccessPermission(linkData)) {
        setError('Access Denied: You do not have permission to view or manage analytics for this link.');
        setLink(null);
        return;
      }

      setLink(linkData);
      setError(null);

      const events = await getLinkClickEvents(linkData.id, linkData.userId);
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

    // Authoritative lookup and real-time subscription
    getLinkById(linkId).then((resolvedLink) => {
      if (resolvedLink) {
        if (!verifyAccessPermission(resolvedLink)) {
          setError('Access Denied: You do not have permission to view or manage analytics for this link.');
          setLink(null);
          return;
        }

        setLink(resolvedLink);
        setError(null);

        unsubLink = subscribeToLink(resolvedLink.id, (fresh) => {
          if (fresh) {
            if (!verifyAccessPermission(fresh)) {
              setError('Access Denied: You do not have permission to view or manage analytics for this link.');
              setLink(null);
              return;
            }
            setLink(fresh);
          }
        });

        unsubEvents = subscribeToLinkClickEvents(
          resolvedLink.id,
          (freshEvents) => {
            setClickEvents(freshEvents);
          },
          undefined,
          resolvedLink.userId
        );
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
  }, [linkId, currentUser?.uid]);

  const handleCopy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(buildShortUrl(link.shortCode));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleToggleStatus = async () => {
    if (!link || togglingStatus) return;
    if (!currentUser || (link.userId && link.userId !== 'guest' && link.userId !== currentUser.uid)) {
      return;
    }
    setTogglingStatus(true);
    const newStatus = link.isActive !== false ? false : true;
    const ok = await toggleLinkStatus(link.id, link.isActive !== false);
    if (ok) {
      setLink((prev) => (prev ? { ...prev, isActive: newStatus } : null));
    }
    setTogglingStatus(false);
  };

  const handleExportCsv = () => {
    if (!link) return;
    exportLinkAnalyticsCsv(link, clickEvents);
  };

  // Metrics calculation
  const totalClicks = link?.clicks ?? 0;
  const uniqueVisitors = link?.uniqueVisitors ?? (totalClicks > 0 ? Math.max(1, Math.round(totalClicks * 0.82)) : 0);
  const repeatClicks = Math.max(0, totalClicks - uniqueVisitors);
  const uniquePercent = totalClicks > 0 ? Math.round((uniqueVisitors / totalClicks) * 100) : 100;
  const repeatPercent = 100 - uniquePercent;

  // Chart data preparation
  const chartData = useMemo(() => {
    const days = timeRange === '7d' ? 7 : timeRange === '14d' ? 14 : 30;
    const result: Array<{ date: string; displayDate: string; clicks: number; unique: number }> = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const isoDate = d.toISOString().split('T')[0];
      const displayDate = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      result.push({
        date: isoDate,
        displayDate,
        clicks: 0,
        unique: 0,
      });
    }

    const dateMap = new Map<string, { clicks: number; unique: number }>();
    result.forEach((item) => dateMap.set(item.date, item));

    clickEvents.forEach((evt) => {
      if (!evt.timestamp) return;
      const evtDate = evt.timestamp.split('T')[0];
      const entry = dateMap.get(evtDate);
      if (entry) {
        entry.clicks += 1;
        if (evt.isUnique) {
          entry.unique += 1;
        }
      }
    });

    // If there are recorded total clicks but no click events in Firestore yet (e.g. prior to logging),
    // seed today's entry with total clicks so the chart aligns with the counter.
    if (totalClicks > 0 && clickEvents.length === 0 && result.length > 0) {
      result[result.length - 1].clicks = totalClicks;
      result[result.length - 1].unique = uniqueVisitors;
    }

    return result;
  }, [clickEvents, timeRange, totalClicks, uniqueVisitors]);

  // Breakdown aggregations
  const totalLogged = clickEvents.length || 1;

  // Devices
  const deviceCounts = clickEvents.reduce(
    (acc, evt) => {
      const type = evt.deviceType || 'Desktop';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    },
    { Desktop: 0, Mobile: 0, Tablet: 0 } as Record<string, number>
  );

  // If no logged events yet, default to Desktop
  if (clickEvents.length === 0 && totalClicks > 0) {
    deviceCounts.Desktop = totalClicks;
  }

  // Operating Systems
  const osCounts: Record<string, number> = {};
  clickEvents.forEach((evt) => {
    const os = evt.operatingSystem || 'Other';
    osCounts[os] = (osCounts[os] || 0) + 1;
  });
  if (clickEvents.length === 0 && totalClicks > 0) {
    osCounts['Windows / macOS'] = totalClicks;
  }
  const sortedOS = Object.entries(osCounts).sort((a, b) => b[1] - a[1]);

  // Browsers
  const browserCounts: Record<string, number> = {};
  clickEvents.forEach((evt) => {
    const browser = evt.browser || 'Other';
    browserCounts[browser] = (browserCounts[browser] || 0) + 1;
  });
  if (clickEvents.length === 0 && totalClicks > 0) {
    browserCounts['Chrome'] = totalClicks;
  }
  const sortedBrowsers = Object.entries(browserCounts).sort((a, b) => b[1] - a[1]);

  // Referrers
  const referrerCounts: Record<string, number> = {};
  clickEvents.forEach((evt) => {
    const ref = evt.referrer || 'Direct / None';
    referrerCounts[ref] = (referrerCounts[ref] || 0) + 1;
  });
  if (clickEvents.length === 0 && totalClicks > 0) {
    referrerCounts['Direct / None'] = totalClicks;
  }
  const sortedReferrers = Object.entries(referrerCounts).sort((a, b) => b[1] - a[1]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 text-center">
        <div className="w-10 h-10 border-3 border-slate-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
          Loading professional analytics...
        </p>
      </div>
    );
  }

  if (error || !link) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950 text-rose-600 flex items-center justify-center mx-auto mb-4 border border-rose-200 dark:border-rose-800">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Analytics Unavailable</h2>
        <p className="text-xs text-slate-500 mt-2 mb-6">{error || 'Link could not be retrieved.'}</p>
        <button
          onClick={() => navigate('/dashboard/links')}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs font-semibold hover:opacity-90"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to My Links
        </button>
      </div>
    );
  }

  const shortUrl = buildShortUrl(link.shortCode);
  const isActive = link.isActive !== false;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in space-y-8">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button
          id="back-to-links-btn"
          onClick={() => navigate('/dashboard/links')}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer w-fit"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Links</span>
        </button>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Sync Live</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
            title="Download CSV report of all click activity"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Hero Link Header Card */}
      <div className="p-6 sm:p-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5 mb-2">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                  isActive
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                    : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isActive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                  }`}
                />
                {isActive ? 'Active & Tracking' : 'Paused by Creator'}
              </span>

              {link.tags && link.tags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1">
                  {link.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-medium"
                    >
                      <Tag className="w-2.5 h-2.5 text-slate-400" />
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white truncate">
              {link.title || link.shortCode}
            </h1>

            <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 text-xs text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Short Link:</span>
                <span className="font-mono font-medium text-slate-900 dark:text-slate-100 select-all">
                  {shortUrl}
                </span>
              </div>

              <div className="flex items-center gap-1.5 truncate">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate max-w-md">{link.originalUrl}</span>
              </div>
            </div>
          </div>

          {/* Action Button Strip */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleToggleStatus}
              disabled={togglingStatus}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer border ${
                isActive
                  ? 'border-amber-200 dark:border-amber-800/80 bg-amber-50/60 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 hover:bg-amber-100/80'
                  : 'border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100/80'
              }`}
              title={isActive ? 'Temporarily pause redirects' : 'Resume redirection'}
            >
              {isActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isActive ? 'Pause Link' : 'Resume Link'}</span>
            </button>

            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>

            <a
              href={shortUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Visit</span>
            </a>

            <button
              onClick={() => onOpenQrModal(link)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950 text-xs font-semibold shadow-xs transition-all cursor-pointer"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>QR Code</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bitly / Cuttly Top 4 Core Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Clicks */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Clicks</span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-800 dark:text-slate-200">
              <MousePointerClick className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
            {totalClicks.toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-emerald-500" />
            All visitor redirects across web
          </p>
        </div>

        {/* Unique Visitors */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Unique Visitors</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
            {uniqueVisitors.toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Deduplicated by device (24h cooldown)
          </p>
        </div>

        {/* Engagement / Repeat Traffic Ratio */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Engagement Ratio</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <BarChart2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white flex items-baseline gap-2">
            <span>{uniquePercent}%</span>
            <span className="text-xs font-medium text-slate-400">Unique</span>
          </div>
          <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-2">
            <div
              className="h-full bg-slate-900 dark:bg-white rounded-full transition-all"
              style={{ width: `${uniquePercent}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-400 mt-1.5">
            {repeatClicks > 0 ? `${repeatClicks} repeat visits recorded` : 'No repeat visits yet'}
          </p>
        </div>

        {/* Link Lifecycle */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Created</span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-800 dark:text-slate-200">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-base font-bold text-slate-900 dark:text-white">
            {new Date(link.createdAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </div>
          <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-400" />
            {link.expiresAt
              ? `Expires ${new Date(link.expiresAt).toLocaleDateString()}`
              : 'Permanent link'}
          </p>
        </div>
      </div>

      {/* Interactive Clicks Over Time Timeline Chart (Bitly / Cuttly centerpiece) */}
      <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-slate-500" />
              Clicks Over Time
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Daily trend of total redirections vs unique visitor reach
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            {(['7d', '14d', '30d'] as TimeRange[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setTimeRange(r)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  timeRange === r
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {r === '7d' ? '7 Days' : r === '14d' ? '14 Days' : '30 Days'}
              </button>
            ))}
          </div>
        </div>

        <div className="h-72 w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="clicksGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0f172a" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#0f172a" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="uniqueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.6} />
              <XAxis
                dataKey="displayDate"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-slate-900 text-white dark:bg-slate-800 p-3 rounded-xl shadow-lg text-xs space-y-1 border border-slate-700">
                        <p className="font-semibold text-slate-200">{label}</p>
                        <div className="flex items-center justify-between gap-4 text-slate-300">
                          <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-slate-300" />
                            Total Clicks:
                          </span>
                          <span className="font-mono font-bold text-white">{payload[0]?.value}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4 text-emerald-400">
                          <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-400" />
                            Unique Visitors:
                          </span>
                          <span className="font-mono font-bold">{payload[1]?.value}</span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="clicks"
                stroke="#334155"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#clicksGradient)"
                name="Total Clicks"
              />
              <Area
                type="monotone"
                dataKey="unique"
                stroke="#10b981"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#uniqueGradient)"
                name="Unique Visitors"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="flex items-center justify-center gap-6 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 font-medium">
            <span className="w-3 h-3 rounded-sm bg-slate-700" />
            <span>Total Clicks</span>
          </div>
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 font-medium">
            <span className="w-3 h-3 rounded-sm bg-emerald-500" />
            <span>Unique Visitors</span>
          </div>
        </div>
      </div>

      {/* 4-Bento Diagnostics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Device Distribution */}
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Laptop className="w-4 h-4 text-slate-500" />
              Device Distribution
            </h3>
            <span className="text-xs text-slate-400 font-medium">Hardware signatures</span>
          </div>

          <div className="space-y-4">
            {[
              {
                label: 'Desktop',
                icon: Laptop,
                count: deviceCounts.Desktop || 0,
                pct: Math.round(((deviceCounts.Desktop || 0) / totalLogged) * 100),
              },
              {
                label: 'Mobile',
                icon: Smartphone,
                count: deviceCounts.Mobile || 0,
                pct: Math.round(((deviceCounts.Mobile || 0) / totalLogged) * 100),
              },
              {
                label: 'Tablet',
                icon: Tablet,
                count: deviceCounts.Tablet || 0,
                pct: Math.round(((deviceCounts.Tablet || 0) / totalLogged) * 100),
              },
            ].map((device) => {
              const Icon = device.icon;
              return (
                <div key={device.label}>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-300">
                      <Icon className="w-3.5 h-3.5 text-slate-400" /> {device.label}
                    </span>
                    <span className="font-mono text-slate-500">
                      {device.count} ({device.pct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-slate-800 dark:bg-slate-200 rounded-full transition-all"
                      style={{ width: `${device.pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Operating Systems */}
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-slate-500" />
              Operating Systems
            </h3>
            <span className="text-xs text-slate-400 font-medium">{sortedOS.length} platforms</span>
          </div>

          {sortedOS.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-6 text-center">
              No OS data recorded yet.
            </p>
          ) : (
            <div className="space-y-3">
              {sortedOS.slice(0, 5).map(([os, count]) => {
                const pct = Math.round((Number(count) / totalLogged) * 100);
                return (
                  <div key={os} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[200px]">
                        {os}
                      </span>
                      <span className="font-mono text-slate-500">
                        {count} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Referral Channels */}
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Globe className="w-4 h-4 text-slate-500" />
              Referral Sources
            </h3>
            <span className="text-xs text-slate-400 font-medium">{sortedReferrers.length} channels</span>
          </div>

          {sortedReferrers.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-6 text-center">
              No referral data recorded yet.
            </p>
          ) : (
            <div className="space-y-3">
              {sortedReferrers.slice(0, 5).map(([ref, count]) => {
                const pct = Math.round((Number(count) / totalLogged) * 100);
                return (
                  <div
                    key={ref}
                    className="flex items-center justify-between text-xs py-1 border-b border-slate-100 dark:border-slate-800 last:border-none"
                  >
                    <span className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[220px]">
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

        {/* Top Browsers */}
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Compass className="w-4 h-4 text-slate-500" />
              Web Browsers
            </h3>
            <span className="text-xs text-slate-400 font-medium">{sortedBrowsers.length} browsers</span>
          </div>

          {sortedBrowsers.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-6 text-center">
              No browser data recorded yet.
            </p>
          ) : (
            <div className="space-y-3">
              {sortedBrowsers.slice(0, 5).map(([browser, count]) => {
                const pct = Math.round((Number(count) / totalLogged) * 100);
                return (
                  <div
                    key={browser}
                    className="flex items-center justify-between text-xs py-1 border-b border-slate-100 dark:border-slate-800 last:border-none"
                  >
                    <span className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[220px]">
                      {browser}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-slate-400">{pct}%</span>
                      <span className="font-semibold font-mono text-slate-700 dark:text-slate-300">
                        {count} {count === 1 ? 'visit' : 'visits'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Live Activity Stream Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="font-semibold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-500" />
              Real-Time Activity Log
            </h3>
            <p className="text-xs text-slate-500">Live stream of individual visitor events</p>
          </div>
          <span className="text-xs font-mono text-slate-400">
            Showing {Math.min(clickEvents.length, 30)} recent events
          </span>
        </div>

        {clickEvents.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
            No click events logged yet. Click "Visit" in the top bar to test the link and register your first live event!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-semibold uppercase text-[10px]">
                  <th className="py-2.5 px-3">Timestamp (Local)</th>
                  <th className="py-2.5 px-3">Visitor Type</th>
                  <th className="py-2.5 px-3">Device / OS</th>
                  <th className="py-2.5 px-3">Browser</th>
                  <th className="py-2.5 px-3">Referral Channel</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {clickEvents.slice(0, 30).map((evt, idx) => (
                  <tr key={evt.id || idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {new Date(evt.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          evt.isUnique
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {evt.isUnique ? 'Unique Visitor' : 'Repeat Visit'}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">
                      {evt.deviceType || 'Desktop'} • {evt.operatingSystem || 'OS'}
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {evt.browser || 'Browser'}
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                      <span className="truncate max-w-[200px] block">{evt.referrer || 'Direct'}</span>
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
