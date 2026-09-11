import React, { useState, useEffect, useMemo } from 'react';
import {
  Link2,
  Search,
  Plus,
  ExternalLink,
  Copy,
  Check,
  QrCode,
  BarChart2,
  Trash2,
  ArrowUpDown,
  Clock,
  AlertCircle,
  Filter,
  RefreshCw,
  Download,
  Pause,
  Play,
  Users,
  Tag,
  MousePointerClick,
  Edit3,
  Lock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAppRouter } from '../lib/router';
import {
  getUserLinks,
  deleteShortLink,
  getLocalLinks,
  subscribeToUserLinks,
  toggleLinkStatus,
  exportAllLinksCsv,
} from '../services/linkService';
import { LinkItem } from '../types';
import { buildShortUrl } from '../lib/urlUtils';
import { EditLinkModal } from '../components/EditLinkModal';

interface DashboardLinksProps {
  onOpenCreateModal: () => void;
  onOpenQrModal: (link: LinkItem) => void;
}

export const DashboardLinks: React.FC<DashboardLinksProps> = ({
  onOpenCreateModal,
  onOpenQrModal,
}) => {
  const { currentUser } = useAuth();
  const { navigate } = useAppRouter();

  const [links, setLinks] = useState<LinkItem[]>(() => {
    if (typeof window !== 'undefined') {
      return getLocalLinks();
    }
    return [];
  });
  const [loading, setLoading] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return getLocalLinks().length === 0;
    }
    return true;
  });
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'mostClicks' | 'leastClicks'>('newest');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused'>('all');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [editingLink, setEditingLink] = useState<LinkItem | null>(null);

  const fetchLinks = async (showRefreshState = true) => {
    if (!currentUser) return;
    try {
      if (showRefreshState) setRefreshing(true);
      const data = await getUserLinks(currentUser.uid);
      setLinks(data);
    } catch (err: any) {
      console.error('Failed to fetch user links:', err);
      setError('Could not load links from Firestore. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!currentUser) return;

    fetchLinks(false);

    // Real-time Firestore sync
    const unsubscribe = subscribeToUserLinks(
      currentUser.uid,
      (freshLinks) => {
        setLinks(freshLinks);
        setLoading(false);
      },
      (err) => console.warn('Realtime links sync warning:', err)
    );

    // Listen for tab focus / visibilitychange and cross-tab storage pings
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchLinks(false);
      }
    };
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'shortee_last_click_ping' || e.key === 'shortee_cached_links') {
        fetchLinks(false);
      }
    };
    window.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);
    window.addEventListener('storage', handleStorage);

    return () => {
      unsubscribe();
      window.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
      window.removeEventListener('storage', handleStorage);
    };
  }, [currentUser]);

  const handleCopy = async (link: LinkItem) => {
    const shortUrl = buildShortUrl(link.shortCode);
    await navigator.clipboard.writeText(shortUrl);
    setCopiedId(link.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = async (linkId: string) => {
    if (!confirm('Are you sure you want to delete this link? Anyone visiting the short URL will encounter a 404.')) {
      return;
    }
    setDeletingId(linkId);
    try {
      await deleteShortLink(linkId);
      setLinks((prev) => prev.filter((l) => l.id !== linkId));
    } catch (err) {
      console.error('Delete link error:', err);
      alert('Failed to delete the link. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleStatus = async (link: LinkItem) => {
    if (togglingId) return;
    setTogglingId(link.id);
    const current = link.isActive !== false;
    const ok = await toggleLinkStatus(link.id, current);
    if (ok) {
      setLinks((prev) =>
        prev.map((l) => (l.id === link.id ? { ...l, isActive: !current } : l))
      );
    }
    setTogglingId(null);
  };

  // Collect all unique tags across links for quick filter chips
  const allTags = useMemo(() => {
    const set = new Set<string>();
    links.forEach((l) => {
      l.tags?.forEach((t) => set.add(t));
    });
    return Array.from(set);
  }, [links]);

  // Filter and sort links
  const filteredLinks = useMemo(() => {
    let result = [...links];

    // Status filter
    if (statusFilter === 'active') {
      result = result.filter((l) => l.isActive !== false);
    } else if (statusFilter === 'paused') {
      result = result.filter((l) => l.isActive === false);
    }

    // Tag filter
    if (selectedTag) {
      result = result.filter((l) => l.tags?.includes(selectedTag));
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (l) =>
          l.title?.toLowerCase().includes(q) ||
          l.shortCode.toLowerCase().includes(q) ||
          l.originalUrl.toLowerCase().includes(q) ||
          l.tags?.some((t) => t.toLowerCase().includes(q))
      );
    }

    result.sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortBy === 'oldest') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      if (sortBy === 'mostClicks') {
        return (b.clicks || 0) - (a.clicks || 0);
      }
      if (sortBy === 'leastClicks') {
        return (a.clicks || 0) - (b.clicks || 0);
      }
      return 0;
    });

    return result;
  }, [links, searchQuery, sortBy, statusFilter, selectedTag]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            My Links
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Manage your shortened URLs, copy links, generate QR codes, and view click analytics.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={() => fetchLinks(true)}
            disabled={refreshing}
            title="Refresh links"
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold text-xs transition-all shadow-xs cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-slate-900 dark:text-white' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={() => exportAllLinksCsv(filteredLinks)}
            disabled={filteredLinks.length === 0}
            title="Export links to CSV"
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold text-xs transition-all shadow-xs cursor-pointer disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>

          <button
            id="links-create-btn"
            onClick={onOpenCreateModal}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 font-semibold text-xs transition-all shadow-sm active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Shorten URL</span>
          </button>
        </div>
      </div>

      {/* Filter, Status, and Search Bar */}
      <div className="mt-6 space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              id="links-search-input"
              type="text"
              placeholder="Search by title, short code, URL, or #tag..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400 placeholder:text-slate-400"
            />
          </div>

          {/* Status filter & Sort dropdown */}
          <div className="flex items-center gap-3">
            {/* Status pills */}
            <div className="flex items-center p-0.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100/70 dark:bg-slate-800">
              {(
                [
                  { key: 'all', label: 'All' },
                  { key: 'active', label: 'Active' },
                  { key: 'paused', label: 'Paused' },
                ] as const
              ).map((s) => (
                <button
                  key={s.key}
                  onClick={() => setStatusFilter(s.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    statusFilter === s.key
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-semibold'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Sort dropdown */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 font-medium whitespace-nowrap hidden sm:inline">
                Sort:
              </span>
              <select
                id="links-sort-select"
                value={sortBy}
                onChange={(e: any) => setSortBy(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400 cursor-pointer"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="mostClicks">Most Clicks</option>
                <option value="leastClicks">Least Clicks</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tag Filter Chips (if any exist) */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-xs text-slate-400 font-medium flex items-center gap-1 mr-1">
              <Tag className="w-3 h-3" /> Tags:
            </span>
            <button
              onClick={() => setSelectedTag(null)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                selectedTag === null
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold'
                  : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              All Tags
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  selectedTag === tag
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold'
                    : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="mt-6 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => fetchLinks(true)} className="font-semibold underline cursor-pointer">
            Retry
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="mt-6 p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <div className="w-6 h-6 border-2 border-slate-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-500">Loading links...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && links.length === 0 && (
        <div className="mt-6 p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-4">
            <Link2 className="w-6 h-6" />
          </div>
          <h3 className="font-semibold text-sm text-slate-900 dark:text-white">No shortened links yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-5">
            You have not created any short links yet. Enter any long URL to create your first link.
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

      {/* Search No Results */}
      {!loading && links.length > 0 && filteredLinks.length === 0 && (
        <div className="mt-6 p-8 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <p className="text-xs text-slate-500">
            No links found matching <span className="font-medium text-slate-800 dark:text-slate-200">"{searchQuery}"</span>.
          </p>
          <button
            onClick={() => setSearchQuery('')}
            className="mt-2 text-xs text-slate-900 dark:text-white font-semibold underline"
          >
            Clear search
          </button>
        </div>
      )}

      {/* Links List View (Table on desktop, Cards on mobile) */}
      {!loading && filteredLinks.length > 0 && (
        <div className="mt-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          {/* Header Row (Desktop) */}
          <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            <div className="col-span-5">Link Details</div>
            <div className="col-span-3">Short URL</div>
            <div className="col-span-2 text-center">Clicks</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredLinks.map((link, idx) => {
              const shortUrl = buildShortUrl(link.shortCode);
              const isCopied = copiedId === link.id;
              const isDeleting = deletingId === link.id;

              return (
                <div
                  key={link.id}
                  className="p-4 sm:px-6 sm:py-4 flex flex-col md:grid md:grid-cols-12 gap-3 sm:gap-4 md:items-center hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                >
                  {/* Link Details (Col 5) */}
                  <div className="md:col-span-5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3
                        title={link.title || link.shortCode}
                        className="font-semibold text-sm text-slate-900 dark:text-white truncate max-w-[220px] sm:max-w-xs md:max-w-sm"
                      >
                        {link.title || link.shortCode}
                      </h3>

                      {link.isActive === false ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300">
                          Paused
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                          Active
                        </span>
                      )}

                      {(link.isPasswordProtected || link.password) && (
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/50"
                          title="Password protected link"
                        >
                          <Lock className="w-2.5 h-2.5" />
                          Protected
                        </span>
                      )}

                      {link.tags && link.tags.length > 0 && (
                        <div className="flex items-center gap-1">
                          {link.tags.slice(0, 2).map((t) => (
                            <span
                              key={t}
                              className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium"
                            >
                              #{t}
                            </span>
                          ))}
                          {link.tags.length > 2 && (
                            <span className="text-[10px] text-slate-400">+{link.tags.length - 2}</span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5" title={link.originalUrl}>
                      {link.originalUrl}
                    </div>

                    <div className="mt-1 text-[11px] text-slate-400 flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(link.createdAt).toLocaleDateString()}</span>
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

                  {/* Short URL (Col 3) */}
                  <div className="md:col-span-3">
                    <span className="font-mono text-xs font-medium text-slate-800 dark:text-slate-200 break-all select-all">
                      {shortUrl}
                    </span>
                  </div>

                  {/* Clicks & Uniques (Col 2) */}
                  <div className="md:col-span-2 md:text-center flex flex-col md:items-center justify-center gap-1 text-xs">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-mono text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      <MousePointerClick className="w-3 h-3 text-slate-400" />
                      {link.clicks} {link.clicks === 1 ? 'click' : 'clicks'}
                    </span>
                    {(link.uniqueVisitors ?? 0) > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono text-indigo-600 dark:text-indigo-400">
                        <Users className="w-3 h-3" />
                        {link.uniqueVisitors} unique
                      </span>
                    )}
                  </div>

                  {/* Actions (Col 2) */}
                  <div className="md:col-span-2 flex items-center md:justify-end gap-1.5 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800">
                    {/* Pause / Resume Button */}
                    <button
                      onClick={() => handleToggleStatus(link)}
                      disabled={togglingId === link.id}
                      title={link.isActive === false ? 'Resume link redirection' : 'Pause link redirection'}
                      className={`p-2 rounded-lg border transition-colors cursor-pointer ${
                        link.isActive === false
                          ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {link.isActive === false ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                    </button>

                    {/* Copy button */}
                    <button
                      id={`copy-btn-${link.id}`}
                      onClick={() => handleCopy(link)}
                      title="Copy short link"
                      className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                    >
                      {isCopied ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {/* Open link */}
                    <a
                      href={shortUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open in new tab"
                      className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    {/* Edit Destination URL */}
                    <button
                      id={`edit-btn-${link.id}`}
                      onClick={() => setEditingLink(link)}
                      title="Edit Destination URL & Details"
                      className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    {/* QR Code */}
                    <button
                      id={`qr-btn-${link.id}`}
                      onClick={() => onOpenQrModal(link)}
                      title="View & Download QR Code"
                      className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                    </button>

                    {/* Analytics */}
                    <button
                      id={`analytics-btn-${link.id}`}
                      onClick={() => navigate(`/dashboard/analytics/${link.id}`)}
                      title="View Link Analytics"
                      className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                    >
                      <BarChart2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete */}
                    <button
                      id={`delete-btn-${link.id}`}
                      onClick={() => handleDelete(link.id)}
                      disabled={isDeleting}
                      title="Delete link"
                      className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Edit Link Destination & Settings Modal */}
      {editingLink && (
        <EditLinkModal
          link={editingLink}
          isOpen={!!editingLink}
          onClose={() => setEditingLink(null)}
          onLinkUpdated={(updated) => {
            setLinks((prev) =>
              prev.map((item) => (item.id === updated.id ? updated : item))
            );
          }}
        />
      )}
    </div>
  );
};
