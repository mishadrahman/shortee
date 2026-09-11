import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Link2,
  Check,
  ExternalLink,
  AlertCircle,
  X,
  Calendar,
  Clock,
  Tag,
  SlidersHorizontal,
  Save,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
} from 'lucide-react';
import { validateLongUrl, buildShortUrl, buildUtmUrl } from '../lib/urlUtils';
import { updateShortLink, formatCleanTitle } from '../services/linkService';
import { LinkItem, UtmParams } from '../types';

interface EditLinkModalProps {
  link: LinkItem | null;
  isOpen: boolean;
  onClose: () => void;
  onLinkUpdated?: (updated: LinkItem) => void;
}

type ExpiryPreset = 'keep' | 'never' | '1h' | '24h' | '7d' | '30d' | 'custom';

const QUICK_TAG_SUGGESTIONS = ['Marketing', 'Social', 'Newsletter', 'Promo', 'Bio', 'Ads'];

export const EditLinkModal: React.FC<EditLinkModalProps> = ({
  link,
  isOpen,
  onClose,
  onLinkUpdated,
}) => {
  const [mounted, setMounted] = useState(false);
  const [destinationUrl, setDestinationUrl] = useState('');
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [showUtmBuilder, setShowUtmBuilder] = useState(false);
  const [showExpiration, setShowExpiration] = useState(false);
  const [showPasswordProtection, setShowPasswordProtection] = useState(false);
  const [password, setPassword] = useState('');
  const [showPasswordText, setShowPasswordText] = useState(false);

  const [utm, setUtm] = useState<UtmParams>({
    source: '',
    medium: '',
    campaign: '',
    term: '',
    content: '',
  });

  const [expiryPreset, setExpiryPreset] = useState<ExpiryPreset>('keep');
  const [customExpiryDate, setCustomExpiryDate] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync state whenever modal opens or link changes
  useEffect(() => {
    if (link && isOpen) {
      setDestinationUrl(link.originalUrl || '');
      setTitle(link.title || '');
      setTags(link.tags || []);
      setIsActive(link.isActive !== false);
      setExpiryPreset('keep');
      setCustomExpiryDate(
        link.expiresAt
          ? new Date(link.expiresAt).toISOString().slice(0, 16)
          : ''
      );
      setPassword(link.password || '');
      setShowPasswordProtection(!!link.password || !!link.isPasswordProtected);
      setShowPasswordText(false);
      setErrorMessage(null);
      setSuccessMessage(null);
      setShowUtmBuilder(false);
      setShowExpiration(false);
    }
  }, [link, isOpen]);

  // Lock background body scroll when modal is open and handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !link || !mounted || typeof document === 'undefined') {
    return null;
  }

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
    if (expiryPreset === 'keep') {
      return link.expiresAt || null;
    }
    if (expiryPreset === 'never') {
      return null;
    }
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
      if (!customExpiryDate) return null;
      const date = new Date(customExpiryDate);
      return !isNaN(date.getTime()) ? date.toISOString() : null;
    }
    return link.expiresAt || null;
  };

  const handleApplyUtm = () => {
    if (!destinationUrl.trim()) return;
    const withUtm = buildUtmUrl(destinationUrl, utm);
    setDestinationUrl(withUtm);
    setShowUtmBuilder(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const trimmedUrl = destinationUrl.trim();
    if (!trimmedUrl) {
      setErrorMessage('Please provide a destination URL.');
      return;
    }

    const validation = validateLongUrl(trimmedUrl);
    if (!validation.valid) {
      setErrorMessage(validation.error || 'Invalid URL format. Please include http:// or https://');
      return;
    }

    const newExpiresAt = calculateExpiresAt();

    setLoading(true);
    try {
      const updated = await updateShortLink(link.id, {
        originalUrl: validation.cleanUrl || trimmedUrl,
        title: formatCleanTitle(title, validation.cleanUrl || trimmedUrl),
        tags,
        isActive,
        expiresAt: newExpiresAt,
        password: showPasswordProtection && password.trim() ? password.trim() : null,
      });

      setSuccessMessage('Destination URL & link settings updated successfully!');
      if (onLinkUpdated && updated) {
        onLinkUpdated(updated);
      }

      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: any) {
      console.error('Update link error:', err);
      setErrorMessage(err?.message || 'Failed to update link. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const shortUrl = buildShortUrl(link.shortCode);

  const modalContent = (
    <div
      id="edit-link-modal-backdrop"
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="edit-link-modal-dialog"
        className="relative w-full max-w-lg max-h-[90vh] sm:max-h-[85vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl text-slate-900 dark:text-slate-100 my-auto overflow-hidden animate-scale-in text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Fixed Top */}
        <div className="flex items-center justify-between p-5 sm:p-6 pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white flex items-center justify-center shrink-0">
              <Link2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight">
                Edit Destination URL
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Update target destination without changing your short link
              </p>
            </div>
          </div>
          <button
            id="close-edit-modal-btn"
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Container with distinct scrollable area and pinned footer */}
        <form
          id="edit-link-form"
          onSubmit={handleSubmit}
          className="flex flex-col flex-1 min-h-0 overflow-hidden"
        >
          {/* Scrollable Form Body */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 sm:space-y-5 overscroll-contain focus:outline-none">
            {/* Permanent Short URL Badge */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
              <div className="min-w-0 pr-2">
                <span className="text-slate-500 font-medium block text-[10px] uppercase tracking-wider">
                  Permanent Short Link
                </span>
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100 truncate block">
                  {shortUrl}
                </span>
              </div>
              <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full shrink-0">
                QR Code stays active
              </span>
            </div>

            {/* Destination URL Field */}
            <div>
              <label
                htmlFor="edit-modal-destination-url"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Destination URL <span className="text-rose-500">*</span>
              </label>
              <input
                id="edit-modal-destination-url"
                type="text"
                required
                value={destinationUrl}
                onChange={(e) => {
                  setDestinationUrl(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="https://example.com/your-new-destination-page"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white font-mono"
              />
              <div className="flex flex-wrap items-center justify-between gap-1 mt-1.5 text-[11px] text-slate-400">
                <span>Visitors clicking your short link will redirect here</span>
                <button
                  type="button"
                  onClick={() => setShowUtmBuilder(!showUtmBuilder)}
                  className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold cursor-pointer"
                >
                  {showUtmBuilder ? 'Hide UTM Builder' : '+ Add UTM Parameters'}
                </button>
              </div>
            </div>

            {/* UTM Builder Expansion */}
            {showUtmBuilder && (
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3 text-xs animate-fade-in">
                <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                  <span>UTM Campaign Parameters</span>
                  <span className="text-[10px] text-slate-400 font-normal">Optional</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-1">Source (e.g. facebook)</label>
                    <input
                      type="text"
                      value={utm.source}
                      onChange={(e) => setUtm({ ...utm, source: e.target.value })}
                      placeholder="facebook"
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-1">Medium (e.g. cpc, bio)</label>
                    <input
                      type="text"
                      value={utm.medium}
                      onChange={(e) => setUtm({ ...utm, medium: e.target.value })}
                      placeholder="social"
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-1">Campaign Name</label>
                    <input
                      type="text"
                      value={utm.campaign}
                      onChange={(e) => setUtm({ ...utm, campaign: e.target.value })}
                      placeholder="spring_sale"
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-1">Content / Variant</label>
                    <input
                      type="text"
                      value={utm.content}
                      onChange={(e) => setUtm({ ...utm, content: e.target.value })}
                      placeholder="banner_top"
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleApplyUtm}
                  className="w-full py-2 bg-slate-900 text-white dark:bg-white dark:text-slate-950 rounded-lg font-semibold text-xs cursor-pointer hover:opacity-90 transition-opacity"
                >
                  Apply UTM to Destination URL
                </button>
              </div>
            )}

            {/* Title Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="edit-modal-title"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Link Title / Note
                </label>
                <span className="text-[10px] text-slate-400">
                  {title.length}/70
                </span>
              </div>
              <input
                id="edit-modal-title"
                type="text"
                maxLength={70}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Hollyland Mic or Summer Campaign"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white"
              />
            </div>

            {/* Tags */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Tags & Labels
              </label>
              <div className="flex gap-2">
                <input
                  id="edit-modal-tag-input"
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag(tagInput);
                    }
                  }}
                  placeholder="Add a tag..."
                  className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white"
                />
                <button
                  type="button"
                  onClick={() => handleAddTag(tagInput)}
                  className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  Add
                </button>
              </div>

              {/* Quick tag suggestions */}
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <span className="text-[10px] text-slate-400">Suggestions:</span>
                {QUICK_TAG_SUGGESTIONS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleAddTag(tag)}
                    className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors cursor-pointer"
                  >
                    +{tag}
                  </button>
                ))}
              </div>

              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {tags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200/60 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-300 text-xs font-medium"
                    >
                      #{t}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(t)}
                        className="text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-200 ml-0.5 cursor-pointer"
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Link Status Toggle */}
            <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                  Link Status
                </span>
                <span className="text-[11px] text-slate-500">
                  {isActive ? 'Active (visitors redirect normally)' : 'Paused (visitors see paused notification)'}
                </span>
              </div>
              <button
                id="edit-modal-status-toggle"
                type="button"
                onClick={() => setIsActive(!isActive)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isActive ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                    isActive ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Expiration Settings */}
            <div>
              <button
                type="button"
                onClick={() => setShowExpiration(!showExpiration)}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:underline cursor-pointer"
              >
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>{showExpiration ? 'Hide Expiration Settings' : 'Modify Expiration Date'}</span>
              </button>

              {showExpiration && (
                <div className="mt-2.5 p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3 animate-fade-in">
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'keep', label: 'Keep Current' },
                      { id: 'never', label: 'Never Expire' },
                      { id: '24h', label: 'In 24 Hours' },
                      { id: '7d', label: 'In 7 Days' },
                      { id: '30d', label: 'In 30 Days' },
                      { id: 'custom', label: 'Custom Date' },
                    ].map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setExpiryPreset(preset.id as ExpiryPreset)}
                        className={`px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer text-center truncate ${
                          expiryPreset === preset.id
                            ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-xs'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  {expiryPreset === 'custom' && (
                    <div className="animate-fade-in pt-1">
                      <input
                        type="datetime-local"
                        value={customExpiryDate}
                        min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                        onChange={(e) => setCustomExpiryDate(e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Password Protection */}
            <div>
              <button
                type="button"
                onClick={() => setShowPasswordProtection(!showPasswordProtection)}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:underline cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  {showPasswordProtection
                    ? 'Hide Password Settings'
                    : link.isPasswordProtected || link.password
                    ? 'Password Protected (Click to edit)'
                    : 'Protect with Password (optional)'}
                </span>
              </button>

              {showPasswordProtection && (
                <div className="mt-2.5 p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
                      <KeyRound className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Link Password</span>
                    </div>
                    {link.isPasswordProtected || link.password ? (
                      <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
                        Currently Protected
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400">Optional</span>
                    )}
                  </div>

                  <div className="relative">
                    <input
                      id="edit-modal-password-input"
                      type={showPasswordText ? 'text' : 'password'}
                      placeholder="Enter a secret passcode (or leave blank to remove)"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-3 pr-10 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswordText(!showPasswordText)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
                      title={showPasswordText ? 'Hide password' : 'Show password'}
                    >
                      {showPasswordText ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span>Visitors must enter this passcode to access target destination.</span>
                    {password && (
                      <button
                        type="button"
                        onClick={() => setPassword('')}
                        className="text-rose-500 hover:underline cursor-pointer shrink-0 ml-2"
                      >
                        Remove password
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Feedback banners */}
            {errorMessage && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-xl flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300 animate-fade-in">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 rounded-xl flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300 animate-fade-in">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}
          </div>

          {/* Modal Sticky Footer Actions - Pinned outside the scrollable body */}
          <div className="p-4 sm:px-6 border-t border-slate-100 dark:border-slate-800 shrink-0 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-xs flex items-center justify-end gap-3 z-10">
            <button
              id="edit-modal-cancel-btn"
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              id="edit-modal-submit-btn"
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-slate-900 dark:bg-white dark:text-slate-950 hover:bg-slate-800 dark:hover:bg-slate-100 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{loading ? 'Saving...' : 'Save & Update URL'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
