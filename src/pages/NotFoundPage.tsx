import React from 'react';
import { Home, Link2, AlertTriangle } from 'lucide-react';
import { useAppRouter } from '../lib/router';

export const NotFoundPage: React.FC = () => {
  const { navigate } = useAppRouter();

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center mx-auto mb-5 border border-slate-200 dark:border-slate-700">
          <AlertTriangle className="w-7 h-7" />
        </div>

        <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-400">
          404 Error
        </span>

        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1 mb-2">
          Page Not Found
        </h1>

        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
          The requested route does not exist. It may have been moved, renamed, or you may have followed an outdated link.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold shadow-sm transition-all"
          >
            <Home className="w-3.5 h-3.5" />
            Home
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
          >
            <Link2 className="w-3.5 h-3.5" />
            Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};
