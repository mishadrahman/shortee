import React from 'react';
import { useAppRouter } from '../lib/router';
import { useAuth } from '../context/AuthContext';

export const Footer: React.FC = () => {
  const { navigate } = useAppRouter();
  const { currentUser } = useAuth();

  return (
    <footer
      id="main-footer"
      className="w-full border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-8 px-4 sm:px-6 lg:px-8 text-slate-600 dark:text-slate-400 text-xs transition-colors"
    >
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex flex-wrap items-center justify-center md:justify-start gap-6 font-medium">
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
          <button onClick={() => navigate('/privacy')} className="hover:text-slate-900 dark:hover:text-white cursor-pointer">
            Privacy Policy
          </button>
          <button onClick={() => navigate('/terms')} className="hover:text-slate-900 dark:hover:text-white cursor-pointer">
            Terms of Service
          </button>
        </div>

        <div className="text-center md:text-right text-xs text-slate-500">
          <p>© {new Date().getFullYear()} All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};
