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

  let rawPathname = window.location.pathname || '/';
  const search = window.location.search || '';
  const params: Record<string, string> = {};

  // If redirect query param from 404.html was passed e.g. ?p=/dashboard/links or ?p=/dashboard/analytics/xyz
  if (search && (search.includes('?p=') || search.includes('&p='))) {
    try {
      const searchParams = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
      const p = searchParams.get('p');
      if (p) {
        rawPathname = p;
      }
    } catch {
      // Fallback manual regex extraction for ?p= or &p=
      const match = search.match(/[?&]p=([^&]+)/);
      if (match && match[1]) {
        try {
          rawPathname = decodeURIComponent(match[1]);
        } catch {
          rawPathname = match[1];
        }
      }
    }
  }

  const basePath = getAppBasePath();
  let normalizedPath = rawPathname;

  if (basePath && normalizedPath.startsWith(basePath)) {
    normalizedPath = normalizedPath.slice(basePath.length) || '/';
  }

  // Ensure clean single leading slash and normalize multiple leading slashes
  normalizedPath = '/' + normalizedPath.replace(/^\/+/, '');

  // Remove trailing slash except for root '/'
  if (normalizedPath.length > 1 && normalizedPath.endsWith('/')) {
    normalizedPath = normalizedPath.slice(0, -1);
  }

  // Check route segments
  const segments = normalizedPath.split('/').filter(Boolean);
  let isShortCodeRoute = false;
  let shortCode: string | undefined = undefined;

  // Single segment path check for shortcode e.g. /xyz123 (ensuring not reserved)
  if (segments.length === 1) {
    const first = segments[0].toLowerCase();
    const RESERVED_SET = new Set([
      'dashboard',
      'login',
      'signup',
      'forgot-password',
      'settings',
      'links',
      'analytics',
    ]);
    if (!RESERVED_SET.has(first)) {
      isShortCodeRoute = true;
      shortCode = segments[0];
    }
  }

  // Support direct top-level paths like /links, /analytics/:id, /analytics, /settings by normalizing them to /dashboard/*
  if (normalizedPath === '/links') {
    normalizedPath = '/dashboard/links';
  } else if (normalizedPath === '/settings') {
    normalizedPath = '/dashboard/settings';
  } else if (normalizedPath === '/analytics') {
    normalizedPath = '/dashboard';
  } else if (segments.length >= 2 && segments[0].toLowerCase() === 'analytics') {
    params.id = segments[1];
    normalizedPath = `/dashboard/analytics/${segments[1]}`;
  } else if (segments.length >= 2 && segments[0].toLowerCase() === 'links') {
    params.id = segments[1];
    normalizedPath = `/dashboard/links`;
  }

  // Check for dashboard sub-routes: /dashboard/analytics/:id, /dashboard/links, /dashboard/settings, etc.
  if (segments.length >= 3 && segments[0].toLowerCase() === 'dashboard' && segments[1].toLowerCase() === 'analytics') {
    params.id = segments[2];
  } else if (segments.length >= 3 && segments[0].toLowerCase() === 'dashboard' && segments[1].toLowerCase() === 'links') {
    params.id = segments[2];
  } else if (segments.length >= 2 && segments[0].toLowerCase() === 'dashboard' && segments[1].toLowerCase() === 'analytics') {
    params.id = segments[2] || '';
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

