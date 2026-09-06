import React, { useState } from 'react';
import {
  Link2,
  Moon,
  Sun,
  Plus,
  LayoutDashboard,
  Link,
  Settings,
  LogOut,
  User as UserIcon,
  Menu,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAppRouter } from '../lib/router';
import { useTheme } from '../lib/theme';

interface NavbarProps {
  onOpenCreateModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenCreateModal }) => {
  const { currentUser, userProfile, logout } = useAuth();
  const { route, navigate } = useAppRouter();
  const { isDark, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const isDashboard = route.pathname.startsWith('/dashboard');

  const handleLogout = async () => {
    try {
      await logout();
      setUserMenuOpen(false);
      navigate('/');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  return (
    <header
      id="main-navbar"
      className="sticky top-0 z-40 w-full border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md transition-colors"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-8">
          <button
            id="brand-logo-btn"
            onClick={() => navigate(currentUser ? '/dashboard' : '/')}
            className="flex items-center gap-2.5 group text-left focus:outline-none cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 flex items-center justify-center transition-transform group-hover:scale-105 shadow-sm">
              <Link2 className="w-5 h-5" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white">
                Shortee
              </span>
              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                .xyz
              </span>
            </div>
          </button>

          {/* Desktop Nav - Dashboard view vs Public view */}
          {currentUser && isDashboard && (
            <nav className="hidden md:flex items-center gap-1">
              <button
                id="nav-overview-btn"
                onClick={() => navigate('/dashboard')}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  route.pathname === '/dashboard'
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-900'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                Overview
              </button>

              <button
                id="nav-links-btn"
                onClick={() => navigate('/dashboard/links')}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  route.pathname.startsWith('/dashboard/links')
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-900'
                }`}
              >
                <Link className="w-4 h-4" />
                My Links
              </button>

              <button
                id="nav-settings-btn"
                onClick={() => navigate('/dashboard/settings')}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  route.pathname === '/dashboard/settings'
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-900'
                }`}
              >
                <Settings className="w-4 h-4" />
                Settings
              </button>
            </nav>
          )}

          {!isDashboard && (
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-400">
              {currentUser && (
                <button
                  onClick={() => navigate('/dashboard')}
                  className="text-slate-900 dark:text-white font-semibold flex items-center gap-1.5 hover:opacity-80 transition-opacity cursor-pointer"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  Dashboard
                </button>
              )}
              <a href="#features" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                Features
              </a>
              <a href="#qr-code" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                QR Codes
              </a>
              <a href="#analytics" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                Analytics
              </a>
              <a href="#how-it-works" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                How it Works
              </a>
            </nav>
          )}
        </div>

        {/* Right Section Actions */}
        <div className="flex items-center gap-3">
          {/* Quick Shorten CTA if in Dashboard or Logged in */}
          {currentUser && onOpenCreateModal && (
            <button
              id="nav-create-link-cta"
              onClick={onOpenCreateModal}
              className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-semibold shadow-sm transition-all active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Shorten URL</span>
            </button>
          )}

          {/* Theme Toggle */}
          <button
            id="theme-toggle-btn"
            onClick={toggleTheme}
            className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle theme"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* User Profile or Sign in buttons */}
          {currentUser ? (
            <div className="relative">
              <button
                id="user-profile-menu-btn"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors focus:outline-none"
              >
                <div className="w-7 h-7 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 flex items-center justify-center font-bold text-xs uppercase">
                  {userProfile?.displayName ? userProfile.displayName.charAt(0) : 'U'}
                </div>
                <span className="hidden sm:inline text-xs font-medium text-slate-700 dark:text-slate-300 max-w-[120px] truncate">
                  {userProfile?.displayName || currentUser.email?.split('@')[0]}
                </span>
              </button>

              {userMenuOpen && (
                <div
                  id="user-dropdown-menu"
                  className="absolute right-0 mt-2 w-56 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl py-2 z-50 text-xs animate-menu-open origin-top-right overflow-hidden"
                >
                  <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 animate-menu-item" style={{ animationDelay: '30ms' }}>
                    <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {userProfile?.displayName || 'Signed In User'}
                    </p>
                    <p className="text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {currentUser.email}
                    </p>
                  </div>

                  <div className="py-1">
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        navigate('/dashboard');
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80 text-left transition-colors cursor-pointer animate-menu-item"
                      style={{ animationDelay: '60ms' }}
                    >
                      <LayoutDashboard className="w-4 h-4" />
                      Dashboard
                    </button>
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        navigate('/dashboard/links');
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80 text-left transition-colors cursor-pointer animate-menu-item"
                      style={{ animationDelay: '90ms' }}
                    >
                      <Link className="w-4 h-4" />
                      My Links
                    </button>
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        navigate('/dashboard/settings');
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80 text-left transition-colors cursor-pointer animate-menu-item"
                      style={{ animationDelay: '120ms' }}
                    >
                      <Settings className="w-4 h-4" />
                      Account Settings
                    </button>
                  </div>

                  <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
                    <button
                      id="dropdown-logout-btn"
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-left font-medium transition-colors cursor-pointer animate-menu-item"
                      style={{ animationDelay: '150ms' }}
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                id="nav-login-btn"
                onClick={() => navigate('/login')}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Log In
              </button>
              <button
                id="nav-signup-btn"
                onClick={() => navigate('/signup')}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 shadow-sm transition-all cursor-pointer"
              >
                Sign Up
              </button>
            </div>
          )}

          {/* Mobile hamburger menu toggle */}
          <button
            id="mobile-menu-toggle-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer active:scale-95"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5 text-slate-900 dark:text-white" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu dropdown */}
      {mobileMenuOpen && (
        <div
          id="mobile-nav-menu"
          className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md px-4 py-4 space-y-2.5 animate-menu-open shadow-lg"
        >
          {currentUser ? (
            <div className="space-y-1.5">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  navigate('/dashboard');
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer active:scale-[0.99] animate-menu-item"
                style={{ animationDelay: '30ms' }}
              >
                <LayoutDashboard className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                Overview
              </button>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  navigate('/dashboard/links');
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer active:scale-[0.99] animate-menu-item"
                style={{ animationDelay: '60ms' }}
              >
                <Link className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                My Links
              </button>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  navigate('/dashboard/settings');
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer active:scale-[0.99] animate-menu-item"
                style={{ animationDelay: '90ms' }}
              >
                <Settings className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                Settings
              </button>
              {onOpenCreateModal && (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenCreateModal();
                  }}
                  className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-950 text-sm font-medium shadow-sm transition-all cursor-pointer active:scale-95 animate-menu-item"
                  style={{ animationDelay: '120ms' }}
                >
                  <Plus className="w-4 h-4" />
                  Shorten New URL
                </button>
              )}
              <div className="pt-2 mt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleLogout();
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer animate-menu-item"
                  style={{ animationDelay: '150ms' }}
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out ({currentUser.email?.split('@')[0]})
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  navigate('/login');
                }}
                className="w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer animate-menu-item"
                style={{ animationDelay: '30ms' }}
              >
                Log In
              </button>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  navigate('/signup');
                }}
                className="w-full text-center px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-semibold transition-transform active:scale-95 cursor-pointer animate-menu-item"
                style={{ animationDelay: '60ms' }}
              >
                Sign Up Free
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
};
