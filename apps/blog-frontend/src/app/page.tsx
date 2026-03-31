import Link from 'next/link';
import type { Metadata } from 'next';
import Image from 'next/image';
import {
  getCategories,
  getPosts,
  getSiteConfig,
  getTags,
  type SiteConfig,
} from '@/lib/api';
import Pagination from '@/components/Pagination';
import SubscribeForm from '@/components/SubscribeForm';

interface Props {
  searchParams: {
    page?: string;
    search?: string;
    category?: string;
    tag?: string;
  };
}

export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  try {
    const { data: config } = await getSiteConfig();
    return {
      title: searchParams.search
        ? `Search: ${searchParams.search}`
        : config.site_name,
    };
  } catch {
    return {};
  }
}

const FALLBACK_SITE_CONFIG: SiteConfig = {
  site_name: 'Blog',
  site_tagline: 'Insights and stories that matter',
  logo_url: null,
  favicon_url: null,
  primary_color: '#2563eb',
  font_family: 'Inter',
  posts_per_page: 12,
  enable_comments: true,
  comment_provider: null,
  comment_moderation: 'manual',
  comments_per_page: 10,
  analytics_id: null,
  rss_enabled: true,
  header_scripts: null,
  footer_scripts: null,
  social_links: null,
  locale: 'en',
  timezone: 'UTC',
};

const FALLBACK_POSTS = {
  data: [],
  meta: {
    total: 0,
    page: 1,
    per_page: 12,
    total_pages: 0,
    has_next: false,
    has_prev: false,
  },
};

