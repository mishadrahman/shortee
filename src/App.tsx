import React, { useState } from 'react';
import { ThemeProvider } from './lib/theme';
import { RouterProvider, useAppRouter } from './lib/router';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { CreateLinkModal } from './components/CreateLinkModal';
import { QrCodeModal } from './components/QrCodeModal';
import { LandingPage } from './pages/LandingPage';
import { AuthPages } from './pages/AuthPages';
import { DashboardOverview } from './pages/DashboardOverview';
import { DashboardLinks } from './pages/DashboardLinks';
import { LinkAnalyticsPage } from './pages/LinkAnalyticsPage';
import { SettingsPage } from './pages/SettingsPage';
import { RedirectHandler } from './pages/RedirectHandler';
import { NotFoundPage } from './pages/NotFoundPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LinkItem } from './types';

function AppContent() {
  const { route, navigate } = useAppRouter();
  const { currentUser, loading: authLoading } = useAuth();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedQrLink, setSelectedQrLink] = useState<LinkItem | null>(null);

  // If visiting a short code (e.g. /aB72xK), immediately render the redirect handler
  if (route.isShortCodeRoute && route.shortCode) {
    return <RedirectHandler shortCode={route.shortCode} />;
  }

  // Handle protected dashboard routes
  const isDashboardRoute = route.pathname.startsWith('/dashboard');

  if (isDashboardRoute && authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-500">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-slate-900 dark:border-white border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-medium">Loading session...</p>
        </div>
      </div>
    );
  }

  // Render Page Content based on persistent URL route
  const renderPage = () => {
    // 1. Public Auth routes
    if (route.pathname === '/login') {
      return <AuthPages mode="login" />;
    }
    if (route.pathname === '/signup') {
      return <AuthPages mode="signup" />;
    }
    if (route.pathname === '/forgot-password') {
      return <AuthPages mode="forgot-password" />;
    }

    // 2. Protected Dashboard routes (require currentUser)
    if (isDashboardRoute) {
      if (!currentUser) {
        return (
          <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center shadow-lg">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Authentication Required</h2>
              <p className="text-xs text-slate-500 mt-1 mb-5">
                Please log in or sign up to access your links and dashboard metrics.
              </p>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => navigate('/login')}
                  className="px-4 py-2 bg-slate-900 text-white dark:bg-white dark:text-slate-950 text-xs font-semibold rounded-xl"
                >
                  Log In
                </button>
                <button
                  onClick={() => navigate('/signup')}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl"
                >
                  Sign Up
                </button>
              </div>
            </div>
          </div>
        );
      }

      // Check specific dashboard sub-routes
      if (route.pathname === '/dashboard') {
        return (
          <DashboardOverview
            onOpenCreateModal={() => setCreateModalOpen(true)}
            onOpenQrModal={(link) => setSelectedQrLink(link)}
          />
        );
      }

      if (route.pathname === '/dashboard/links') {
        return (
          <DashboardLinks
            onOpenCreateModal={() => setCreateModalOpen(true)}
            onOpenQrModal={(link) => setSelectedQrLink(link)}
          />
        );
      }

      if (route.pathname.startsWith('/dashboard/analytics/')) {
        const linkId = route.params.id;
        if (!linkId) return <NotFoundPage />;
        return (
          <LinkAnalyticsPage
            linkId={linkId}
            onOpenQrModal={(link) => setSelectedQrLink(link)}
          />
        );
      }

      if (route.pathname === '/dashboard/settings') {
        return <SettingsPage />;
      }

      return <NotFoundPage />;
    }

    // 3. Landing page (Root '/')
    if (route.pathname === '/') {
      return (
        <LandingPage
          onOpenQr={(link) => setSelectedQrLink(link)}
        />
      );
    }

    // 4. Fallback 404
    return <NotFoundPage />;
  };

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors antialiased">
      <Navbar onOpenCreateModal={() => setCreateModalOpen(true)} />

      <main className="flex-1 w-full max-w-full overflow-x-hidden">
        {renderPage()}
      </main>

      <Footer />

      {/* Global Modals */}
      <CreateLinkModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onOpenQr={(link) => setSelectedQrLink(link)}
      />

      <QrCodeModal
        link={selectedQrLink}
        onClose={() => setSelectedQrLink(null)}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <RouterProvider>
            <AppContent />
          </RouterProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
