// packages/shared/src/types/post.ts
export interface Post {
  id: string;
  tenantId: string;
  authorId: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  contentFormat: 'html' | 'markdown' | 'json';
  featuredImageUrl: string | null;
  readingTimeMins: number;
  wordCount: number;
  createdAt: string;
  updatedAt: string;
}

export type PostStatus =
  | 'draft'
  | 'seo_review'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'published'
  | 'unpublished'
  | 'scheduled';

export interface PostStatusRecord {
  id: string;
  postId: string;
  status: PostStatus;
  changedBy: string;
  note: string | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  createdAt: string;
}

// packages/shared/src/types/tenant.ts
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  customDomain: string | null;
  plan: 'starter' | 'pro' | 'enterprise';
  status: 'active' | 'suspended' | 'trial';
  ownerId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

// packages/shared/src/types/user.ts
export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  systemRole: 'super_admin' | 'user';
  isActive: boolean;
  emailVerified: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export type TenantRole = 'admin' | 'editor' | 'author' | 'viewer';

export interface TenantUser {
  tenantId: string;
  userId: string;
  role: TenantRole;
  joinedAt: string | null;
}

// packages/shared/src/types/seo.ts
export interface SeoMeta {
  id: string;
  postId: string;
  tenantId: string;
  metaTitle: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImageUrl: string | null;
  twitterCard: 'summary' | 'summary_large_image';
  focusKeyword: string | null;
  keywordDensity: number | null;
  readabilityScore: number | null;
  seoScore: number | null;
  schemaMarkup: Record<string, unknown> | null;
  robots: string;
}

export interface SeoSuggestion {
  type: 'error' | 'warning' | 'success' | 'suggestion';
  field: string;
  message: string;
  fix?: string;
  relatedPosts?: { slug: string; title: string }[];
}

export interface SeoAnalysisResult {
  score: number;
  suggestions: SeoSuggestion[];
  details: {
    title: { score: number; length: number; suggestions: SeoSuggestion[] };
    meta: { score: number; length: number; suggestions: SeoSuggestion[] };
    keyword: {
      score: number;
      density: number;
      occurrences: number;
      suggestions: SeoSuggestion[];
    };
    readability: {
      score: number;
      fleschScore: number;
      suggestions: SeoSuggestion[];
    };
    headings: {
      score: number;
      headings: Record<string, string[]>;
      suggestions: SeoSuggestion[];
    };
    links: {
      score: number;
      count: number;
      links: string[];
      suggestions: SeoSuggestion[];
    };
    length: { score: number; wordCount: number; suggestions: SeoSuggestion[] };
  };
}

// packages/shared/src/constants/index.ts
export const POST_STATUSES = [
  'draft',
  'seo_review',
  'pending_approval',
  'approved',
  'rejected',
  'published',
  'unpublished',
  'scheduled',
] as const;

export const TENANT_PLANS = ['starter', 'pro', 'enterprise'] as const;

export const ROLE_HIERARCHY: Record<string, number> = {
  super_admin: 99,
  admin: 4,
  editor: 3,
  author: 2,
  viewer: 1,
};

export const DEFAULT_POSTS_PER_PAGE = 10;
export const MAX_META_TITLE_LENGTH = 60;
export const MAX_META_DESC_LENGTH = 160;
export const MIN_CONTENT_WORDS = 300;
export const IDEAL_KEYWORD_DENSITY_MIN = 0.5;
export const IDEAL_KEYWORD_DENSITY_MAX = 3.0;