export default async function HomePage({ searchParams }: Props) {
  const page = parseInt(searchParams.page ?? '1', 10) || 1;
  const activeSearch = searchParams.search?.trim() ?? '';

  const [postsRes, configRes, categoriesRes, tagsRes] = await Promise.all([
    getPosts({
      page,
      per_page: 12,
      search: searchParams.search,
      category: searchParams.category,
      tag: searchParams.tag,
    }).catch(() => FALLBACK_POSTS),
    getSiteConfig().catch(() => ({
      success: true,
      data: FALLBACK_SITE_CONFIG,
    })),
    getCategories().catch(() => ({ success: true, data: [] })),
    getTags().catch(() => ({ success: true, data: [] })),
  ]);

  const { data: posts, meta } = postsRes;
  const config = configRes.data;
  const categories = categoriesRes.data;
  const tags = tagsRes.data.slice(0, 15);
  const featuredPost = posts[0] ?? null;

  return (
    <>
      <section className="hero-section">
        {activeSearch ? (
          <div className="search-results">
            <h1>Search Results</h1>
            <p>
              Showing {posts.length} results for &quot;{activeSearch}&quot;
            </p>
            <Link href="/">Clear search</Link>
          </div>
        ) : (
          <div className="hero-section__content">
            <div className="hero-section__text">
              <span className="hero-section__eyebrow">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                Welcome to {config.site_name}
              </span>
              <h1 className="hero-section__title">{config.site_tagline}</h1>
              <p className="hero-section__description">
                Explore our latest articles, insights, and stories. Stay
                informed with curated content across various topics.
              </p>
              <div className="hero-section__stats">
                <div className="hero-stat">
                  <div className="hero-stat__number">{meta.total}</div>
                  <div className="hero-stat__label">Articles</div>
                </div>
                <div className="hero-stat">
                  <div className="hero-stat__number">{categories.length}</div>
                  <div className="hero-stat__label">Topics</div>
                </div>
                <div className="hero-stat">
                  <div className="hero-stat__number">{tags.length}+</div>
                  <div className="hero-stat__label">Tags</div>
                </div>
              </div>
            </div>
            <div className="hero-section__visual">
              {featuredPost && (
                <article className="hero-card">
                  <div className="hero-card__image">
                    {featuredPost.featured_image_url ? (
                      <Image
                        src={featuredPost.featured_image_url}
                        alt={featuredPost.title}
                        fill
                        style={{ objectFit: 'cover' }}
                        priority
                      />
                    ) : (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          background:
                            'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                        }}
                      />
                    )}
                    <span className="hero-card__badge">Featured</span>
                  </div>
                  <div className="hero-card__content">
                    <span className="hero-card__category">
                      {featuredPost.categories[0]?.name}
                    </span>
                    <h2 className="hero-card__title">
                      <Link href={`/${featuredPost.slug}`}>
                        {featuredPost.title}
                      </Link>
                    </h2>
                    <p className="hero-card__excerpt">{featuredPost.excerpt}</p>
                    <div className="hero-card__meta">
                      <span>
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                        {featuredPost.author.name}
                      </span>
                      <span>
                        {new Date(
                          featuredPost.published_at
                        ).toLocaleDateString()}
                      </span>
                      <span>{featuredPost.reading_time_mins} min read</span>
                    </div>
                  </div>
                </article>
              )}
            </div>
          </div>
        )}
      </section>

      <div className="content-grid">
        <div className="posts-section">
          {posts.length === 0 ? (
            <div className="blog-empty">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M9.172 14.828L12 12m0 0l2.828-2.828M12 12l2.828 2.828M12 12L9.172 9.172M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
              </svg>
              <h3>No posts found</h3>
              <p>Try a different search term or browse categories</p>
            </div>
          ) : (
            <div className="posts-grid">
              {(featuredPost ? posts.slice(1) : posts).map((post, index) => (
                <article
                  key={post.id}
                  className="blog-card animate-in"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <div className="blog-card__image">
                    {post.featured_image_url ? (
                      <Image
                        src={post.featured_image_url}
                        alt={post.title}
                        fill
                        style={{ objectFit: 'cover' }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          background: `linear-gradient(135deg, hsl(${(Number(post.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) * 50) % 360}, 70%, 60%) 0%, hsl(${((Number(post.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) * 50) % 360) + 30}, 60%, 50%) 100%)`,
                        }}
                      />
                    )}
                    {post.categories[0] && (
                      <span className="blog-card__badge">
                        {post.categories[0].name}
                      </span>
                    )}
                  </div>
                  <div className="blog-card__body">
                    <Link
                      href={`/category/${post.categories[0]?.slug}`}
                      className="blog-card__category"
                    >
                      {post.categories[0]?.name}
                    </Link>
                    <h2 className="blog-card__title">
                      <Link href={`/${post.slug}`}>{post.title}</Link>
                    </h2>
                    <p className="blog-card__excerpt">{post.excerpt}</p>
                    <div className="blog-card__footer">
                      <div className="blog-card__author">
                        <span className="blog-card__avatar">
                          {post.author.name.charAt(0)}
                        </span>
                        <div className="blog-card__author-info">
                          <div className="blog-card__author-name">
                            {post.author.name}
                          </div>
                          <div className="blog-card__date">
                            {new Date(post.published_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div className="blog-card__meta">
                        <span>
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 6v6l4 2" />
                          </svg>
                          {post.reading_time_mins}
                        </span>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          <Pagination meta={meta} searchParams={searchParams} />
        </div>

        <aside className="sidebar">
          <div className="newsletter-widget">
            <h3>Subscribe to newsletter</h3>
            <p>Get the latest posts delivered straight to your inbox</p>
            <SubscribeForm />
          </div>

          <div className="blog-widget">
            <h3 className="blog-widget__title">Categories</h3>
            <ul className="blog-categories">
              {categories.map(cat => (
                <li key={cat.id}>
                  <Link href={`/category/${cat.slug}`}>
                    {cat.name}
                    <span>{cat.post_count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="blog-widget">
            <h3 className="blog-widget__title">Popular Tags</h3>
            <div className="blog-tags">
              {tags.map(tag => (
                <Link
                  key={tag.id}
                  href={`/tag/${tag.slug}`}
                  className="blog-tag"
                >
                  #{tag.name}
                </Link>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
