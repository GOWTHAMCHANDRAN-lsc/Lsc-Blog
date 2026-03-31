/**
 * Next.js Server Component - Blog Index Page
 *
 * Usage:
 * 1. Copy this file to your Next.js app: app/blog/page.tsx
 * 2. Add to .env.local:
 *    PLATFORM_API_URL=https://your-blog-api.com
 *    PLATFORM_API_TOKEN=sbp_xxxxxxxxxxxx
 * 3. Run your Next.js app
 */

import Link from 'next/link';

const API_BASE = process.env.PLATFORM_API_URL || 'http://localhost:3001';
const API_TOKEN = process.env.PLATFORM_API_TOKEN;

interface Post {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  featured_image_url: string | null;
  reading_time_mins: number;
  published_at: string;
  author: {
    id: string;
    name: string;
    avatar_url: string | null;
  };
  categories: {
    id: string;
    name: string;
    slug: string;
  }[];
  tags: {
    id: string;
    name: string;
    slug: string;
  }[];
}

interface SiteConfig {
  site_name: string;
  site_tagline: string | null;
  logo_url: string | null;
  primary_color: string;
  posts_per_page: number;
}

async function getBlogData() {
  const headers = {
    'X-API-Token': API_TOKEN!,
    Accept: 'application/json',
  };

  const [postsRes, configRes] = await Promise.all([
    fetch(`${API_BASE}/api/v1/posts?page=1&per_page=10`, {
      headers,
      cache: 'force-cache',
    }),
    fetch(`${API_BASE}/api/v1/site-config`, { headers, cache: 'force-cache' }),
  ]);

  const postsData = await postsRes.json();
  const configData = await configRes.json();

  return {
    posts: postsData.success ? postsData.data : [],
    config: configData.success ? configData.data : null,
  };
}

export default async function BlogPage() {
  const { posts, config } = await getBlogData();

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px' }}>
      {/* Header */}
      <header style={{ marginBottom: '40px', textAlign: 'center' }}>
        {config?.logo_url && (
          <img
            src={config.logo_url}
            alt={config.site_name}
            style={{ height: '60px', marginBottom: '20px' }}
          />
        )}
        <h1 style={{ fontSize: '2.5rem', marginBottom: '10px' }}>
          {config?.site_name || 'Blog'}
        </h1>
        {config?.site_tagline && (
          <p style={{ color: '#666', fontSize: '1.1rem' }}>
            {config.site_tagline}
          </p>
        )}
      </header>

      {/* Posts Grid */}
      <div style={{ display: 'grid', gap: '30px' }}>
        {posts.map((post: Post) => (
          <article
            key={post.id}
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: '24px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            }}
          >
            {/* Featured Image */}
            {post.featured_image_url && (
              <Link href={`/blog/${post.slug}`}>
                <img
                  src={post.featured_image_url}
                  alt={post.title}
                  style={{
                    width: '100%',
                    height: '200px',
                    objectFit: 'cover',
                    borderRadius: '8px',
                    marginBottom: '16px',
                  }}
                />
              </Link>
            )}

            {/* Categories */}
            <div style={{ marginBottom: '12px' }}>
              {post.categories.map(cat => (
                <span
                  key={cat.id}
                  style={{
                    display: 'inline-block',
                    background: '#e0f2fe',
                    color: '#0369a1',
                    padding: '4px 12px',
                    borderRadius: '16px',
                    fontSize: '12px',
                    marginRight: '8px',
                  }}
                >
                  {cat.name}
                </span>
              ))}
            </div>

            {/* Title */}
            <h2 style={{ fontSize: '1.5rem', marginBottom: '12px' }}>
              <Link
                href={`/blog/${post.slug}`}
                style={{ color: '#2563eb', textDecoration: 'none' }}
              >
                {post.title}
              </Link>
            </h2>

            {/* Excerpt */}
            <p
              style={{ color: '#555', lineHeight: '1.7', marginBottom: '16px' }}
            >
              {post.excerpt}
            </p>

            {/* Meta */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                fontSize: '14px',
                color: '#666',
                borderTop: '1px solid #eee',
                paddingTop: '16px',
              }}
            >
              <span>By {post.author?.name || 'Unknown'}</span>
              <span>•</span>
              <span>{post.reading_time_mins || 5} min read</span>
              <span>•</span>
              <span>{new Date(post.published_at).toLocaleDateString()}</span>
            </div>
          </article>
        ))}
      </div>

      {/* Empty State */}
      {posts.length === 0 && (
        <div
          style={{ textAlign: 'center', padding: '60px 20px', color: '#666' }}
        >
          <p style={{ fontSize: '1.2rem' }}>No posts published yet.</p>
        </div>
      )}
    </div>
  );
}
