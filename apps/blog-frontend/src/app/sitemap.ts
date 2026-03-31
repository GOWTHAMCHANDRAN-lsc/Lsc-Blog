import { MetadataRoute } from 'next';
import { getPosts, getCategories, getTags } from '@/lib/api';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? '';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [postsRes, catsRes, tagsRes] = await Promise.allSettled([
    getPosts({ per_page: 1000 }),
    getCategories(),
    getTags(),
  ]);

  const postUrls: MetadataRoute.Sitemap =
    postsRes.status === 'fulfilled'
      ? postsRes.value.data.map(post => ({
          url: `${SITE_URL}/${post.slug}`,
          lastModified: post.published_at,
          changeFrequency: 'weekly',
          priority: 0.8,
        }))
      : [];

  const categoryUrls: MetadataRoute.Sitemap =
    catsRes.status === 'fulfilled'
      ? catsRes.value.data.map(cat => ({
          url: `${SITE_URL}/category/${cat.slug}`,
          lastModified: new Date().toISOString(),
          changeFrequency: 'daily',
          priority: 0.6,
        }))
      : [];

  const tagUrls: MetadataRoute.Sitemap =
    tagsRes.status === 'fulfilled'
      ? tagsRes.value.data
          .filter(t => t.post_count > 0)
          .map(tag => ({
            url: `${SITE_URL}/tag/${tag.slug}`,
            lastModified: new Date().toISOString(),
            changeFrequency: 'weekly',
            priority: 0.5,
          }))
      : [];

  return [
    { url: SITE_URL, changeFrequency: 'daily', priority: 1.0 },
    { url: `${SITE_URL}/categories`, changeFrequency: 'weekly', priority: 0.7 },
    ...postUrls,
    ...categoryUrls,
    ...tagUrls,
  ];
}
