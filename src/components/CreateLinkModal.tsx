import React, { useState } from 'react';
import { Link2, Sparkles, Check, Copy, ExternalLink, QrCode, AlertCircle, X, ArrowRight, Calendar, Clock } from 'lucide-react';
import { validateLongUrl, validateCustomAlias, buildShortUrl } from '../lib/urlUtils';
import { createShortLink } from '../services/linkService';
import { useAuth } from '../context/AuthContext';
import { LinkItem } from '../types';
import { useAppRouter } from '../lib/router';

interface CreateLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLinkCreated?: (newLink: LinkItem) => void;
  onOpenQr?: (link: LinkItem) => void;
  initialUrl?: string;
}

type ExpiryPreset = 'never' | '1h' | '24h' | '7d' | '30d' | 'custom';

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
  const [expiryPreset, setExpiryPreset] = useState<ExpiryPreset>('never');
  const [customExpiryDate, setCustomExpiryDate] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdLink, setCreatedLink] = useState<LinkItem | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

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

    // 1. Client-side URL validation
    const urlValidation = validateLongUrl(url);
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
    setExpiryPreset('never');
    setCustomExpiryDate('');
    setCreatedLink(null);
    setErrorMessage(null);
  };

  return (
    <div
      id="create-link-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="create-link-modal-container"
        className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-7 text-slate-900 dark:text-slate-100 my-8 animate-scale-in"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200">
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
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Not Logged In Warning Banner */}
        {!currentUser && (
          <div className="mt-4 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-sm flex items-start gap-3">
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
                  className="px-3 py-1 text-xs font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-700"
                >
                  Log In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    navigate('/signup');
                  }}
                  className="px-3 py-1 text-xs font-semibold rounded-lg border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 hover:bg-amber-100/50"
                >
                  Sign Up Free
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Success View */}
        {createdLink ? (
          <div className="py-5 space-y-5">
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
                  className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium shrink-0 transition-colors"
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
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium text-sm transition-colors text-center"
              >
                <QrCode className="w-4 h-4" />
                View QR Code
              </button>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={resetForm}
                className="text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 underline underline-offset-4"
              >
                + Shorten another link
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 font-medium text-xs transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Form View */
          <form onSubmit={handleSubmit} className="pt-4 space-y-4">
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
                    <span className="px-3 py-2 text-xs font-mono text-slate-400 border-r border-slate-200 dark:border-slate-800 select-none">
                      /{' '}
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
                      className="w-full px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 bg-transparent focus:outline-none placeholder:text-slate-400"
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

            {/* Actions */}
            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium transition-colors"
              >
                Cancel
              </button>

              <button
                id="submit-create-link-btn"
                type="submit"
                disabled={loading || !url.trim()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 font-medium text-xs transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
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
};
