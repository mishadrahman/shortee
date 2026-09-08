import React, { useEffect, useState, useRef } from 'react';
import { ExternalLink, Link2, AlertCircle, Home, ClockAlert } from 'lucide-react';
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
  const [isPaused, setIsPaused] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasRedirectedRef = useRef(false);
  const hasStartedProcessingRef = useRef(false);

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

        setTargetLink(link);

        // 1. Process click tracking and ENSURE Firestore receives and confirms it before redirecting!
        // We race processLinkClick against a 5000ms safety timeout so the visitor is never blocked on broken connections,
        // while giving Firestore ample time to complete the commit even on slower mobile networks.
        try {
          await Promise.race([
            processLinkClick(link),
            new Promise((resolve) => setTimeout(resolve, 5000)),
          ]);
        } catch (clickErr) {
          console.warn('Click tracking warning:', clickErr);
        }

        // 2. Direct browser to original URL
        if (link.originalUrl && !hasRedirectedRef.current) {
          hasRedirectedRef.current = true;
          let dest = link.originalUrl.trim();
          if (!/^https?:\/\//i.test(dest)) {
            dest = 'https://' + dest;
          }
          window.location.replace(dest);
        }
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

  if (isPaused && targetLink) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-8 text-center animate-scale-in">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-5 border border-amber-200 dark:border-amber-800">
            <AlertCircle className="w-7 h-7" />
          </div>

          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            Link Paused
          </span>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1 mb-2">
            Link Temporarily Inactive
          </h1>

          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
            The creator has temporarily paused redirects for <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">/{shortCode}</span>. Please check back later or contact the sender.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5">
            <button
              onClick={() => navigate('/')}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold shadow-sm transition-all cursor-pointer"
            >
              <Home className="w-3.5 h-3.5" />
              Return Home
            </button>

            <button
              onClick={() => navigate('/dashboard')}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
            >
              <Link2 className="w-3.5 h-3.5" />
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
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-8 text-center animate-scale-in">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-5 border border-rose-200 dark:border-rose-800">
            <ClockAlert className="w-7 h-7" />
          </div>

          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">
            Link Expired
          </span>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1 mb-2">
            This link is no longer active
          </h1>

          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
            The creator of short link <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">/{shortCode}</span> set an expiration date which passed on <span className="font-semibold text-slate-800 dark:text-slate-200">{expiredDateStr}</span>. Redirection has been disabled.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5">
            <button
              onClick={() => navigate('/')}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold shadow-sm transition-all cursor-pointer"
            >
              <Home className="w-3.5 h-3.5" />
              Return Home
            </button>

            <button
              onClick={() => navigate('/dashboard')}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
            >
              <Link2 className="w-3.5 h-3.5" />
              Create a Link
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-5 border border-amber-200 dark:border-amber-800">
            <AlertCircle className="w-7 h-7" />
          </div>

          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-400">
            404 • Short Link Not Found
          </span>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1 mb-2">
            Link does not exist
          </h1>

          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
            The short link <span className="font-mono font-medium text-slate-700 dark:text-slate-300">/{shortCode}</span> could not be found. It may have expired, been deleted by its owner, or the URL code was typed incorrectly.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5">
            <button
              onClick={() => navigate('/')}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold shadow-sm transition-all"
            >
              <Home className="w-3.5 h-3.5" />
              Return Home
            </button>

            <button
              onClick={() => navigate('/dashboard')}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
            >
              <Link2 className="w-3.5 h-3.5" />
              Create a Link
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
        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 flex items-center justify-center mx-auto mb-3 shadow-xs">
          <Link2 className="w-5 h-5 animate-pulse" />
        </div>

        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
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
