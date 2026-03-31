import { getPosts, getSiteConfig } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [{ data: config }, { data: posts }] = await Promise.all([
      getSiteConfig(),
      getPosts({ per_page: 25 }),
    ]);

    const rssEnabled = isEnabled(config.rss_enabled);
    if (!rssEnabled) {
      return new Response('RSS feed disabled', { status: 404 });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3002';
    const items = posts
      .map(
        post => `
          <item>
            <title>${escapeXml(post.title)}</title>
            <link>${siteUrl}/${post.slug}</link>
            <guid>${siteUrl}/${post.slug}</guid>
            <pubDate>${new Date(post.published_at).toUTCString()}</pubDate>
            <description>${escapeXml(post.excerpt || '')}</description>
          </item>`
      )
      .join('');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <title>${escapeXml(config.site_name)}</title>
          <link>${siteUrl}</link>
          <description>${escapeXml(config.site_tagline || `${config.site_name} updates`)}</description>
          <language>${escapeXml(config.locale || 'en')}</language>
          ${items}
        </channel>
      </rss>`;

    return new Response(xml, {
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 's-maxage=600, stale-while-revalidate=3600',
      },
    });
  } catch {
    return new Response('Unable to generate feed', { status: 500 });
  }
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function isEnabled(value: unknown) {
  return value !== false && value !== 0 && value !== '0';
}
