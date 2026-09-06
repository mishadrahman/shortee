import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { RESERVED_ROUTES } from './urlUtils';

export interface RouteInfo {
  pathname: string;
  search: string;
  params: Record<string, string>;
  isShortCodeRoute: boolean;
  shortCode?: string;
}

interface RouterContextType {
  route: RouteInfo;
  navigate: (to: string, options?: { replace?: boolean }) => void;
}

const RouterContext = createContext<RouterContextType | null>(null);

function parseCurrentRoute(): RouteInfo {
  if (typeof window === 'undefined') {
    return {
      pathname: '/',
      search: '',
      params: {},
      isShortCodeRoute: false,
    };
  }

  const pathname = window.location.pathname || '/';
  const search = window.location.search || '';
  const params: Record<string, string> = {};

  // Check for shortcode route: e.g. /aB72xK (single segment path that is not reserved)
  const segments = pathname.split('/').filter(Boolean);
  let isShortCodeRoute = false;
  let shortCode: string | undefined = undefined;

  if (segments.length === 1) {
    const first = segments[0];
    if (!RESERVED_ROUTES.has(first.toLowerCase())) {
      isShortCodeRoute = true;
      shortCode = first;
    }
  }

  // Check for dashboard analytics route: /dashboard/analytics/:id or /dashboard/links/:id/analytics
  if (segments.length >= 3 && segments[0] === 'dashboard' && segments[1] === 'analytics') {
    params.id = segments[2];
  } else if (segments.length >= 3 && segments[0] === 'dashboard' && segments[1] === 'links') {
    params.id = segments[2];
  }

  return {
    pathname,
    search,
    params,
    isShortCodeRoute,
    shortCode,
  };
}

export const RouterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [route, setRoute] = useState<RouteInfo>(() => parseCurrentRoute());

  useEffect(() => {
    const handlePopState = () => {
      setRoute(parseCurrentRoute());
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = useCallback((to: string, options?: { replace?: boolean }) => {
    if (typeof window === 'undefined') return;

    // Handle full URLs if external
    if (to.startsWith('http://') || to.startsWith('https://')) {
      window.location.href = to;
      return;
    }

    if (options?.replace) {
      window.history.replaceState({}, '', to);
    } else {
      window.history.pushState({}, '', to);
    }

    setRoute(parseCurrentRoute());
    window.scrollTo(0, 0);
  }, []);

  const value = useMemo(() => ({ route, navigate }), [route, navigate]);

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
};

export function useAppRouter(): RouterContextType {
  const context = useContext(RouterContext);
  if (!context) {
    throw new Error('useAppRouter must be used within a RouterProvider');
  }
  return context;
}
