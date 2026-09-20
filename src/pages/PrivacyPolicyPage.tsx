import React, { useEffect } from 'react';
import { ArrowLeft, ShieldCheck, Lock, FileText, CheckCircle2, Mail, ExternalLink } from 'lucide-react';
import { useAppRouter } from '../lib/router';
import { useAuth } from '../context/AuthContext';

export const PrivacyPolicyPage: React.FC = () => {
  const { navigate } = useAppRouter();
  const { currentUser } = useAuth();

  useEffect(() => {
    const originalTitle = document.title;
    document.title = 'Privacy Policy - Shortee | Free URL Shortener & Custom Link Generator';

    let metaDesc = document.querySelector('meta[name="description"]');
    const originalDesc = metaDesc?.getAttribute('content');
    if (metaDesc) {
      metaDesc.setAttribute(
        'content',
        'Official Privacy Policy for Shortee (shortee.xyz). Learn how we protect user credentials, secure click analytics, and ensure GDPR & CCPA compliance.'
      );
    }

    let canonical = document.querySelector('link[rel="canonical"]');
    const originalCanonical = canonical?.getAttribute('href');
    if (canonical) {
      canonical.setAttribute('href', 'https://shortee.xyz/privacy');
    }

    // Structured data for Google Search Console
    const scriptId = 'privacy-schema-ld';
    let scriptTag = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!scriptTag) {
      scriptTag = document.createElement('script');
      scriptTag.id = scriptId;
      scriptTag.type = 'application/ld+json';
      scriptTag.text = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        '@id': 'https://shortee.xyz/privacy#webpage',
        url: 'https://shortee.xyz/privacy',
        name: 'Privacy Policy - Shortee',
        description:
          'Official Privacy Policy for Shortee. Learn how we handle user data, secure click analytics, and protect user rights.',
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
              name: 'Privacy Policy',
              item: 'https://shortee.xyz/privacy',
            },
          ],
        },
        mainEntity: {
          '@type': 'DigitalDocument',
          name: 'Shortee Privacy Policy',
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
            Privacy Policy
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Last updated: September 20, 2026 • Official privacy disclosures and data policies for Shortee.
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
            At <strong>Shortee</strong> (accessible from{' '}
            <a
              href="https://shortee.xyz"
              className="text-blue-600 dark:text-blue-400 font-medium hover:underline"
            >
              https://shortee.xyz
            </a>
            ), the privacy of our visitors and registered users is of utmost importance. This Privacy
            Policy document outlines the types of personal and non-personal information that is
            collected and recorded by Shortee and how we use it.
          </p>

          <section className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-blue-500" /> 1. Information We Collect
            </h2>
            <p>
              When you use our URL shortening, custom link, and analytics services, we collect
              information in the following ways:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-slate-600 dark:text-slate-300">
              <li>
                <strong>Account Information:</strong> When you register an account, we collect your
                email address and authentication credentials securely encrypted through Google Firebase
                Auth.
              </li>
              <li>
                <strong>URL & Link Data:</strong> Original destination URLs, custom aliases/slugs, QR
                codes, and metadata associated with links you create. You retain full ownership over your
                links.
              </li>
              <li>
                <strong>Click Analytics Data:</strong> When someone visits a short link created via
                Shortee, we log non-personally identifiable metrics such as approximate geographic
                location (country and city derived via edge lookups), browser and device category (desktop, mobile, tablet), operating system, referrer header, and timestamp.
              </li>
              <li>
                <strong>IP Anonymization:</strong> IP addresses are processed in volatile memory at the
                edge solely for geo-routing and DDoS protection, and are cryptographically hashed or
                discarded. Raw IP addresses are never permanently retained in our databases.
              </li>
            </ul>
          </section>

          <section className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-500" /> 2. How We Use Your Information
            </h2>
            <p>We use the collected information for the following legitimate purposes:</p>
            <ul className="list-disc pl-5 space-y-2 text-slate-600 dark:text-slate-300">
              <li>To provide, operate, and maintain our global edge URL redirection infrastructure.</li>
              <li>
                To generate aggregated, real-time analytics reports for link owners (total clicks,
                top countries, referrers, and device types).
              </li>
              <li>
                To detect and prevent malware, phishing, scam links, spam flooding, and abuse of our
                platform.
              </li>
              <li>To provide customer support and service updates.</li>
            </ul>
          </section>

          <section className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-500" /> 3. Data Protection & Zero-Selling Pledge
            </h2>
            <p>
              <strong>We do not sell, rent, trade, or monetize your personal information or click streams to third parties or advertising brokers.</strong> We use minimal, essential session tokens and local storage only to maintain your logged-in authentication state and theme preferences.
            </p>
            <p>
              All database records are stored in Google Cloud Firestore with enterprise AES-256 encryption at rest, protected by strict Firestore Security Rules ensuring users can only read and modify their own links.
            </p>
          </section>

          <section className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-500" /> 4. Your Rights (GDPR & CCPA)
            </h2>
            <p>
              Users have the right to access, export, or permanently erase their data at any time:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-slate-600 dark:text-slate-300">
              <li>
                <strong>Export:</strong> Download your entire link database and click telemetry as CSV
                directly from your dashboard.
              </li>
              <li>
                <strong>Edit & Delete:</strong> Change destination URLs or permanently delete individual
                links at any time.
              </li>
              <li>
                <strong>Account Erasure:</strong> Delete your account and all associated links permanently
                from the Settings page.
              </li>
            </ul>
          </section>

          <section className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Mail className="w-4 h-4 text-blue-500" /> 5. Contact Us
            </h2>
            <p>
              If you have any questions, regulatory inquiries, or concerns regarding our Privacy Policy,
              please reach out directly to our team at{' '}
              <a
                href="mailto:support@shortee.xyz"
                className="text-blue-600 dark:text-blue-400 font-semibold underline"
              >
                support@shortee.xyz
              </a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};
