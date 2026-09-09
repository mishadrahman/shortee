import React from 'react';
import { Logo } from './Logo';
import { useAppRouter } from '../lib/router';
import { useAuth } from '../context/AuthContext';

export const Footer: React.FC = () => {
  const { navigate } = useAppRouter();
  const { currentUser } = useAuth();

  return (
    <footer
      id="main-footer"
      className="w-full border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-12 px-4 sm:px-6 lg:px-8 text-slate-600 dark:text-slate-400 text-xs transition-colors"
    >
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3 text-center sm:text-left">
          <button
            onClick={() => navigate('/')}
            className="cursor-pointer focus:outline-none"
            aria-label="shortee.xyz home"
          >
            <Logo size="sm" />
          </button>
          <div className="sm:border-l sm:border-slate-200 sm:dark:border-slate-800 sm:pl-3 sm:py-0.5">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Fast, reliable link shortening & analytics</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Built for creators, marketers & developers</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-6 font-medium">
          <button onClick={() => navigate('/')} className="hover:text-slate-900 dark:hover:text-white">
            Home
          </button>
          <a href="#features" className="hover:text-slate-900 dark:hover:text-white">
            Features
          </a>
          <a href="#qr-code" className="hover:text-slate-900 dark:hover:text-white">
            QR Generator
          </a>
          <a href="#analytics" className="hover:text-slate-900 dark:hover:text-white">
            Analytics
          </a>
          {currentUser ? (
            <button onClick={() => navigate('/dashboard')} className="hover:text-slate-900 dark:hover:text-white cursor-pointer font-semibold">
              Dashboard
            </button>
          ) : (
            <button onClick={() => navigate('/login')} className="hover:text-slate-900 dark:hover:text-white cursor-pointer">
              Sign In
            </button>
          )}
        </div>

        <div className="text-center md:text-right text-[11px] text-slate-500">
          <p>© {new Date().getFullYear()} Shortee (shortee.xyz). All rights reserved.</p>
          <p className="mt-1 flex items-center justify-center md:justify-end gap-1">
            Built with production-ready Firebase & React
          </p>
        </div>
      </div>
    </footer>
  );
};
