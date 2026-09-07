import React, { useState, useEffect } from 'react';
import {
  Link2,
  Mail,
  Lock,
  User,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAppRouter } from '../lib/router';
import { createShortLink, claimGuestLinksToAccount } from '../services/linkService';

type AuthMode = 'login' | 'signup' | 'forgot-password';

interface AuthPagesProps {
  mode: AuthMode;
}

export const AuthPages: React.FC<AuthPagesProps> = ({ mode }) => {
  const {
    currentUser,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    resetPassword,
  } = useAuth();
  const { navigate } = useAppRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isEmailInUse, setIsEmailInUse] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Clear messages when mode changes
  useEffect(() => {
    setErrorMessage(null);
    setIsEmailInUse(false);
  }, [mode]);

  // If already logged in, check if pending link needs to be created or guest links need to be claimed, else redirect to dashboard
  useEffect(() => {
    if (currentUser) {
      const handlePendingUrl = async () => {
        try {
          await claimGuestLinksToAccount(currentUser.uid);
        } catch (e) {
          console.warn('Guest links transfer notice:', e);
        }

        try {
          const pendingUrl = sessionStorage.getItem('pending_shorten_url');
          const pendingAlias = sessionStorage.getItem('pending_shorten_alias');
          const pendingExpiresAt = sessionStorage.getItem('pending_shorten_expires_at');
          if (pendingUrl) {
            sessionStorage.removeItem('pending_shorten_url');
            sessionStorage.removeItem('pending_shorten_alias');
            sessionStorage.removeItem('pending_shorten_expires_at');
            await createShortLink({
              userId: currentUser.uid,
              originalUrl: pendingUrl,
              customAlias: pendingAlias || undefined,
              expiresAt: pendingExpiresAt || undefined,
            });
            navigate('/dashboard/links');
            return;
          }
        } catch (e) {
          console.warn('Pending link creation failed:', e);
        }
        navigate('/dashboard');
      };
      handlePendingUrl();
    }
  }, [currentUser, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        await signInWithEmail(email, password);
      } else if (mode === 'signup') {
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters long.');
        }
        await signUpWithEmail(email, password, displayName);
      } else if (mode === 'forgot-password') {
        await resetPassword(email);
        setSuccessMessage('Password reset link has been sent to your email address.');
      }
    } catch (err: any) {
      const code = err?.code || '';
      const emailInUse = code === 'auth/email-already-in-use' || err?.message?.includes('email-already-in-use');

      // Expected auth validation cases should log warnings, not crash or log uncaught errors
      const isExpectedValidation = [
        'auth/invalid-credential',
        'auth/wrong-password',
        'auth/user-not-found',
        'auth/email-already-in-use',
        'auth/invalid-email',
        'auth/weak-password',
        'auth/popup-closed-by-user',
      ].includes(code) || emailInUse;

      if (isExpectedValidation) {
        console.warn('Authentication notice:', code || err?.message);
      } else {
        console.error('Auth error:', err);
      }

      let message = 'An unexpected error occurred. Please try again.';
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        message = 'Invalid email or password combination.';
      } else if (emailInUse) {
        message = 'An account with this email address already exists. Please log in.';
        setIsEmailInUse(true);
      } else if (code === 'auth/invalid-email') {
        message = 'Please enter a valid email address.';
      } else if (code === 'auth/weak-password') {
        message = 'Password is too weak. Please use at least 6 characters.';
      } else if (err.message) {
        message = err.message;
      }
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        console.warn('Google sign-in popup cancelled by user');
      } else {
        console.warn('Google sign-in notice:', err?.code || err?.message);
        setErrorMessage(err.message || 'Google sign-in failed. Please try again.');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors py-12 animate-fade-in">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-6 sm:p-8 animate-scale-in">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 flex items-center justify-center mx-auto mb-4 shadow-sm">
            <Link2 className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            {mode === 'login' && 'Welcome back'}
            {mode === 'signup' && 'Create your account'}
            {mode === 'forgot-password' && 'Reset your password'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {mode === 'login' && 'Enter your credentials to access your short links'}
            {mode === 'signup' && 'Sign up to shorten, share, and track your URLs'}
            {mode === 'forgot-password' && "We'll send you an email with reset instructions"}
          </p>
        </div>

        {/* Segmented Mode Switcher (Login / Sign Up) */}
        {mode !== 'forgot-password' && (
          <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 mb-6">
            <button
              id="switch-to-login-tab"
              type="button"
              onClick={() => {
                setErrorMessage(null);
                setIsEmailInUse(false);
                navigate('/login');
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                mode === 'login'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Log in
            </button>
            <button
              id="switch-to-signup-tab"
              type="button"
              onClick={() => {
                setErrorMessage(null);
                setIsEmailInUse(false);
                navigate('/signup');
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                mode === 'signup'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Sign up
            </button>
          </div>
        )}

        {/* Alerts */}
        {errorMessage && (
          <div
            id="auth-error-alert"
            className="mb-5 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex flex-col gap-2"
          >
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <span className="flex-1">{errorMessage}</span>
            </div>
            {isEmailInUse && mode === 'signup' && (
              <button
                id="switch-to-login-from-error-btn"
                type="button"
                onClick={() => {
                  setIsEmailInUse(false);
                  setErrorMessage(null);
                  navigate('/login');
                }}
                className="self-start text-xs font-semibold text-rose-700 dark:text-rose-300 underline hover:no-underline ml-6"
              >
                Click here to log in with this email →
              </button>
            )}
          </div>
        )}

        {successMessage && (
          <div
            id="auth-success-alert"
            className="mb-5 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs flex items-start gap-2.5"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Google Sign-in Option (for login & signup) */}
        {mode !== 'forgot-password' && (
          <>
            <button
              id="google-signin-btn"
              type="button"
              onClick={handleGoogleSignIn}
              disabled={googleLoading || loading}
              className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 text-xs font-semibold shadow-sm transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              {googleLoading ? 'Connecting to Google...' : `Continue with Google`}
            </button>

            <div className="relative my-6 text-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200 dark:border-slate-800" />
              </div>
              <span className="relative px-3 bg-white dark:bg-slate-900 text-[11px] font-medium uppercase tracking-wider text-slate-400">
                Or with email
              </span>
            </div>
          </>
        )}

        {/* Email & Password Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Full Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="signup-name-input"
                  type="text"
                  placeholder="Alex Morgan"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400 placeholder:text-slate-400"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Email Address <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Mail className="w-4 h-4" />
              </div>
              <input
                id="auth-email-input"
                type="email"
                required
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400 placeholder:text-slate-400"
              />
            </div>
          </div>

          {mode !== 'forgot-password' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Password <span className="text-rose-500">*</span>
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => navigate('/forgot-password')}
                    className="text-[11px] font-medium text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="auth-password-input"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400 placeholder:text-slate-400"
                />
              </div>
            </div>
          )}

          <button
            id="auth-submit-btn"
            type="submit"
            disabled={loading}
            className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-semibold shadow-sm transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? (
              'Processing...'
            ) : (
              <>
                {mode === 'login' && 'Sign In to Dashboard'}
                {mode === 'signup' && 'Create Free Account'}
                {mode === 'forgot-password' && 'Send Password Reset Link'}
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>

        {/* Footer Navigation Switch */}
        <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 text-center text-xs text-slate-500 dark:text-slate-400">
          {mode === 'login' && (
            <p>
              Don't have an account?{' '}
              <button
                onClick={() => navigate('/signup')}
                className="font-semibold text-slate-900 dark:text-white hover:underline"
              >
                Sign up free
              </button>
            </p>
          )}

          {mode === 'signup' && (
            <p>
              Already have an account?{' '}
              <button
                onClick={() => navigate('/login')}
                className="font-semibold text-slate-900 dark:text-white hover:underline"
              >
                Log in
              </button>
            </p>
          )}

          {mode === 'forgot-password' && (
            <p>
              Remember your password?{' '}
              <button
                onClick={() => navigate('/login')}
                className="font-semibold text-slate-900 dark:text-white hover:underline"
              >
                Back to log in
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
