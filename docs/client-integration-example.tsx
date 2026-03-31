/**
 * Client Integration Example - Use this in any Next.js project
 *
 * Setup:
 * 1. Get your API token from the admin dashboard
 * 2. Add environment variables (see .env.example)
 * 3. Copy this file to your project
 */

// .env.local
// PLATFORM_API_URL=https://your-blog-api.com
// PLATFORM_API_TOKEN=sbp_xxxxxxxxxxxx

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
  author: { id: string; name: string; avatar_url: string | null };
  categories: { id: string; name: string; slug: string }[];
  tags: { id: string; name: string; slug: string }[];
  seo: {
    meta_title: string | null;
    meta_description: string | null;
    og_image_url: string | null;
  };
}

interface SiteConfig {
  site_name: string;
  site_tagline: string | null;
  logo_url: string | null;
  primary_color: string;
  posts_per_page: number;
  enable_comments: boolean;
}

// ─── API Functions ─────────────────────────────────────────────────────────────

async function apiFetch<T>(endpoint: string): Promise<T> {
  const res = await fetch(`${API_BASE}/api/v1${endpoint}`, {
    headers: {
      'X-API-Token': API_TOKEN!,
      Accept: 'application/json',
    },
    // cache: 'force-cache' for server components (Next.js specific)
    // For client components or non-Next.js, remove this line
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }

  return res.json();
}

export async function getBlogPosts(page = 1, perPage = 10) {
  const data = await apiFetch<{ success: boolean; data: Post[]; meta: any }>(
    `/posts?page=${page}&per_page=${perPage}`
  );
  return data;
}

export async function getBlogPost(slug: string) {
  const data = await apiFetch<{ success: boolean; data: Post }>(
    `/posts/${slug}`
  );
  return data;
}

export async function getBlogCategories() {
  const data = await apiFetch<{ success: boolean; data: any[] }>('/categories');
  return data;
}

export async function getSiteConfig() {
  const data = await apiFetch<{ success: boolean; data: SiteConfig }>(
    '/site-config'
  );
  return data;
}

// ─── Server Component Example ──────────────────────────────────────────────────

/*
// app/blog/page.tsx
import { getBlogPosts, getSiteConfig } from '@/lib/blog-client';

export default async function BlogPage() {
  const [{ data: posts }, { data: config }] = await Promise.all([
    getBlogPosts(1, 10),
    getSiteConfig(),
  ]);

  return (
    <main>
      <h1>{config.site_name}</h1>
      <p>{config.site_tagline}</p>
      
      <div className="posts-grid">
        {posts.map((post) => (
          <article key={post.id}>
            {post.featured_image_url && (
              <img src={post.featured_image_url} alt={post.title} />
            )}
            <h2>
              <a href={`/blog/${post.slug}`}>{post.title}</a>
            </h2>
            <p>{post.excerpt}</p>
            <div className="meta">
              <span>By {post.author.name}</span>
              <span>{post.reading_time_mins} min read</span>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
*/

// ─── Client Component Example ──────────────────────────────────────────────────

/*
// components/BlogList.tsx
'use client';

import { useState, useEffect } from 'react';

export default function BlogList() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/posts`, {
      headers: {
        'X-API-Token': process.env.NEXT_PUBLIC_API_TOKEN!,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        setPosts(data.data);
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="blog-grid">
      {posts.map((post: Post) => (
        <div key={post.id} className="post-card">
          <h3>{post.title}</h3>
          <p>{post.excerpt}</p>
          <a href={`/blog/${post.slug}`}>Read more</a>
        </div>
      ))}
    </div>
  );
}
*/

export type { Post, SiteConfig };
