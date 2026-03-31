import Link from 'next/link';
import { getCategories, getSiteConfig } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function CategoriesPage() {
  const [categories, config] = await Promise.all([
    getCategories()
      .then(r => r.data)
      .catch(() => []),
    getSiteConfig()
      .then(r => r.data)
      .catch(() => ({ site_name: 'Blog' })),
  ]);

  const colors = [
    '#2563eb',
    '#7c3aed',
    '#059669',
    '#d97706',
    '#dc2626',
    '#0891b2',
    '#c026d3',
    '#4f46e5',
  ];
  const getColor = (index: number) => colors[index % colors.length];

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
              Explore Topics
            </span>
            <h1 className="hero-section__title">
              Browse by <span>Category</span>
            </h1>
            <p className="hero-section__description">
              Explore our content organized by topics. Find exactly what
              you&apos;re looking for.
            </p>
          </div>
        </div>
      </section>

      {categories.length === 0 ? (
        <div className="blog-empty">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M9.172 14.828L12 12m0 0l2.828-2.828M12 12l2.828 2.828M12 12L9.172 9.172M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
          </svg>
          <h3>No categories found</h3>
          <p>Check back later for content</p>
        </div>
      ) : (
        <div className="categories-grid">
          {categories.map((category, index) => (
            <Link
              key={category.id}
              href={`/category/${category.slug}`}
              className="category-card"
              style={{ borderLeftColor: getColor(index) }}
            >
              <h3>{category.name}</h3>
              <p>{category.description || 'Explore posts in this category'}</p>
              <span>{category.post_count} posts</span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
