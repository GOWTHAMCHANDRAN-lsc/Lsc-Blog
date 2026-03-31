import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import {
  getCommentsByPostSlug,
  getPostBySlug,
  getPosts,
  getSiteConfig,
  type SiteConfig,
} from '@/lib/api';
import CommentSection from '@/components/CommentSection';
import PostCard from '@/components/PostCard';
import { prepareArticleContent } from '@/lib/content';

interface Props {
  params: { slug: string };
}

const FALLBACK_SITE_CONFIG: SiteConfig = {
  site_name: 'Blog',
  site_tagline: null,
  logo_url: null,
  favicon_url: null,
  primary_color: '#2563eb',
  font_family: 'Inter',
  posts_per_page: 10,
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

export async function generateStaticParams() {
  try {
    const { data: posts } = await getPosts({ per_page: 100 });
    return posts.map(p => ({ slug: p.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const { data: post } = await getPostBySlug(params.slug);
    const { data: config } = await getSiteConfig();
    return {
      title: post.seo?.meta_title ?? post.title,
      description: post.seo?.meta_description ?? post.excerpt,
    };
  } catch {
    return {};
  }
}

export default async function PostPage({ params }: Props) {
  let post: Awaited<ReturnType<typeof getPostBySlug>>['data'] | null = null;
  let config: SiteConfig = FALLBACK_SITE_CONFIG;
  let relatedPosts: Awaited<ReturnType<typeof getPosts>>['data'] = [];
  let comments: Awaited<ReturnType<typeof getCommentsByPostSlug>>['data'] = [];

  try {
    const postResponse = await getPostBySlug(params.slug);
    const configResponse = await getSiteConfig().catch(() => ({
      success: true,
      data: FALLBACK_SITE_CONFIG,
    }));
    post = postResponse.data;
    config = configResponse.data;

    const relatedResponse = await getPosts({
      per_page: 3,
      category: post.categories[0]?.slug,
    }).catch(() => getPosts({ per_page: 3 }));
    relatedPosts = relatedResponse.data
      .filter(p => p.id !== post?.id)
      .slice(0, 3);

    if (config.enable_comments) {
      const commentsResponse = await getCommentsByPostSlug(post.slug, {
        per_page: config.comments_per_page,
      }).catch(() => ({ success: true, data: [] }));
      comments = commentsResponse.data ?? [];
    }
  } catch {
    notFound();
  }

  if (!post) {
    notFound();
  }

  const { html: safeArticleHtml } = prepareArticleContent(post.content);

  return (
    <>
      <div className="article-layout">
        <article className="article-main">
          <header className="article-header">
            <div className="article-breadcrumb">
              <Link href="/">Home</Link>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
              {post.categories[0] && (
                <>
                  <Link href={`/category/${post.categories[0].slug}`}>
                    {post.categories[0].name}
                  </Link>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </>
              )}
              <span>{post.title}</span>
            </div>

            <h1 className="article-title">{post.title}</h1>

            {post.excerpt && <p className="article-excerpt">{post.excerpt}</p>}

            <div className="article-meta">
              <div className="article-author">
                <span className="article-avatar">
                  {post.author.name.charAt(0)}
                </span>
                <div className="article-author-info">
                  <strong>{post.author.name}</strong>
                  <span>
                    {new Date(post.published_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              </div>
              <div className="article-stats">
                <span>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                  {post.reading_time_mins} min read
                </span>
                <span>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
                  </svg>
                  {post.word_count} words
                </span>
              </div>
            </div>
          </header>

          {post.featured_image_url && (
            <div className="article-cover">
              <Image
                src={post.featured_image_url}
                alt={post.title}
                width={1200}
                height={675}
                priority
                style={{ width: '100%', height: 'auto' }}
              />
            </div>
          )}

          <div
            className="article-body"
            dangerouslySetInnerHTML={{ __html: safeArticleHtml }}
          />

          {post.tags.length > 0 && (
            <div className="article-tags">
              {post.tags.map(tag => (
                <Link key={tag.id} href={`/tag/${tag.slug}`}>
                  #{tag.name}
                </Link>
              ))}
            </div>
          )}

          {post.author.bio && (
            <div className="blog-widget" style={{ marginTop: '2rem' }}>
              <h3 className="blog-widget__title">About the Author</h3>
              <p
                style={{
                  color: 'var(--color-text-secondary)',
                  lineHeight: 1.7,
                }}
              >
                {post.author.bio}
              </p>
            </div>
          )}

          {config.enable_comments && (
            <CommentSection
              postSlug={post.slug}
              moderationMode={config.comment_moderation}
              initialComments={comments}
            />
          )}
        </article>

        <aside className="sidebar">
          <div className="blog-widget">
            <h3 className="blog-widget__title">Categories</h3>
            <ul className="blog-categories">
              {post.categories.map(cat => (
                <li key={cat.id}>
                  <Link href={`/category/${cat.slug}`}>{cat.name}</Link>
                </li>
              ))}
            </ul>
          </div>

          {post.tags.length > 0 && (
            <div className="blog-widget">
              <h3 className="blog-widget__title">Tags</h3>
              <div className="blog-tags">
                {post.tags.map(tag => (
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
          )}
        </aside>
      </div>

      {relatedPosts.length > 0 && (
        <section className="related-posts">
          <h3>Related Posts</h3>
          <div className="posts-grid">
            {relatedPosts.map(p => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
