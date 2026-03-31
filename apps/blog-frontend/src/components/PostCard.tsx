import Link from 'next/link';
import Image from 'next/image';
import type { Post } from '@/lib/api';

export default function PostCard({ post }: { post: Post }) {
  return (
    <article className="blog-card">
      <Link href={`/${post.slug}`} className="blog-card__image">
        {post.featured_image_url ? (
          <Image
            src={post.featured_image_url}
            alt={post.title}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            style={{ objectFit: 'cover' }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              background: `linear-gradient(135deg, hsl(${Number(post.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % 360}, 70%, 60%) 0%, hsl(${(Number(post.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % 360) + 30}, 60%, 50%) 100%)`,
            }}
          />
        )}
        {post.categories[0] && (
          <span className="blog-card__badge">{post.categories[0].name}</span>
        )}
      </Link>
      <div className="blog-card__body">
        {post.categories[0] && (
          <Link
            href={`/category/${post.categories[0].slug}`}
            className="blog-card__category"
          >
            {post.categories[0].name}
          </Link>
        )}
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
              <div className="blog-card__author-name">{post.author.name}</div>
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
  );
}
