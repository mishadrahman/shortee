import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { validateLongUrl, buildShortUrl, buildUtmUrl } from '../lib/urlUtils';
import { updateShortLink } from '../services/linkService';
import { LinkItem, UtmParams } from '../types';

interface EditLinkModalProps {
  link: LinkItem | null;
  isOpen: boolean;
  onClose: () => void;
  onLinkUpdated?: (updated: LinkItem) => void;
}

type ExpiryPreset = 'never' | '1h' | '24h' | '7d' | '30d' | 'custom' | 'keep';

const QUICK_TAG_SUGGESTIONS = ['Marketing', 'Social', 'Newsletter', 'Promo', 'Bio', 'Ads'];

export const EditLinkModal: React.FC<EditLinkModalProps> = ({
  link,
  isOpen,
  onClose,
  onLinkUpdated,
}) => {
  const [destinationUrl, setDestinationUrl] = useState('');
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showUtmBuilder, setShowUtmBuilder] = useState(false);
  const [showExpiration, setShowExpiration] = useState(false);

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
    if (link) {
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
      setErrorMessage(null);
      setSuccessMessage(null);
    }
  }, [link, isOpen]);

  if (!isOpen || !link) return null;

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

  const calculateExpiresAt = (): string | null | undefined => {
    if (expiryPreset === 'keep') {
      return link.expiresAt;
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
    return link.expiresAt;
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
        title: title.trim() || link.shortCode,
        tags,
        isActive,
        expiresAt: newExpiresAt,
      });

      setSuccessMessage('Destination URL & link settings updated successfully!');
      if (onLinkUpdated && updated) {
        onLinkUpdated(updated);
      }

      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      console.error('Update link error:', err);
      setErrorMessage(err?.message || 'Failed to update link. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const shortUrl = buildShortUrl(link.shortCode);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-950 flex items-center justify-center">
              <Link2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Edit Destination URL</h2>
              <p className="text-xs text-slate-500">Update target location without changing your short link</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Permanent Short URL Badge */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-500 font-medium block">Short Link (Immutable)</span>
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{shortUrl}</span>
            </div>
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md">
              QR Code stays active
            </span>
          </div>

          {/* Destination URL Field */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Destination URL <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={destinationUrl}
              onChange={(e) => setDestinationUrl(e.target.value)}
              placeholder="https://example.com/new-destination-page"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white font-mono"
            />
            <div className="flex items-center justify-between mt-1 text-[11px] text-slate-400">
              <span>Visitors clicking your short URL will instantly redirect here</span>
              <button
                type="button"
                onClick={() => setShowUtmBuilder(!showUtmBuilder)}
                className="text-slate-600 dark:text-slate-300 hover:underline font-medium cursor-pointer"
              >
                {showUtmBuilder ? 'Hide UTM Builder' : '+ Add UTM Parameters'}
              </button>
            </div>
          </div>

          {/* UTM Builder Expansion */}
          {showUtmBuilder && (
            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
              <div className="font-semibold text-slate-800 dark:text-slate-200 text-xs">UTM Tracking Parameters</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Source (e.g. facebook, newsletter)</label>
                  <input
                    type="text"
                    value={utm.source}
                    onChange={(e) => setUtm({ ...utm, source: e.target.value })}
                    placeholder="facebook"
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Medium (e.g. cpc, social, email)</label>
                  <input
                    type="text"
                    value={utm.medium}
                    onChange={(e) => setUtm({ ...utm, medium: e.target.value })}
                    placeholder="cpc"
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Campaign Name</label>
                  <input
                    type="text"
                    value={utm.campaign}
                    onChange={(e) => setUtm({ ...utm, campaign: e.target.value })}
                    placeholder="summer_sale"
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Content / Ad Variant</label>
                  <input
                    type="text"
                    value={utm.content}
                    onChange={(e) => setUtm({ ...utm, content: e.target.value })}
                    placeholder="banner_v1"
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={handleApplyUtm}
                className="w-full py-2 bg-slate-900 text-white dark:bg-white dark:text-slate-950 rounded-lg font-semibold text-xs cursor-pointer"
              >
                Apply UTM to Destination URL
              </button>
            </div>
          )}

          {/* Title Field */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Link Title / Description
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Summer Promo Landing Page"
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
                className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
              />
              <button
                type="button"
                onClick={() => handleAddTag(tagInput)}
                className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold"
              >
                Add
              </button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs"
                  >
                    #{t}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(t)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-white ml-0.5"
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
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">Link Status</span>
              <span className="text-[11px] text-slate-500">
                {isActive ? 'Active (visitors are redirected normally)' : 'Paused (visitors see paused notification)'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsActive(!isActive)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                isActive ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
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
              <div className="mt-2.5 p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
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
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                        expiryPreset === preset.id
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-xs'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {expiryPreset === 'custom' && (
                  <div>
                    <input
                      type="datetime-local"
                      value={customExpiryDate}
                      onChange={(e) => setCustomExpiryDate(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Feedback banners */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-xl flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 rounded-xl flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-white dark:text-slate-950 hover:bg-slate-800 dark:hover:bg-slate-100 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{loading ? 'Saving Changes...' : 'Save & Update URL'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
