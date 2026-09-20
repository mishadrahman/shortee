import fs from 'node:fs';
import path from 'node:path';

const distDir = path.join(process.cwd(), 'dist');
const indexPath = path.join(distDir, 'index.html');

if (!fs.existsSync(indexPath)) {
  console.error('Error: dist/index.html not found. Run vite build first.');
  process.exit(1);
}

const template = fs.readFileSync(indexPath, 'utf-8');

const routes = [
  {
    path: 'login',
    title: 'Sign In - Shortee | Free URL Shortener',
    description: 'Sign in to your Shortee account to manage your shortened links, custom domains, smart QR codes, and real-time analytics.',
    canonical: 'https://shortee.xyz/login',
  },
  {
    path: 'signup',
    title: 'Create Free Account - Shortee | Free URL Shortener',
    description: 'Create a free Shortee account. Get unlimited custom links, advanced QR code generator, retargeting pixels, and live click tracking.',
    canonical: 'https://shortee.xyz/signup',
  },
  {
    path: 'forgot-password',
    title: 'Reset Password - Shortee',
    description: 'Reset your Shortee account password to regain access to your dashboard and links.',
    canonical: 'https://shortee.xyz/forgot-password',
  },
  {
    path: 'dashboard',
    title: 'Dashboard - Shortee',
    description: 'View your Shortee dashboard overview, top performing links, and click statistics.',
    canonical: 'https://shortee.xyz/dashboard',
  },
  {
    path: 'dashboard/links',
    title: 'My Links - Shortee',
    description: 'Manage all your created short links, edit destinations, and download QR codes.',
    canonical: 'https://shortee.xyz/dashboard/links',
  },
  {
    path: 'dashboard/analytics',
    title: 'Link Analytics - Shortee',
    description: 'Real-time click analytics, geographic traffic maps, device breakdowns, and referrer sources.',
    canonical: 'https://shortee.xyz/dashboard/analytics',
  },
  {
    path: 'dashboard/settings',
    title: 'Account Settings - Shortee',
    description: 'Manage your Shortee account preferences, API keys, and custom domain settings.',
    canonical: 'https://shortee.xyz/dashboard/settings',
  },
];

console.log('Generating static HTML files for SPA routes...');

for (const route of routes) {
  let content = template;

  // Replace Title
  content = content.replace(
    /<title>.*?<\/title>/i,
    `<title>${route.title}</title>`
  );

  // Replace Description
  content = content.replace(
    /<meta\s+name="description"\s+content=".*?"\s*\/?>/i,
    `<meta name="description" content="${route.description}" />`
  );

  // Replace Canonical Link
  content = content.replace(
    /<link\s+rel="canonical"\s+href=".*?"\s*\/?>/i,
    `<link rel="canonical" href="${route.canonical}" />`
  );

  // Replace OG / Twitter meta
  content = content.replace(
    /<meta\s+property="og:title"\s+content=".*?"\s*\/?>/i,
    `<meta property="og:title" content="${route.title}" />`
  );
  content = content.replace(
    /<meta\s+property="og:description"\s+content=".*?"\s*\/?>/i,
    `<meta property="og:description" content="${route.description}" />`
  );
  content = content.replace(
    /<meta\s+property="og:url"\s+content=".*?"\s*\/?>/i,
    `<meta property="og:url" content="${route.canonical}" />`
  );
  content = content.replace(
    /<meta\s+name="twitter:url"\s+content=".*?"\s*\/?>/i,
    `<meta name="twitter:url" content="${route.canonical}" />`
  );

  // Write to dist/[route]/index.html
  const routeDir = path.join(distDir, route.path);
  fs.mkdirSync(routeDir, { recursive: true });
  fs.writeFileSync(path.join(routeDir, 'index.html'), content, 'utf-8');

  // Also write to dist/[route].html for direct route requests without trailing slashes
  if (!route.path.includes('/')) {
    fs.writeFileSync(path.join(distDir, `${route.path}.html`), content, 'utf-8');
  }

  console.log(`✓ Generated /${route.path} (index.html & .html)`);
}

// Ensure 404.html exists in dist
const notFoundPath = path.join(distDir, '404.html');
if (!fs.existsSync(notFoundPath)) {
  fs.copyFileSync(indexPath, notFoundPath);
  console.log('✓ Copied index.html to 404.html');
}

console.log('Static route generation completed successfully!');
