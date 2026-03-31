import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { Plus_Jakarta_Sans, Public_Sans } from 'next/font/google';
import { getSiteConfig } from '@/lib/api';
import { isSafeExternalLink, sanitizeEmbedMarkup } from '@/lib/content';
import { generateWebSiteSchema } from '@/lib/schema';
import { resolveTheme } from '@/themes/registry';
import './globals.css';

const bodyFont = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-blog-body',
});

const displayFont = Public_Sans({
  subsets: ['latin'],
  variable: '--font-blog-display',
});

export async function generateMetadata(): Promise<Metadata> {
  try {
    const { data: config } = await getSiteConfig();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3002';
    const rssEnabled = isEnabled(config.rss_enabled);
    return {
      title: {
        default: config.site_name,
        template: `%s | ${config.site_name}`,
      },
      description: config.site_tagline ?? undefined,
      icons: config.favicon_url ? { icon: config.favicon_url } : undefined,
      openGraph: { siteName: config.site_name, type: 'website' },
      robots: { index: true, follow: true },
      alternates: rssEnabled
        ? { types: { 'application/rss+xml': `${siteUrl}/feed.xml` } }
        : undefined,
    };
  } catch {
    return { title: 'Blog' };
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let config = null;
  let webSiteSchema = null;

  try {
    const res = await getSiteConfig();
    config = res.data;
    webSiteSchema = generateWebSiteSchema(config);
  } catch {}

  const theme = resolveTheme(config?.theme_id);
  const themeVars = {
    ...theme.vars,
    ...(config?.primary_color ? { '--blog-accent': config.primary_color } : {}),
  } as Record<string, string>;

  const socialLinks = Object.entries(config?.social_links ?? {}).filter(
    (entry): entry is [string, string] =>
      typeof entry[1] === 'string' && isSafeExternalLink(entry[1])
  );
  const rssEnabled = isEnabled(config?.rss_enabled);
  const safeHeaderMarkup = sanitizeEmbedMarkup(config?.header_scripts);
  const safeFooterMarkup = sanitizeEmbedMarkup(config?.footer_scripts);

  const navLinks = normalizeLinkList(config?.nav_links, [
    { label: 'Home', href: '/' },
    { label: 'Categories', href: '/categories' },
    ...(rssEnabled ? [{ label: 'RSS', href: '/feed.xml' }] : []),
  ]);

  const footerLinks = normalizeLinkList(config?.footer_links, [
    { label: 'Home', href: '/' },
    { label: 'Categories', href: '/categories' },
    ...(rssEnabled ? [{ label: 'RSS', href: '/feed.xml' }] : []),
  ]);

  return (
    <html
      lang={config?.locale ?? 'en'}
      className={`${bodyFont.variable} ${displayFont.variable}`}
      data-theme={theme.id}
      style={themeVars}
    >
      <head>
        {webSiteSchema ? (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(webSiteSchema) }}
          />
        ) : null}
        {config?.analytics_id ? (
          <>
            <script
              async
              src={`https://www.googletagmanager.com/gtag/js?id=${config.analytics_id}`}
            />
            <script
              dangerouslySetInnerHTML={{
                __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${config.analytics_id}');`,
              }}
            />
          </>
        ) : null}
      </head>
      <body>
        {safeHeaderMarkup ? (
          <div
            suppressHydrationWarning
            dangerouslySetInnerHTML={{ __html: safeHeaderMarkup }}
          />
        ) : null}

        <div className="site-shell">
          <header className="site-header">
            <div className="site-header__inner">
              <Link href="/" className="site-brand">
                {config?.logo_url ? (
                  <Image
                    src={config.logo_url}
                    alt={config.site_name}
                    className="site-brand__logo"
                    width={40}
                    height={40}
                    priority
                  />
                ) : (
                  <span className="site-brand__mark">SB</span>
                )}
                <span className="site-brand__copy">
                  <span className="site-brand__eyebrow">
                    Editorial platform
                  </span>
                  <span className="site-brand__title">
                    {config?.site_name ?? 'Blog'}
                  </span>
                </span>
              </Link>

              <nav className="site-nav">
                {navLinks.map(item =>
                  item.href.startsWith('/') ? (
                    <Link key={item.href} href={item.href}>
                      {item.label}
                    </Link>
                  ) : (
                    <a
                      key={item.href}
                      href={item.href}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {item.label}
                    </a>
                  )
                )}
              </nav>

              <Link href="/categories" className="site-header__cta">
                Explore
              </Link>
            </div>

            <div className="site-header__strip">
              <p>
                {config?.site_tagline ??
                  'Thoughtful writing on product, publishing, growth, and editorial craft.'}
              </p>
            </div>
          </header>

          <main className="site-main">
            <div className="site-main__inner">{children}</div>
          </main>

          <footer className="site-footer">
            <div className="site-footer__inner">
              <div className="site-footer__row">
                <div>
                  <p className="site-footer__eyebrow">
                    Publishing with clarity
                  </p>
                  <p className="site-footer__copy">
                    Copyright {new Date().getFullYear()}{' '}
                    {config?.site_name ?? 'Blog'}.
                  </p>
                </div>

                <div className="site-footer__links">
                  {footerLinks.map(item =>
                    item.href.startsWith('/') ? (
                      <Link key={item.href} href={item.href}>
                        {item.label}
                      </Link>
                    ) : (
                      <a
                        key={item.href}
                        href={item.href}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {item.label}
                      </a>
                    )
                  )}
                  {socialLinks.map(([label, href]) => (
                    <a key={label} href={href} target="_blank" rel="noreferrer">
                      {label}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </footer>
        </div>

        {safeFooterMarkup ? (
          <div
            suppressHydrationWarning
            dangerouslySetInnerHTML={{ __html: safeFooterMarkup }}
          />
        ) : null}
      </body>
    </html>
  );
}

function isEnabled(value: unknown) {
  return value !== false && value !== 0 && value !== '0';
}

function normalizeLinkList(
  value: unknown,
  fallback: { label: string; href: string }[]
): { label: string; href: string }[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const items = value
    .filter(item => item && typeof item === 'object')
    .map((item: any) => ({
      label: String(item.label || '').trim(),
      href: String(item.href || '').trim(),
    }))
    .filter(item => item.label && item.href)
    .slice(0, 12);

  return items.length ? items : fallback;
}
