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
  basePath: string;
}

const RouterContext = createContext<RouterContextType | null>(null);

/**
 * Detect GitHub Pages base subpath e.g. /shortee if accessed from username.github.io/shortee
 */
export function getAppBasePath(): string {
  if (typeof window === 'undefined') return '';
  const pathname = window.location.pathname || '';
  const hostname = window.location.hostname || '';

  // If on *.github.io, the first segment is the repo name
  if (hostname.endsWith('.github.io')) {
    const firstSegment = pathname.split('/').filter(Boolean)[0];
    if (firstSegment) {
      return `/${firstSegment}`;
    }
  }
  return '';
}

function parseCurrentRoute(): RouteInfo {
  if (typeof window === 'undefined') {
    return {
      pathname: '/',
      search: '',
      params: {},
      isShortCodeRoute: false,
    };
  }

  const rawPathname = window.location.pathname || '/';
  const search = window.location.search || '';
  const params: Record<string, string> = {};

  const basePath = getAppBasePath();
  let normalizedPath = rawPathname;

  if (basePath && normalizedPath.startsWith(basePath)) {
    normalizedPath = normalizedPath.slice(basePath.length) || '/';
  }

  if (!normalizedPath.startsWith('/')) {
    normalizedPath = '/' + normalizedPath;
  }

  // Check route segments
  const segments = normalizedPath.split('/').filter(Boolean);
  let isShortCodeRoute = false;
  let shortCode: string | undefined = undefined;

  // Single segment path check for shortcode e.g. /xyz123
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
    pathname: normalizedPath,
    search,
    params,
    isShortCodeRoute,
    shortCode,
  };
}

export const RouterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [route, setRoute] = useState<RouteInfo>(() => parseCurrentRoute());
  const basePath = useMemo(() => getAppBasePath(), []);

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

    const currentBase = getAppBasePath();
    const fullTarget = to.startsWith('/') && currentBase ? `${currentBase}${to}` : to;

    if (options?.replace) {
      window.history.replaceState({}, '', fullTarget);
    } else {
      window.history.pushState({}, '', fullTarget);
    }

    setRoute(parseCurrentRoute());
    window.scrollTo(0, 0);
  }, []);

  const value = useMemo(() => ({ route, navigate, basePath }), [route, navigate, basePath]);

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
};

export function useAppRouter(): RouterContextType {
  const context = useContext(RouterContext);
  if (!context) {
    throw new Error('useAppRouter must be used within a RouterProvider');
  }
  return context;
}

