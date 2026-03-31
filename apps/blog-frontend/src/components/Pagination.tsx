import Link from 'next/link';
import type { PaginationMeta } from '@/lib/api';

interface Props {
  meta: PaginationMeta;
  searchParams?: Record<string, string | undefined>;
}

function buildUrl(
  page: number,
  searchParams: Record<string, string | undefined> = {}
) {
  const params = new URLSearchParams();
  Object.entries(searchParams).forEach(([key, value]) => {
    if (value && key !== 'page') {
      params.set(key, value);
    }
  });
  if (page > 1) {
    params.set('page', String(page));
  }
  const queryString = params.toString();
  return queryString ? `?${queryString}` : '/';
}

export default function Pagination({ meta, searchParams = {} }: Props) {
  if (meta.total_pages <= 1) {
    return null;
  }

  const pages = Array.from(
    { length: meta.total_pages },
    (_, index) => index + 1
  ).filter(
    page =>
      Math.abs(page - meta.page) <= 2 || page === 1 || page === meta.total_pages
  );

  return (
    <nav aria-label="Pagination" className="blog-pagination">
      {meta.has_prev ? (
        <Link href={buildUrl(meta.page - 1, searchParams)}>Previous</Link>
      ) : null}

      {pages
        .reduce<(number | 'ellipsis')[]>(
          (accumulator, page, index, allPages) => {
            if (index > 0 && allPages[index - 1] !== page - 1) {
              accumulator.push('ellipsis');
            }
            accumulator.push(page);
            return accumulator;
          },
          []
        )
        .map((item, index) =>
          item === 'ellipsis' ? (
            <span key={`ellipsis-${index}`}>...</span>
          ) : (
            <Link
              key={item}
              href={buildUrl(item, searchParams)}
              className={item === meta.page ? 'current' : ''}
              aria-current={item === meta.page ? 'page' : undefined}
            >
              {item}
            </Link>
          )
        )}

      {meta.has_next ? (
        <Link href={buildUrl(meta.page + 1, searchParams)}>Next</Link>
      ) : null}
    </nav>
  );
}
