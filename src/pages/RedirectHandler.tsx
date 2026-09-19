import React, { useEffect, useState, useRef } from 'react';
import { ExternalLink, Link2, AlertCircle, Home, ClockAlert, Lock, KeyRound, Eye, EyeOff, ArrowRight, ShieldCheck, Gauge, HelpCircle, ArrowLeft } from 'lucide-react';
import { Logo } from '../components/Logo';
import { getLinkByShortCode, processLinkClick } from '../services/linkService';
import { LinkItem } from '../types';
import { useAppRouter } from '../lib/router';

interface RedirectHandlerProps {
  shortCode: string;
}

export const RedirectHandler: React.FC<RedirectHandlerProps> = ({ shortCode }) => {
  const { navigate } = useAppRouter();
  const [loading, setLoading] = useState(true);
  const [targetLink, setTargetLink] = useState<LinkItem | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const [isClickLimitReached, setIsClickLimitReached] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isPasswordRequired, setIsPasswordRequired] = useState(false);
  const [enteredPassword, setEnteredPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasRedirectedRef = useRef(false);
  const hasStartedProcessingRef = useRef(false);

  const fireRetargetingPixels = (retargeting?: LinkItem['retargeting']): boolean => {
    if (!retargeting) return false;
    let hasFired = false;

    try {
      // 1. Meta Pixel
      if (retargeting.metaPixelId?.trim()) {
        hasFired = true;
        const pixelId = retargeting.metaPixelId.trim();
        const img = new Image();
        img.src = `https://www.facebook.com/tr?id=${encodeURIComponent(pixelId)}&ev=PageView&noscript=1`;
      }

      // 2. Google Tag / Ads
      if (retargeting.googleTagId?.trim()) {
        hasFired = true;
        const tagId = retargeting.googleTagId.trim();
        const script = document.createElement('script');
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(tagId)}`;
        document.head.appendChild(script);

        (window as any).dataLayer = (window as any).dataLayer || [];
        const gtag = (...args: any[]) => {
          (window as any).dataLayer.push(args);
        };
        gtag('js', new Date());
        gtag('config', tagId);
      }

      // 3. TikTok Pixel
      if (retargeting.tiktokPixelId?.trim()) {
        hasFired = true;
        const tiktokId = retargeting.tiktokPixelId.trim();
        const img = new Image();
        img.src = `https://analytics.tiktok.com/api/v2/pixel?pixel_code=${encodeURIComponent(tiktokId)}&event=PageView`;
      }

      // 4. LinkedIn Partner
      if (retargeting.linkedinPartnerId?.trim()) {
        hasFired = true;
        const partnerId = retargeting.linkedinPartnerId.trim();
        const img = new Image();
        img.src = `https://px.ads.linkedin.com/collect/?pid=${encodeURIComponent(partnerId)}&fmt=gif`;
      }

      // 5. Twitter / X Pixel
      if (retargeting.twitterPixelId?.trim()) {
        hasFired = true;
        const twitterId = retargeting.twitterPixelId.trim();
        const img = new Image();
        img.src = `https://t.co/1/i/adsct?p_id=${encodeURIComponent(twitterId)}&p_user_id=guest&txn_id=event`;
      }
    } catch (pixelErr) {
      console.warn('Retargeting pixel firing warning:', pixelErr);
    }

    return hasFired;
  };

  const executeRedirect = async (link: LinkItem) => {
    if (hasRedirectedRef.current) return;
    hasRedirectedRef.current = true;

    try {
      await Promise.race([
        processLinkClick(link),
        new Promise((resolve) => setTimeout(resolve, 5000)),
      ]);
    } catch (clickErr) {
      console.warn('Click tracking warning:', clickErr);
    }

    // Fire custom retargeting pixels if configured for this link
    const hasPixels = fireRetargetingPixels(link.retargeting);
    if (hasPixels) {
      // Allow brief 250ms window for pixel network beacons to transmit before page unload
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    if (link.originalUrl) {
      let dest = link.originalUrl.trim();
      if (!/^https?:\/\//i.test(dest)) {
        dest = 'https://' + dest;
      }

      // Drop-Off Prevention / Back-Button Redirection:
      // Push our site origin into the browser history stack right before navigating.
      // When the user taps their browser's "Back" button on the destination website,
      // it lands directly back on our website rather than dropping off into external history!
      try {
        window.history.pushState({ shortee: true }, '', '/');
      } catch (histErr) {
        console.warn('History pushState warning:', histErr);
      }

      window.location.href = dest;
    }
  };

  useEffect(() => {
    if (hasRedirectedRef.current || hasStartedProcessingRef.current) return;
    hasStartedProcessingRef.current = true;
    let isMounted = true;

    async function handleRedirect() {
      try {
        const link = await getLinkByShortCode(shortCode);

        if (!isMounted) return;

        if (!link) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        // Check if link is paused by creator
        if (link.isActive === false) {
          setTargetLink(link);
          setIsPaused(true);
          setLoading(false);
          return;
        }

        // Check if link has an expiration date and has expired
        if (link.expiresAt) {
          const expTime = new Date(link.expiresAt).getTime();
          if (!isNaN(expTime) && Date.now() > expTime) {
            setTargetLink(link);
            setIsExpired(true);
            setLoading(false);
            return;
          }
        }

        // Check if link has reached its maximum click limit
        if (typeof link.maxClicks === 'number' && link.maxClicks > 0 && link.clicks >= link.maxClicks) {
          setTargetLink(link);
          setIsClickLimitReached(true);
          setLoading(false);
          return;
        }

        setTargetLink(link);

        // Check if link is password protected
        if (link.password && link.password.trim().length > 0) {
          setIsPasswordRequired(true);
          setLoading(false);
          return;
        }

        // If not password-protected, proceed directly with automatic redirect
        await executeRedirect(link);
      } catch (err: any) {
        console.error('Redirect processing error:', err);
        if (isMounted) {
          setErrorMessage('Error retrieving link destination.');
          setLoading(false);
        }
      }
    }

    handleRedirect();

    return () => {
      isMounted = false;
    };
  }, [shortCode]);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetLink) return;

    if (!enteredPassword.trim()) {
      setPasswordError('Please enter the password.');
      return;
    }

    if (enteredPassword.trim() !== (targetLink.password || '').trim()) {
      setPasswordError('Incorrect password. Please try again.');
      return;
    }

    setPasswordError(null);
    setIsUnlocking(true);

    await executeRedirect(targetLink);
  };

  if (isPasswordRequired && targetLink) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-xl p-8 text-center animate-scale-in">
          {/* Header Icon */}
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-5 border border-indigo-200/60 dark:border-indigo-800/60 shadow-sm">
            <Lock className="w-7 h-7" />
          </div>

          <div className="flex items-center justify-center mb-2">
            <Logo size="md" />
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 mt-1 mb-3">
            <ShieldCheck className="w-3.5 h-3.5" />
            Password Protected Link
          </span>

          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white mb-2">
            Enter Password to Continue
          </h1>

          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
            The creator has protected <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">/{shortCode}</span> with a password. Enter the password below to access the destination URL.
          </p>

          <form onSubmit={handlePasswordSubmit} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Access Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={enteredPassword}
                  onChange={(e) => {
                    setEnteredPassword(e.target.value);
                    if (passwordError) setPasswordError(null);
                  }}
                  placeholder="Enter link password..."
                  disabled={isUnlocking}
                  autoFocus
                  className="w-full pl-9 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {passwordError && (
                <div className="flex items-center gap-1.5 text-xs text-rose-500 dark:text-rose-400 mt-2 font-medium">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{passwordError}</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isUnlocking || !enteredPassword.trim()}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 dark:disabled:bg-indigo-900 text-white font-semibold text-xs transition-all shadow-md cursor-pointer disabled:cursor-not-allowed"
            >
              {isUnlocking ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Unlocking & Redirecting...</span>
                </>
              ) : (
                <>
                  <span>Unlock & Proceed</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-center gap-4 text-xs text-slate-500 dark:text-slate-400">
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              <Home className="w-3.5 h-3.5" />
              Return Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isClickLimitReached && targetLink) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl p-8 sm:p-10 text-center animate-scale-in relative overflow-hidden">
          <div className="absolute -top-16 -right-16 w-36 h-36 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-5 border border-amber-200 dark:border-amber-800/80 shadow-xs">
            <Gauge className="w-8 h-8" />
          </div>

          <div className="flex items-center justify-center mb-3">
            <Logo size="md" />
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 mb-2">
            Click Limit Reached
          </span>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mb-2">
            Link Traffic Quota Filled
          </h1>

          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-md mx-auto mb-6">
            The short link <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">/{shortCode}</span> was set with a maximum click quota of <span className="font-semibold text-slate-900 dark:text-white">{targetLink.maxClicks} clicks</span>. This campaign limit has been reached, so redirection is now halted.
          </p>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 mb-6 text-left space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400">Total Clicks Recorded:</span>
              <span className="font-mono font-semibold text-slate-900 dark:text-white">{targetLink.clicks || targetLink.maxClicks} / {targetLink.maxClicks}</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
              <div className="bg-amber-500 h-full w-full rounded-full" />
            </div>
            <p className="text-[11px] text-slate-400">If you are the link owner, you can increase or remove the click limit from your dashboard.</p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold shadow-sm transition-all cursor-pointer"
            >
              <Home className="w-4 h-4" />
              Return Home
            </button>

            <button
              onClick={() => navigate('/dashboard')}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
            >
              <Link2 className="w-4 h-4" />
              Manage or Create Links
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isPaused && targetLink) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl p-8 sm:p-10 text-center animate-scale-in">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-5 border border-amber-200 dark:border-amber-800">
            <AlertCircle className="w-8 h-8" />
          </div>

          <div className="flex items-center justify-center mb-3">
            <Logo size="md" />
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 mb-2">
            Link Inactive
          </span>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mb-2">
            Link Temporarily Paused
          </h1>

          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-md mx-auto mb-6">
            The creator has temporarily paused redirects for <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">/{shortCode}</span>. Please check back later or contact the link administrator.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold shadow-sm transition-all cursor-pointer"
            >
              <Home className="w-4 h-4" />
              Return Home
            </button>

            <button
              onClick={() => navigate('/dashboard')}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
            >
              <Link2 className="w-4 h-4" />
              Create a Link
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isExpired && targetLink) {
    const expiredDateStr = targetLink.expiresAt
      ? new Date(targetLink.expiresAt).toLocaleString(undefined, {
          dateStyle: 'medium',
          timeStyle: 'short',
        })
      : '';

    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl p-8 sm:p-10 text-center animate-scale-in relative overflow-hidden">
          <div className="absolute -top-16 -right-16 w-36 h-36 bg-rose-500/10 rounded-full blur-2xl pointer-events-none" />

          <div className="w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-5 border border-rose-200 dark:border-rose-800 shadow-xs">
            <ClockAlert className="w-8 h-8" />
          </div>

          <div className="flex items-center justify-center mb-3">
            <Logo size="md" />
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 mb-2">
            Link Expired
          </span>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mb-2">
            This Short Link Has Expired
          </h1>

          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-md mx-auto mb-6">
            The creator of <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">/{shortCode}</span> configured an automatic expiration date which passed on <span className="font-semibold text-slate-900 dark:text-white">{expiredDateStr}</span>. For privacy and security reasons, traffic redirection has been permanently halted.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold shadow-sm transition-all cursor-pointer"
            >
              <Home className="w-4 h-4" />
              Return Home
            </button>

            <button
              onClick={() => navigate('/dashboard')}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
            >
              <Link2 className="w-4 h-4" />
              Create Your Free Link
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl p-8 sm:p-10 text-center animate-scale-in relative overflow-hidden">
          <div className="absolute -top-16 -left-16 w-36 h-36 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

          <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-5 border border-indigo-200 dark:border-indigo-800/80 shadow-xs">
            <HelpCircle className="w-8 h-8" />
          </div>

          <div className="flex items-center justify-center mb-3">
            <Logo size="md" />
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 mb-2">
            404 • Destination Not Found
          </span>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mb-2">
            Link Does Not Exist
          </h1>

          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-md mx-auto mb-6">
            The short link <span className="font-mono font-medium text-slate-800 dark:text-slate-200">/{shortCode}</span> could not be resolved. It may have been deleted, the alias was mistyped, or the custom domain has not been linked yet.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold shadow-sm transition-all cursor-pointer"
            >
              <Home className="w-4 h-4" />
              Go to Homepage
            </button>

            <button
              onClick={() => navigate('/dashboard')}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
            >
              <Link2 className="w-4 h-4" />
              Shorten New Link
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Top Hairline Progress Bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500 animate-pulse" />

      <div className="w-full max-w-sm text-center">
        <div className="flex items-center justify-center mx-auto mb-3">
          <Logo size="lg" />
        </div>

        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-2 animate-pulse">
          Redirecting to destination...
        </p>

        {targetLink?.originalUrl && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">
            <p>Taking longer than usual?</p>
            <a
              href={
                /^https?:\/\//i.test(targetLink.originalUrl.trim())
                  ? targetLink.originalUrl.trim()
                  : 'https://' + targetLink.originalUrl.trim()
              }
              onClick={() => {
                hasRedirectedRef.current = true;
                processLinkClick(targetLink).catch(() => {});
              }}
              className="inline-flex items-center gap-1 mt-1 font-semibold text-slate-800 dark:text-slate-200 underline hover:text-indigo-600 transition-colors"
            >
              Continue to {targetLink.originalUrl.replace(/^https?:\/\//i, '').slice(0, 30)}... <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
};
