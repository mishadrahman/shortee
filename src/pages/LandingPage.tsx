import React, { useState } from 'react';
import {
  Link2,
  ArrowRight,
  QrCode,
  BarChart3,
  ShieldCheck,
  Zap,
  Check,
  Copy,
  ExternalLink,
  Sparkles,
  AlertCircle,
  Clock,
  Calendar,
  Layers,
  MousePointerClick,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAppRouter } from '../lib/router';
import { validateLongUrl, validateCustomAlias, buildShortUrl } from '../lib/urlUtils';
import { createShortLink } from '../services/linkService';
import { LinkItem } from '../types';
import { QRCodeCanvas } from 'qrcode.react';

interface LandingPageProps {
  onOpenQr?: (link: LinkItem) => void;
}

type ExpiryPreset = 'never' | '1h' | '24h' | '7d' | '30d' | 'custom';

export const LandingPage: React.FC<LandingPageProps> = ({ onOpenQr }) => {
  const { currentUser } = useAuth();
  const { navigate } = useAppRouter();

  const [inputUrl, setInputUrl] = useState('');
  const [customAlias, setCustomAlias] = useState('');
  const [showAliasInput, setShowAliasInput] = useState(false);
  const [showExpiryInput, setShowExpiryInput] = useState(false);
  const [expiryPreset, setExpiryPreset] = useState<ExpiryPreset>('never');
  const [customExpiryDate, setCustomExpiryDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [createdResult, setCreatedResult] = useState<LinkItem | null>(null);
  const [copied, setCopied] = useState(false);

  const calculateExpiresAt = (): string | null => {
    if (!showExpiryInput || expiryPreset === 'never') return null;

    const now = Date.now();
    if (expiryPreset === '1h') return new Date(now + 60 * 60 * 1000).toISOString();
    if (expiryPreset === '24h') return new Date(now + 24 * 60 * 60 * 1000).toISOString();
    if (expiryPreset === '7d') return new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();
    if (expiryPreset === '30d') return new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();
    if (expiryPreset === 'custom') {
      if (!customExpiryDate) {
        throw new Error('Please select an expiration date and time.');
      }
      const time = new Date(customExpiryDate).getTime();
      if (isNaN(time)) throw new Error('Invalid expiration date.');
      if (time <= now) throw new Error('Expiration date must be in the future.');
      return new Date(customExpiryDate).toISOString();
    }
    return null;
  };

  // Handle hero shortener submission
  const handleHeroShorten = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const validation = validateLongUrl(inputUrl);
    if (!validation.valid) {
      setErrorMsg(validation.error || 'Invalid URL entered.');
      return;
    }

    if (customAlias.trim()) {
      const aliasCheck = validateCustomAlias(customAlias);
      if (!aliasCheck.valid) {
        setErrorMsg(aliasCheck.error || 'Invalid custom alias.');
        return;
      }
    }

    let calculatedExpiresAt: string | null = null;
    try {
      calculatedExpiresAt = calculateExpiresAt();
    } catch (err: any) {
      setErrorMsg(err.message || 'Invalid expiration settings.');
      return;
    }

    // If user is not logged in, we guide them directly to sign in or sign up with their URL prefilled!
    if (!currentUser) {
      // Store pending url in sessionStorage so it can be shortened upon login
      try {
        sessionStorage.setItem('pending_shorten_url', validation.cleanUrl!);
        if (customAlias.trim()) {
          sessionStorage.setItem('pending_shorten_alias', customAlias.trim());
        }
        if (calculatedExpiresAt) {
          sessionStorage.setItem('pending_shorten_expires_at', calculatedExpiresAt);
        }
      } catch (e) {
        // ignore
      }
      navigate('/signup');
      return;
    }

    setLoading(true);
    try {
      const link = await createShortLink({
        userId: currentUser.uid,
        originalUrl: validation.cleanUrl!,
        customAlias: customAlias.trim() || undefined,
        expiresAt: calculatedExpiresAt,
      });
      setCreatedResult(link);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message || 'Failed to shorten URL.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!createdResult) return;
    const shortUrl = buildShortUrl(createdResult.shortCode);
    await navigator.clipboard.writeText(shortUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* Hero Section */}
      <section className="relative pt-16 pb-20 md:pt-24 md:pb-28 overflow-hidden">
        {/* Subtle background decoration */}
        <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] dark:bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-60 pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center animate-fade-in">
          {/* Badge */}
          {currentUser ? (
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs font-semibold shadow-xs mb-6 transition-all">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Signed in as {currentUser.displayName || currentUser.email?.split('@')[0]}</span>
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="ml-1 underline underline-offset-2 hover:opacity-80 cursor-pointer"
              >
                Go to Dashboard &rarr;
              </button>
            </div>
          ) : (
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 shadow-xs mb-6 transition-all hover:scale-105"
            >
              <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              <span>Shortee.xyz • Modern URL Shortening & QR Generator</span>
            </div>
          )}

          {/* Main Hero Headline */}
          <h1
            className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white max-w-3xl mx-auto leading-tight"
          >
            Shorten links. <br className="hidden sm:inline" />
            <span className="text-slate-700 dark:text-slate-300">Share anywhere.</span> Track clicks.
          </h1>

          <p
            className="mt-5 text-base sm:text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed"
          >
            Create clean, memorable short URLs and high-resolution QR codes in seconds.
            Monitor engagement with real-time click metrics and device analytics.
          </p>

          {/* Visually Prominent Shortener Card */}
          <div
            className="mt-10 max-w-2xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-4 sm:p-6 text-left transition-all duration-300 hover:shadow-2xl"
          >
            <form onSubmit={handleHeroShorten} className="space-y-3">
              <div className="flex flex-col sm:flex-row items-stretch gap-2.5">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Link2 className="w-4 h-4" />
                  </div>
                  <input
                    id="hero-url-input"
                    type="text"
                    required
                    placeholder="Enter any long link (e.g. https://mybrand.com/special-deal)"
                    value={inputUrl}
                    onChange={(e) => {
                      setInputUrl(e.target.value);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    className="w-full pl-10 pr-3.5 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-300 transition-all placeholder:text-slate-400"
                  />
                </div>

                <button
                  id="hero-shorten-submit-btn"
                  type="submit"
                  disabled={loading || !inputUrl.trim()}
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 font-semibold text-sm transition-all duration-200 shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
                >
                  {loading ? 'Shortening...' : 'Shorten URL'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {/* Custom Alias & Expiration Date Toggles */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs pt-1">
                <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAliasInput(!showAliasInput)}
                    className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                    {showAliasInput ? 'Hide Custom Alias' : 'Customize Alias (optional)'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowExpiryInput(!showExpiryInput)}
                    className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors cursor-pointer"
                  >
                    <Calendar className="w-3.5 h-3.5 shrink-0" />
                    {showExpiryInput ? 'Hide Expiration' : 'Set Expiration (optional)'}
                  </button>
                </div>

                <span className="text-[11px] sm:text-xs text-slate-500">
                  {currentUser ? 'Saved directly to your account' : 'Free forever • No credit card required'}
                </span>
              </div>

              {showAliasInput && (
                <div className="overflow-hidden pt-2 animate-fade-in">
                  <div className="flex items-center rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/60 overflow-hidden focus-within:ring-2 focus-within:ring-slate-900 dark:focus-within:ring-slate-400 transition-all">
                    <span className="px-2.5 sm:px-3.5 py-2.5 text-[11px] sm:text-xs font-mono text-slate-400 bg-slate-50 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 select-none shrink-0">
                      shortee.xyz/
                    </span>
                    <input
                      id="hero-alias-input"
                      type="text"
                      placeholder="custom-link-name"
                      value={customAlias}
                      onChange={(e) => setCustomAlias(e.target.value.replace(/\s+/g, '-'))}
                      className="w-full min-w-0 px-2.5 sm:px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 bg-transparent focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {showExpiryInput && (
                <div className="mt-2 p-3 sm:p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 animate-fade-in space-y-2.5 text-left">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      Expire link after:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {(
                        [
                          { key: 'never', label: 'Never' },
                          { key: '1h', label: '1h' },
                          { key: '24h', label: '24h' },
                          { key: '7d', label: '7d' },
                          { key: '30d', label: '30d' },
                          { key: 'custom', label: 'Custom' },
                        ] as const
                      ).map((preset) => (
                        <button
                          key={preset.key}
                          type="button"
                          onClick={() => {
                            setExpiryPreset(preset.key);
                            if (errorMsg) setErrorMsg(null);
                          }}
                          className={`px-2 sm:px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
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
                      <input
                        id="hero-expiry-custom-input"
                        type="datetime-local"
                        min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                        value={customExpiryDate}
                        onChange={(e) => {
                          setCustomExpiryDate(e.target.value);
                          if (errorMsg) setErrorMsg(null);
                        }}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400"
                      />
                    </div>
                  )}

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                    {expiryPreset === 'never'
                      ? 'Link stays active forever.'
                      : 'Visitors will see an expired link page after the expiration timestamp passes.'}
                  </p>
                </div>
              )}

              {/* Error Message */}
              {errorMsg && (
                <div
                  id="hero-error-banner"
                  className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2 animate-fade-in"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                  <span>{errorMsg}</span>
                </div>
              )}
            </form>

            {/* If link was just generated while logged in */}
            {createdResult && (
              <div
                className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 animate-scale-in"
              >
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                      Your Short Link is Ready:
                    </span>
                    <p className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100 select-all mt-0.5">
                      {buildShortUrl(createdResult.shortCode)}
                    </p>
                    {createdResult.expiresAt && (
                      <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1 mt-1 font-medium">
                        <Clock className="w-3 h-3 shrink-0" />
                        Expires: {new Date(createdResult.expiresAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopy}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition-all active:scale-95 cursor-pointer"
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                    <button
                      onClick={() => onOpenQr && onOpenQr(createdResult)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100/50 text-emerald-900 dark:text-emerald-200 text-xs font-medium transition-all active:scale-95 cursor-pointer"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      QR
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick Metrics Bar */}
          <div
            className="mt-8 flex flex-wrap items-center justify-center gap-6 sm:gap-12 text-xs text-slate-500 dark:text-slate-400 font-medium animate-fade-in"
          >
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Safe HTTP & HTTPS Verification</span>
            </div>
            <div className="flex items-center gap-2">
              <QrCode className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Instant Client-Side QR Generation</span>
            </div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-slate-700 dark:text-slate-300" />
              <span>Real-Time Click Tracking</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Everything you need to manage links
            </h2>
            <p className="mt-3 text-slate-600 dark:text-slate-400 text-sm">
              Built with modern engineering standards for speed, security, and effortless workflow.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div
              className="p-7 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between shadow-xs transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
            >
              <div>
                <div className="w-12 h-12 rounded-xl bg-slate-200/80 dark:bg-slate-800 flex items-center justify-center text-slate-900 dark:text-slate-100 mb-5">
                  <Link2 className="w-6 h-6" />
                </div>
                <h3 className="font-semibold text-lg text-slate-900 dark:text-white">
                  Reliable URL Shortening
                </h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Turn cumbersome long web links into concise, shareable URLs. Choose custom aliases or let our unique alphanumeric engine generate one automatically.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <Check className="w-4 h-4 text-emerald-500" />
                <span>Strict protocol validation & no dead ends</span>
              </div>
            </div>

            {/* Feature 2 */}
            <div
              id="qr-code"
              className="p-7 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between shadow-xs transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
            >
              <div>
                <div className="w-12 h-12 rounded-xl bg-slate-200/80 dark:bg-slate-800 flex items-center justify-center text-slate-900 dark:text-slate-100 mb-5">
                  <QrCode className="w-6 h-6" />
                </div>
                <h3 className="font-semibold text-lg text-slate-900 dark:text-white">
                  Built-In QR Code Engine
                </h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Every link automatically receives a high-resolution QR code. Download as PNG directly from your browser with zero external server dependencies.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <Check className="w-4 h-4 text-emerald-500" />
                <span>Points directly to your short URL</span>
              </div>
            </div>

            {/* Feature 3 */}
            <div
              id="analytics"
              className="p-7 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between shadow-xs transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
            >
              <div>
                <div className="w-12 h-12 rounded-xl bg-slate-200/80 dark:bg-slate-800 flex items-center justify-center text-slate-900 dark:text-slate-100 mb-5">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <h3 className="font-semibold text-lg text-slate-900 dark:text-white">
                  Real-Time Click Insights
                </h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Track total clicks across all links and inspect individual link performance with device breakdown and referrers.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <Check className="w-4 h-4 text-emerald-500" />
                <span>Safe frontend analytics without privacy intrusion</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Simple 3-Step Process
            </span>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              How it works
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div
              className="relative text-center p-6 rounded-2xl transition-all duration-200 hover:-translate-y-1 hover:bg-slate-100/50 dark:hover:bg-slate-900/50"
            >
              <div className="w-12 h-12 mx-auto rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-950 font-bold flex items-center justify-center text-base mb-4 shadow-sm">
                1
              </div>
              <h3 className="font-semibold text-base mb-2">Paste Destination URL</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Provide any valid HTTP or HTTPS long URL. Give it a title or optional custom alias.
              </p>
            </div>

            <div
              className="relative text-center p-6 rounded-2xl transition-all duration-200 hover:-translate-y-1 hover:bg-slate-100/50 dark:hover:bg-slate-900/50"
            >
              <div className="w-12 h-12 mx-auto rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-950 font-bold flex items-center justify-center text-base mb-4 shadow-sm">
                2
              </div>
              <h3 className="font-semibold text-base mb-2">Get Short Code & QR</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Generate a unique short code in Firestore and instantly preview or download the PNG QR code.
              </p>
            </div>

            <div
              className="relative text-center p-6 rounded-2xl transition-all duration-200 hover:-translate-y-1 hover:bg-slate-100/50 dark:hover:bg-slate-900/50"
            >
              <div className="w-12 h-12 mx-auto rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-950 font-bold flex items-center justify-center text-base mb-4 shadow-sm">
                3
              </div>
              <h3 className="font-semibold text-base mb-2">Share & Track Engagement</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Visitors get redirected instantly while click counters and referral data are logged in real-time.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            {currentUser ? 'Ready to manage your links?' : 'Ready to shorten and track your links?'}
          </h2>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
            {currentUser
              ? 'Jump directly into your dashboard to analyze click performance, generate QR codes, and create new shortened URLs.'
              : 'Create your free account to access your personal dashboard, manage links, and monitor clicks.'}
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            {currentUser ? (
              <>
                <button
                  id="cta-dashboard-btn"
                  onClick={() => navigate('/dashboard')}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 font-semibold text-sm transition-all duration-200 shadow-sm active:scale-95 cursor-pointer"
                >
                  <span>Go to Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  id="cta-links-btn"
                  onClick={() => navigate('/dashboard/links')}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-sm transition-all duration-200 active:scale-95 cursor-pointer"
                >
                  Manage My Links
                </button>
              </>
            ) : (
              <>
                <button
                  id="cta-signup-btn"
                  onClick={() => navigate('/signup')}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 font-semibold text-sm transition-all duration-200 shadow-sm active:scale-95 cursor-pointer"
                >
                  Get Started for Free
                </button>
                <button
                  id="cta-login-btn"
                  onClick={() => navigate('/login')}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-sm transition-all duration-200 active:scale-95 cursor-pointer"
                >
                  Sign In to Dashboard
                </button>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
