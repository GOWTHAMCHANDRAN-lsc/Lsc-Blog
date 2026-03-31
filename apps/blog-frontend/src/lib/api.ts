import { headers } from 'next/headers';

const PLATFORM_API = process.env.PLATFORM_API_URL;
const API_TOKEN = process.env.PLATFORM_API_TOKEN;

function getTenantDomainKey() {
  try {
    const h = headers();
    const hostHeader =
      h.get('x-forwarded-host') ||
      h.get('host') ||
      process.env.TENANT_DOMAIN ||
      '';
    const host = hostHeader.toLowerCase().trim().split(',')[0]?.trim() ?? '';
    return host.replace(/:\d+$/, '');
  } catch {
    const host = (process.env.TENANT_DOMAIN || '').toLowerCase().trim();
    return host.replace(/:\d+$/, '');
  }
}

function tenantTag(suffix: string) {
  const key = getTenantDomainKey() || 'unknown-tenant';
  return `tenant-${key}-${suffix}`;
}

function postTag(slug: string) {
  const key = getTenantDomainKey() || 'unknown-tenant';
  return `post-${key}-${slug}`;
}

export interface Post {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  featured_image_url: string | null;
  reading_time_mins: number;
  word_count: number;
  published_at: string;
  author: {
    id: string;
    name: string;
    avatar_url: string | null;
    bio: string | null;
  };
  categories: { id: string; name: string; slug: string; is_primary: boolean }[];
  tags: { id: string; name: string; slug: string }[];
  seo: {
    meta_title: string | null;
    meta_description: string | null;
    og_title: string | null;
    og_description: string | null;
    og_image_url: string | null;
    canonical_url: string | null;
    twitter_card: string;
    schema_markup: Record<string, unknown> | null;
    robots: string;
  };
}

export interface PaginationMeta {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parent_id: string | null;
  post_count: number;
}

export interface SiteConfig {
  site_name: string;
  site_tagline: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string;
  font_family: string;
  theme_id?: string | null;
  posts_per_page: number;
  enable_comments: boolean;
  comment_provider: string | null;
  comment_moderation: 'off' | 'manual' | 'auto';
  comments_per_page: number;
  analytics_id: string | null;
  rss_enabled: boolean;
  header_scripts: string | null;
  footer_scripts: string | null;
  social_links: Record<string, string> | null;
  nav_links?: { label: string; href: string }[] | null;
  footer_links?: { label: string; href: string }[] | null;
  locale: string;
  timezone: string;
}

export interface Comment {
  id: string;
  author_name: string;
  author_website: string | null;
  author_email?: string;
  content: string;
  created_at: string;
}

// ─── Core fetch wrapper with Next.js cache tags ──────────────────────────────

async function platformFetch<T>(
  endpoint: string,
  params: Record<string, string | number> = {},
  options: { revalidate?: number; tags?: string[] } = {}
): Promise<T> {
  if (!PLATFORM_API) {
    throw new Error('PLATFORM_API_URL is not configured');
  }

  const url = new URL(`${PLATFORM_API}/api/v1${endpoint}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  });

  const tenantDomain = getTenantDomainKey();

  const res = await fetch(url.toString(), {
    headers: {
      ...(API_TOKEN ? { 'X-API-Token': API_TOKEN } : {}),
      ...(tenantDomain ? { 'X-Tenant-Domain': tenantDomain } : {}),
      Accept: 'application/json',
    },
    next: {
      revalidate: options.revalidate ?? 300,
      tags: options.tags ?? [],
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(
      error?.error?.message ?? `API error: ${res.status} ${res.statusText}`
    );
  }

  return res.json();
}

// ─── API Methods ─────────────────────────────────────────────────────────────

export async function getPosts(
  params: {
    page?: number;
    per_page?: number;
    category?: string;
    tag?: string;
    search?: string;
    sort?: string;
    order?: string;
  } = {}
): Promise<{ success: boolean; data: Post[]; meta: PaginationMeta }> {
  return platformFetch('/posts', params as Record<string, string | number>, {
    revalidate: 300,
    tags: [tenantTag('posts')],
  });
}

export async function getPostBySlug(
  slug: string
): Promise<{ success: boolean; data: Post }> {
  return platformFetch(
    `/posts/${slug}`,
    {},
    {
      revalidate: 3600,
      tags: [postTag(slug), tenantTag('posts')],
    }
  );
}

export async function getCategories(): Promise<{
  success: boolean;
  data: Category[];
}> {
  return platformFetch(
    '/categories',
    {},
    {
      revalidate: 600,
      tags: [tenantTag('categories')],
    }
  );
}

export async function getTags(): Promise<{
  success: boolean;
  data: { id: string; name: string; slug: string; post_count: number }[];
}> {
  return platformFetch(
    '/tags',
    {},
    {
      revalidate: 600,
      tags: [tenantTag('tags')],
    }
  );
}

export async function getSiteConfig(): Promise<{
  success: boolean;
  data: SiteConfig;
}> {
  return platformFetch(
    '/site-config',
    {},
    {
      revalidate: 86400,
      tags: [tenantTag('config')],
    }
  );
}

export async function getCommentsByPostSlug(
  slug: string,
  params: { page?: number; per_page?: number } = {}
): Promise<{ success: boolean; data: Comment[]; meta: PaginationMeta }> {
  return platformFetch(
    `/posts/${slug}/comments`,
    params as Record<string, string | number>,
    {
      revalidate: 60,
      tags: [postTag(slug), `${postTag(slug)}-comments`],
    }
  );
}
