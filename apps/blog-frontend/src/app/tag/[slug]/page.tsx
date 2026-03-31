import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPosts, getTags, getSiteConfig } from '@/lib/api';
import PostCard from '@/components/PostCard';
import Pagination from '@/components/Pagination';

interface TagSummary {
  id: string;
  name: string;
  slug: string;
  post_count: number;
}

interface Props {
  params: { slug: string };
  searchParams: { page?: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { data: tags } = await getTags();
  const tag = (tags as TagSummary[]).find(item => item.slug === params.slug);
  if (!tag) return { title: 'Tag' };
  return {
    title: `#${tag.name}`,
    description: `Posts tagged with ${tag.name}`,
  };
}

export default async function TagPage({ params, searchParams }: Props) {
  const [tags, config] = await Promise.all([
    getTags()
      .then(r => r.data)
      .catch(() => []),
    getSiteConfig()
      .then(r => r.data)
      .catch(() => ({ site_name: 'Blog' })),
  ]);

  const tag = (tags as TagSummary[]).find(item => item.slug === params.slug);
  if (!tag) notFound();

  const page = parseInt(searchParams.page ?? '1', 10) || 1;
  const postsRes = await getPosts({ tag: params.slug, page, per_page: 12 });

  return (
    <>
      <section className="hero-section">
        <div
          className="hero-section__content"
          style={{ gridTemplateColumns: '1fr' }}
        >
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
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                <path d="M7 7h.01" />
              </svg>
              Tag
            </span>
            <h1 className="hero-section__title">#{tag.name}</h1>
            <p className="hero-section__description">
              {tag.post_count} posts tagged with this topic
            </p>
          </div>
        </div>
      </section>

      {postsRes.data.length === 0 ? (
        <div className="blog-empty">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M9.172 14.828L12 12m0 0l2.828-2.828M12 12l2.828 2.828M12 12L9.172 9.172M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
          </svg>
          <h3>No posts with this tag</h3>
          <p>Check back later</p>
        </div>
      ) : (
        <div className="posts-grid">
          {postsRes.data.map(post => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}

      <Pagination meta={postsRes.meta} searchParams={{ tag: params.slug }} />
    </>
  );
}
