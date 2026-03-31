import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCategories, getPosts, getSiteConfig, getTags } from '@/lib/api';
import PostCard from '@/components/PostCard';
import Pagination from '@/components/Pagination';

interface Props {
  params: { slug: string };
  searchParams: { page?: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { data: categories } = await getCategories();
  const category = categories.find(item => item.slug === params.slug);
  if (!category) return { title: 'Category' };
  return {
    title: `${category.name} - Category`,
    description: category.description ?? `Posts in ${category.name}`,
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const [categories, config] = await Promise.all([
    getCategories()
      .then(r => r.data)
      .catch(() => []),
    getSiteConfig()
      .then(r => r.data)
      .catch(() => ({ site_name: 'Blog' })),
  ]);

  const category = categories.find(item => item.slug === params.slug);
  if (!category) notFound();

  const page = parseInt(searchParams.page ?? '1', 10) || 1;
  const postsRes = await getPosts({
    category: params.slug,
    page,
    per_page: 12,
  });

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
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
              Category
            </span>
            <h1 className="hero-section__title">{category.name}</h1>
            <p className="hero-section__description">
              {category.description ||
                `${category.post_count} posts in this category`}
            </p>
          </div>
        </div>
      </section>

      <div className="content-grid">
        <div className="posts-section">
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
              <h3>No posts in this category</h3>
              <p>Check back later or explore other categories</p>
            </div>
          ) : (
            <div className="posts-grid">
              {postsRes.data.map(post => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          )}

          <Pagination
            meta={postsRes.meta}
            searchParams={{ category: params.slug }}
          />
        </div>

        <aside className="sidebar">
          <div className="blog-widget">
            <h3 className="blog-widget__title">All Categories</h3>
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
        </aside>
      </div>
    </>
  );
}
