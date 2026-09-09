import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Link2,
  Sparkles,
  Check,
  Copy,
  ExternalLink,
  QrCode,
  AlertCircle,
  X,
  ArrowRight,
  Calendar,
  Clock,
  Tag,
  Share2,
  SlidersHorizontal,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  Globe,
  ImageIcon,
  Loader2,
} from 'lucide-react';
import { validateLongUrl, validateCustomAlias, buildShortUrl, buildUtmUrl } from '../lib/urlUtils';
import { createShortLink } from '../services/linkService';
import { fetchDestinationPreview, DestinationPreviewData } from '../services/previewService';
import { useAuth } from '../context/AuthContext';
import { LinkItem, UtmParams } from '../types';
import { useAppRouter } from '../lib/router';

interface CreateLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLinkCreated?: (newLink: LinkItem) => void;
  onOpenQr?: (link: LinkItem) => void;
  initialUrl?: string;
}

type ExpiryPreset = 'never' | '1h' | '24h' | '7d' | '30d' | 'custom';

const QUICK_TAG_SUGGESTIONS = ['Marketing', 'Social', 'Newsletter', 'Promo', 'Bio', 'Ads'];

export const CreateLinkModal: React.FC<CreateLinkModalProps> = ({
  isOpen,
  onClose,
  onLinkCreated,
  onOpenQr,
  initialUrl = '',
}) => {
  const { currentUser } = useAuth();
  const { navigate } = useAppRouter();

  const [url, setUrl] = useState(initialUrl);
  const [title, setTitle] = useState('');
  const [customAlias, setCustomAlias] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showExpiration, setShowExpiration] = useState(false);
  const [showPasswordProtection, setShowPasswordProtection] = useState(false);
  const [password, setPassword] = useState('');
  const [showPasswordText, setShowPasswordText] = useState(false);
  const [showUtmBuilder, setShowUtmBuilder] = useState(false);
  const [showTags, setShowTags] = useState(false);

  // Tags
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  // UTM Parameters
  const [utm, setUtm] = useState<UtmParams>({
    source: '',
    medium: '',
    campaign: '',
    term: '',
    content: '',
  });

  const [expiryPreset, setExpiryPreset] = useState<ExpiryPreset>('never');
  const [customExpiryDate, setCustomExpiryDate] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdLink, setCreatedLink] = useState<LinkItem | null>(null);
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Social Open Graph Destination Preview state
  const [destinationPreview, setDestinationPreview] = useState<DestinationPreviewData | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch destination metadata automatically for Open Graph share card
  useEffect(() => {
    const trimmed = url.trim();
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      setDestinationPreview(null);
      setLoadingPreview(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoadingPreview(true);
      try {
        const preview = await fetchDestinationPreview(trimmed);
        setDestinationPreview(preview);
        if (preview?.title && !title.trim()) {
          setTitle(preview.title);
        }
      } catch {
        setDestinationPreview(null);
      } finally {
        setLoadingPreview(false);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [url]);

  if (!isOpen || !mounted || typeof document === 'undefined') return null;

  const handleAddTag = (tagToAdd: string) => {
    const cleaned = tagToAdd.trim().replace(/^#/, '').toLowerCase();
    if (!cleaned) return;
    if (!tags.includes(cleaned)) {
      setTags([...tags, cleaned]);
    }
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const calculateExpiresAt = (): string | null => {
    if (!showExpiration || expiryPreset === 'never') return null;

    const now = Date.now();
    if (expiryPreset === '1h') {
      return new Date(now + 60 * 60 * 1000).toISOString();
    }
    if (expiryPreset === '24h') {
      return new Date(now + 24 * 60 * 60 * 1000).toISOString();
    }
    if (expiryPreset === '7d') {
      return new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();
    }
    if (expiryPreset === '30d') {
      return new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();
    }
    if (expiryPreset === 'custom') {
      if (!customExpiryDate) {
        throw new Error('Please select a custom expiration date and time.');
      }
      const customTime = new Date(customExpiryDate).getTime();
      if (isNaN(customTime)) {
        throw new Error('Invalid expiration date selected.');
      }
      if (customTime <= now) {
        throw new Error('Expiration date must be in the future.');
      }
      return new Date(customExpiryDate).toISOString();
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // If not authenticated, guide them
    if (!currentUser) {
      setErrorMessage('Please sign in to your account to create and manage links.');
      return;
    }

    // Determine final destination URL, incorporating UTM if enabled
    let finalTargetUrl = url.trim();
    if (showUtmBuilder && (utm.source || utm.medium || utm.campaign)) {
      finalTargetUrl = buildUtmUrl(finalTargetUrl, utm);
    }

    // 1. Client-side URL validation
    const urlValidation = validateLongUrl(finalTargetUrl);
    if (!urlValidation.valid) {
      setErrorMessage(urlValidation.error || 'Invalid URL entered.');
      return;
    }

    // 2. Custom alias validation if provided
    if (customAlias.trim()) {
      const aliasValidation = validateCustomAlias(customAlias);
      if (!aliasValidation.valid) {
        setErrorMessage(aliasValidation.error || 'Invalid custom alias.');
        return;
      }
    }

    let calculatedExpiresAt: string | null = null;
    try {
      calculatedExpiresAt = calculateExpiresAt();
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid expiration settings.');
      return;
    }

    setLoading(true);

    try {
      const link = await createShortLink({
        userId: currentUser.uid,
        originalUrl: urlValidation.cleanUrl!,
        title: title.trim() || undefined,
        customAlias: customAlias.trim() || undefined,
        expiresAt: calculatedExpiresAt,
        tags: tags.length > 0 ? tags : undefined,
        password: showPasswordProtection && password.trim() ? password.trim() : undefined,
        ogTitle: destinationPreview?.title || undefined,
        ogDescription: destinationPreview?.description || undefined,
        ogImage: destinationPreview?.image || undefined,
        ogSiteName: destinationPreview?.siteName || undefined,
      });

      setCreatedLink(link);
      if (onLinkCreated) {
        onLinkCreated(link);
      }
    } catch (err: any) {
      console.error('Error creating link:', err);
      setErrorMessage(err?.message || 'Failed to shorten URL. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!createdLink) return;
    const shortUrl = buildShortUrl(createdLink.shortCode);
    try {
      await navigator.clipboard.writeText(shortUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const resetForm = () => {
    setUrl('');
    setTitle('');
    setCustomAlias('');
    setShowAdvanced(false);
    setShowExpiration(false);
    setShowPasswordProtection(false);
    setPassword('');
    setShowPasswordText(false);
    setShowUtmBuilder(false);
    setShowTags(false);
    setTags([]);
    setTagInput('');
    setUtm({ source: '', medium: '', campaign: '', term: '', content: '' });
    setExpiryPreset('never');
    setCustomExpiryDate('');
    setDestinationPreview(null);
    setLoadingPreview(false);
    setCreatedLink(null);
    setErrorMessage(null);
  };

  const modalContent = (
    <div
      id="create-link-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="create-link-modal-container"
        className="relative w-full max-w-lg max-h-[90vh] sm:max-h-[85vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl text-slate-900 dark:text-slate-100 my-auto animate-scale-in overflow-hidden"
      >
        {/* Header - Fixed at the top */}
        <div className="flex items-center justify-between p-5 sm:p-6 pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200 shrink-0">
              <Link2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-lg leading-tight">
                {createdLink ? 'Link Created!' : 'Shorten a New URL'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {createdLink
                  ? 'Your shortened link is live and ready to share'
                  : 'Transform any long URL into a short, trackable link'}
              </p>
            </div>
          </div>
          <button
            id="close-create-link-modal-btn"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success View */}
        {createdLink ? (
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 overscroll-contain">
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                  Generated Short URL
                </span>
                <div className="mt-2 flex items-center justify-between gap-2 p-2.5 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                  <span className="font-mono font-medium text-slate-800 dark:text-slate-200 truncate select-all text-sm">
                    {buildShortUrl(createdLink.shortCode)}
                  </span>
                  <button
                    id="copy-created-link-btn"
                    onClick={handleCopy}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium shrink-0 transition-colors cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>

                <div className="mt-3 text-xs text-slate-500 dark:text-slate-400 truncate">
                  <span className="font-medium text-slate-700 dark:text-slate-300">Target:</span> {createdLink.originalUrl}
                </div>

                {createdLink.expiresAt && (
                  <div className="mt-2.5 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-medium">
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      Expires on {new Date(createdLink.expiresAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <a
                  href={buildShortUrl(createdLink.shortCode)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium text-sm transition-colors text-center"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open Short URL
                </a>

                <button
                  id="open-qr-created-btn"
                  type="button"
                  onClick={() => {
                    if (onOpenQr) onOpenQr(createdLink);
                  }}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium text-sm transition-colors text-center cursor-pointer"
                >
                  <QrCode className="w-4 h-4" />
                  View QR Code
                </button>
              </div>
            </div>

            <div className="p-4 sm:px-6 border-t border-slate-100 dark:border-slate-800 shrink-0 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-xs flex items-center justify-between">
              <button
                type="button"
                onClick={resetForm}
                className="text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 underline underline-offset-4 cursor-pointer"
              >
                + Shorten another link
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 font-medium text-xs transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Form View */
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 overscroll-contain">
              {/* Not Logged In Warning Banner */}
              {!currentUser && (
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-sm flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium">Account required to save links</div>
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                      Sign in or create a free account to generate, organize, and monitor analytics for your short links.
                    </p>
                    <div className="mt-2.5 flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          navigate('/login');
                        }}
                        className="px-3 py-1 text-xs font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-700 cursor-pointer"
                      >
                        Log In
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          navigate('/signup');
                        }}
                        className="px-3 py-1 text-xs font-semibold rounded-lg border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 hover:bg-amber-100/50 cursor-pointer"
                      >
                        Sign Up Free
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {errorMessage && (
                <div
                  id="create-link-error-alert"
                  className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-start gap-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                  <span>{errorMessage}</span>
                </div>
              )}

            {/* Long URL Input */}
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Destination URL <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="long-url-input"
                  type="text"
                  required
                  placeholder="https://example.com/my-long-article-or-product-page"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400 placeholder:text-slate-400"
                />
              </div>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                Only valid <code className="font-mono">https://</code> or <code className="font-mono">http://</code> web addresses are supported.
              </p>

              {/* Dynamic Open Graph / Destination Preview Card */}
              {loadingPreview && (
                <div className="mt-2.5 p-3 rounded-xl border border-blue-200/80 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20 flex items-center gap-2.5 text-xs text-blue-700 dark:text-blue-300 animate-pulse">
                  <Loader2 className="w-4 h-4 animate-spin shrink-0 text-blue-600 dark:text-blue-400" />
                  <span>Extracting destination Open Graph preview (WhatsApp, Facebook, Twitter)...</span>
                </div>
              )}

              {!loadingPreview && destinationPreview && (
                <div className="mt-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-900/60 text-left">
                  <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-200/60 dark:border-slate-800">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                      <Share2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      <span>Social Share Preview (WhatsApp, FB, Twitter)</span>
                    </div>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      Open Graph Ready
                    </span>
                  </div>

                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/90 overflow-hidden shadow-xs">
                    {destinationPreview.image && (
                      <div className="relative w-full h-32 bg-slate-100 dark:bg-slate-900 overflow-hidden">
                        <img
                          src={destinationPreview.image}
                          alt="Link preview"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                    <div className="p-3">
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                        {destinationPreview.favicon ? (
                          <img
                            src={destinationPreview.favicon}
                            alt=""
                            className="w-3.5 h-3.5 rounded-xs shrink-0"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <Globe className="w-3.5 h-3.5 shrink-0" />
                        )}
                        <span className="font-medium truncate">{destinationPreview.siteName || destinationPreview.url}</span>
                      </div>
                      <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 line-clamp-1 mb-0.5">
                        {destinationPreview.title || 'Untitled'}
                      </div>
                      {destinationPreview.description && (
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                          {destinationPreview.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <p className="mt-2 text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Check className="w-3 h-3 text-emerald-500" />
                    When you share your short link, messaging apps and social platforms will display this preview.
                  </p>
                </div>
              )}
            </div>

            {/* Optional Title */}
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Link Title <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                id="link-title-input"
                type="text"
                placeholder="e.g., Summer Campaign Landing Page"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400 placeholder:text-slate-400"
              />
            </div>

            {/* Advanced Toggle / Custom Alias */}
            <div>
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {showAdvanced ? 'Hide Custom Alias' : 'Add Custom Short Alias (optional)'}
              </button>

              {showAdvanced && (
                <div className="mt-2.5 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Custom Short Alias
                  </label>
                  <div className="flex items-center rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden focus-within:ring-2 focus-within:ring-slate-900 dark:focus-within:ring-slate-400">
                    <span className="px-2.5 sm:px-3 py-2 text-[11px] sm:text-xs font-mono text-slate-400 border-r border-slate-200 dark:border-slate-800 select-none shrink-0">
                      shortee.xyz/
                    </span>
                    <input
                      id="custom-alias-input"
                      type="text"
                      placeholder="summer-promo"
                      value={customAlias}
                      onChange={(e) => {
                        setCustomAlias(e.target.value.replace(/\s+/g, '-'));
                        if (errorMessage) setErrorMessage(null);
                      }}
                      className="w-full min-w-0 px-2.5 sm:px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 bg-transparent focus:outline-none placeholder:text-slate-400"
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    Leave blank to automatically generate a random 6-character code (e.g. <span className="font-mono">aB72xK</span>).
                  </p>
                </div>
              )}
            </div>

            {/* Expiration Date Section */}
            <div>
              <button
                type="button"
                onClick={() => setShowExpiration(!showExpiration)}
                className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 cursor-pointer"
              >
                <Calendar className="w-3.5 h-3.5" />
                {showExpiration ? 'Hide Expiration Date' : 'Set Link Expiration Date (optional)'}
              </button>

              {showExpiration && (
                <div className="mt-2.5 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 animate-fade-in space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Expire link after:
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {(
                        [
                          { key: 'never', label: 'Never' },
                          { key: '1h', label: '1 Hour' },
                          { key: '24h', label: '24 Hours' },
                          { key: '7d', label: '7 Days' },
                          { key: '30d', label: '30 Days' },
                          { key: 'custom', label: 'Custom Date' },
                        ] as const
                      ).map((preset) => (
                        <button
                          key={preset.key}
                          type="button"
                          onClick={() => {
                            setExpiryPreset(preset.key);
                            if (errorMessage) setErrorMessage(null);
                          }}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                            expiryPreset === preset.key
                              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {expiryPreset === 'custom' && (
                    <div className="pt-1 animate-fade-in">
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Select date and time:
                      </label>
                      <input
                        id="custom-expiry-input"
                        type="datetime-local"
                        min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                        value={customExpiryDate}
                        onChange={(e) => {
                          setCustomExpiryDate(e.target.value);
                          if (errorMessage) setErrorMessage(null);
                        }}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400"
                      />
                    </div>
                  )}

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                    {expiryPreset === 'never'
                      ? 'This link will remain active indefinitely until deleted.'
                      : 'Visitors trying to access the link after expiration will see an expired link notice.'}
                  </p>
                </div>
              )}
            </div>

            {/* Password Protection */}
            <div>
              <button
                type="button"
                onClick={() => setShowPasswordProtection(!showPasswordProtection)}
                className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                {showPasswordProtection ? 'Hide Password Protection' : 'Protect with Password (optional)'}
              </button>

              {showPasswordProtection && (
                <div className="mt-2.5 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 animate-fade-in space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
                      <KeyRound className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Link Password</span>
                    </div>
                    <span className="text-[11px] text-slate-400">Restricts unauthorized access</span>
                  </div>

                  <div className="relative">
                    <input
                      id="link-password-input"
                      type={showPasswordText ? 'text' : 'password'}
                      placeholder="Enter a secret password or passcode"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-3 pr-10 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswordText(!showPasswordText)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                      title={showPasswordText ? 'Hide password' : 'Show password'}
                    >
                      {showPasswordText ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Visitors will be prompted to enter this password before they can be redirected to the target destination.
                  </p>
                </div>
              )}
            </div>

            {/* UTM Campaign Builder (Bitly & Cuttly Professional Feature) */}
            <div>
              <button
                type="button"
                onClick={() => setShowUtmBuilder(!showUtmBuilder)}
                className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                {showUtmBuilder ? 'Hide UTM Campaign Builder' : 'Add UTM Tracking Parameters (optional)'}
              </button>

              {showUtmBuilder && (
                <div className="mt-2.5 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 animate-fade-in space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      Campaign Tracking
                    </span>
                    <span className="text-[11px] text-slate-400">Google Analytics / Mixpanel ready</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                        UTM Source
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. google, facebook, newsletter"
                        value={utm.source || ''}
                        onChange={(e) => setUtm({ ...utm, source: e.target.value })}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                        UTM Medium
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. cpc, social, email, banner"
                        value={utm.medium || ''}
                        onChange={(e) => setUtm({ ...utm, medium: e.target.value })}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-800"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                      UTM Campaign Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. summer_sale, brand_launch"
                      value={utm.campaign || ''}
                      onChange={(e) => setUtm({ ...utm, campaign: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-800"
                    />
                  </div>

                  {(utm.source || utm.medium || utm.campaign) && (
                    <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-[11px] text-emerald-800 dark:text-emerald-300">
                      <span className="font-semibold">Live Destination Preview:</span>
                      <p className="font-mono truncate mt-0.5 opacity-90">
                        {buildUtmUrl(url || 'https://example.com', utm)}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Tags / Categories (Bitly & Cuttly Organization Feature) */}
            <div>
              <button
                type="button"
                onClick={() => setShowTags(!showTags)}
                className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 cursor-pointer"
              >
                <Tag className="w-3.5 h-3.5" />
                {showTags ? 'Hide Tags' : 'Add Tags / Folders (optional)'}
              </button>

              {showTags && (
                <div className="mt-2.5 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 animate-fade-in space-y-2.5">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Type a tag & press Enter or Add"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddTag(tagInput);
                        }
                      }}
                      className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-800"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddTag(tagInput)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium"
                    >
                      Add
                    </button>
                  </div>

                  {/* Active Tags */}
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {tags.map((t) => (
                        <span
                          key={t}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-medium"
                        >
                          #{t}
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(t)}
                            className="text-slate-500 hover:text-slate-800 dark:hover:text-white"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Suggestions */}
                  <div className="pt-1">
                    <span className="text-[11px] text-slate-400 mr-2">Quick suggestions:</span>
                    <div className="inline-flex flex-wrap gap-1 mt-1">
                      {QUICK_TAG_SUGGESTIONS.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => handleAddTag(suggestion)}
                          disabled={tags.includes(suggestion.toLowerCase())}
                          className="px-2 py-0.5 rounded text-[11px] border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          +{suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            </div>

            {/* Sticky Actions Footer */}
            <div className="p-4 sm:px-6 border-t border-slate-100 dark:border-slate-800 shrink-0 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-xs flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                id="submit-create-link-btn"
                type="submit"
                disabled={loading || !url.trim()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 font-medium text-xs transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? (
                  <span>Shortening...</span>
                ) : (
                  <>
                    <span>Shorten URL</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
