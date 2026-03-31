import type { Post, SiteConfig } from './api';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com';

export function generateArticleSchema(post: Post, config: SiteConfig) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt,
    image: post.featured_image_url ?? undefined,
    datePublished: post.published_at,
    author: {
      '@type': 'Person',
      name: post.author.name,
      url: `${SITE_URL}/author/${post.author.id}`,
    },
    publisher: {
      '@type': 'Organization',
      name: config.site_name,
      logo: config.logo_url
        ? { '@type': 'ImageObject', url: config.logo_url }
        : undefined,
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': post.seo?.canonical_url ?? `${SITE_URL}/${post.slug}`,
    },
    wordCount: post.word_count,
    articleSection: post.categories[0]?.name,
    keywords: post.tags.map(t => t.name).join(', '),
  };
}

export function generateBreadcrumbSchema(
  items: { name: string; url: string }[]
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function generateWebSiteSchema(config: SiteConfig) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: config.site_name,
    description: config.site_tagline ?? undefined,
    url: SITE_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/?search={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}
