import React, { useEffect } from 'react';
import { ArrowLeft, Scale, AlertTriangle, ShieldCheck, Mail } from 'lucide-react';
import { useAppRouter } from '../lib/router';
import { useAuth } from '../context/AuthContext';

export const TermsPage: React.FC = () => {
  const { navigate } = useAppRouter();
  const { currentUser } = useAuth();

  useEffect(() => {
    const originalTitle = document.title;
    document.title = 'Terms of Service - Shortee | Free URL Shortener & Custom Link Generator';

    let metaDesc = document.querySelector('meta[name="description"]');
    const originalDesc = metaDesc?.getAttribute('content');
    if (metaDesc) {
      metaDesc.setAttribute(
        'content',
        'Official Terms of Service for Shortee (shortee.xyz). Review acceptable usage guidelines, zero-tolerance anti-abuse policies, and link owner rights.'
      );
    }

    let canonical = document.querySelector('link[rel="canonical"]');
    const originalCanonical = canonical?.getAttribute('href');
    if (canonical) {
      canonical.setAttribute('href', 'https://shortee.xyz/terms');
    }

    // Structured data for Google Search Console
    const scriptId = 'terms-schema-ld';
    let scriptTag = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!scriptTag) {
      scriptTag = document.createElement('script');
      scriptTag.id = scriptId;
      scriptTag.type = 'application/ld+json';
      scriptTag.text = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        '@id': 'https://shortee.xyz/terms#webpage',
        url: 'https://shortee.xyz/terms',
        name: 'Terms of Service - Shortee',
        description:
          'Official Terms of Service and Acceptable Use Policy for the Shortee URL shortener platform.',
        breadcrumb: {
          '@type': 'BreadcrumbList',
          itemListElement: [
            {
              '@type': 'ListItem',
              position: 1,
              name: 'Home',
              item: 'https://shortee.xyz/',
            },
            {
              '@type': 'ListItem',
              position: 2,
              name: 'Terms of Service',
              item: 'https://shortee.xyz/terms',
            },
          ],
        },
        mainEntity: {
          '@type': 'DigitalDocument',
          name: 'Shortee Terms of Service',
          dateModified: '2026-09-20',
          publisher: {
            '@type': 'Organization',
            name: 'Shortee',
            url: 'https://shortee.xyz',
          },
        },
      });
      document.head.appendChild(scriptTag);
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });

    return () => {
      document.title = originalTitle;
      if (metaDesc && originalDesc) metaDesc.setAttribute('content', originalDesc);
      if (canonical && originalCanonical) canonical.setAttribute('href', originalCanonical);
      const existingScript = document.getElementById(scriptId);
      if (existingScript) existingScript.remove();
    };
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
      {/* Top Header — Clean & consistent with Dashboard, My Links & Settings */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800 mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Terms of Service
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Last updated: September 20, 2026 • Acceptable use policies and platform terms for Shortee.
          </p>
        </div>

        <button
          onClick={() => (currentUser ? navigate('/dashboard') : navigate('/'))}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium text-xs transition-colors cursor-pointer self-start sm:self-auto"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{currentUser ? 'Back to Dashboard' : 'Back to Home'}</span>
        </button>
      </div>

      {/* Main Content Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-10 shadow-xs">
        <div className="prose dark:prose-invert max-w-none text-slate-600 dark:text-slate-300 text-sm leading-relaxed space-y-8">
          <p>
            Welcome to <strong>Shortee</strong> (<a href="https://shortee.xyz" className="text-blue-600 dark:text-blue-400 font-medium hover:underline">https://shortee.xyz</a>). By accessing or using our URL shortener, custom aliases, QR code generator, and analytics platform, you agree to be bound by these Terms of Service.
          </p>

          <section className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" /> 1. Prohibited & Abusive Content (Zero Tolerance)
            </h2>
            <p>
              Shortee is provided to facilitate clean, professional, and fast link sharing. You explicitly agree NOT to shorten or distribute URLs that link to:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-slate-600 dark:text-slate-300">
              <li>Malware, viruses, trojans, ransomware, or malicious spyware.</li>
              <li>Phishing, credential harvesting, scam websites, or financial fraud.</li>
              <li>Illegal content, unsolicited bulk commercial spam, or pirated copyright material.</li>
              <li>Content promoting harassment, hate speech, or dangerous activities.</li>
            </ul>
            <div className="text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 p-3.5 rounded-xl border border-amber-200 dark:border-amber-900/50 mt-2">
              <strong>Violation Notice:</strong> Any links found to violate these standards will be permanently terminated immediately without prior notice, and offending accounts may be banned.
            </div>
          </section>

          <section className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-500" /> 2. Service Availability & Disclaimers
            </h2>
            <p>
              Shortee strives for 99.9% uptime powered by Cloudflare edge caching and distributed cloud databases. However, the service is provided &ldquo;as is&rdquo; without warranties of any kind. We reserve the right to modify, suspend, or discontinue any aspect of the service when necessary for platform maintenance or security upgrades.
            </p>
          </section>

          <section className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Scale className="w-4 h-4 text-blue-500" /> 3. User Ownership & Control
            </h2>
            <p>
              You retain all ownership rights to your original destination URLs. You can modify your destination URLs, download your QR codes, export your click statistics to CSV, or permanently delete links from your account at any time.
            </p>
          </section>

          <section className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Mail className="w-4 h-4 text-blue-500" /> 4. Reporting Abuse
            </h2>
            <p>
              If you discover a malicious or infringing link using a Shortee short URL, please report it immediately to{' '}
              <a href="mailto:abuse@shortee.xyz" className="text-blue-600 dark:text-blue-400 font-semibold underline">
                abuse@shortee.xyz
              </a>. Our security team reviews and disables malicious links promptly.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};
