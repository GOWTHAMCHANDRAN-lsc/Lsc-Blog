const { v4: uuidv4 } = require('uuid');
const db = require('../../config/database');
const cache = require('../../config/redis');
const logger = require('../../config/logger');
const { slugify } = require('../../utils/slugify');
const { AppError } = require('../../utils/errors');
const webhookService = require('../../services/webhook.service');
const searchService = require('../../services/search.service');
const { schedulePost: enqueueScheduledPost } = require('../../jobs/queues');
const {
  sanitizeRichText,
  sanitizePlainText,
  sanitizeExternalUrl,
} = require('../../utils/sanitizeHtml');

class PostsService {
  // ─────────────────────────────────────────────────────────────────────────────
  // PUBLIC API METHODS (blog frontend consumption)
  // ─────────────────────────────────────────────────────────────────────────────

  async getPublishedPosts(tenantId, options = {}) {
    const {
      page = 1,
      perPage = 10,
      categorySlug,
      tagSlug,
      searchQuery,
      sort = 'published_at',
      order = 'DESC',
    } = options;

    const cacheKey = `posts:${tenantId}:${JSON.stringify(options)}`;
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    if (searchQuery) {
      return this._searchPosts(tenantId, searchQuery, { page, perPage });
    }

    const offset = (page - 1) * perPage;
    const allowedSorts = {
      published_at: 'ps.published_at',
      title: 'p.title',
      updated_at: 'p.updated_at',
    };
    const safeSort = allowedSorts[sort] || 'ps.published_at';
    const safeOrder = order === 'ASC' ? 'ASC' : 'DESC';

    let joins = '';
    const joinParams = [];
    const whereParams = [tenantId];

    if (categorySlug) {
      joins += ` JOIN post_categories pc ON pc.post_id = p.id
                  JOIN categories cat ON cat.id = pc.category_id AND cat.slug = ?`;
      joinParams.push(categorySlug);
    }
    if (tagSlug) {
      joins += ` JOIN post_tags ptg ON ptg.post_id = p.id
                  JOIN tags tg ON tg.id = ptg.tag_id AND tg.slug = ?`;
      joinParams.push(tagSlug);
    }

    const baseWhere = `
      WHERE p.tenant_id = ?
        AND ps.status = 'published'
        AND ps.id = (
          SELECT id FROM post_status
          WHERE post_id = p.id ORDER BY id DESC LIMIT 1
        )`;

    const [posts, countResult] = await Promise.all([
      db.query(
        `
        SELECT p.id, p.slug, p.title, p.excerpt, p.featured_image_url,
               p.reading_time_mins, p.word_count, ps.published_at, ps.status,
               u.id AS author_id, u.name AS author_name, u.avatar_url AS author_avatar,
               sm.meta_title, sm.meta_description, sm.og_image_url
        FROM posts p
        JOIN post_status ps ON ps.post_id = p.id
        JOIN users u ON u.id = p.author_id
        LEFT JOIN seo_meta sm ON sm.post_id = p.id
        ${joins}
        ${baseWhere}
        ORDER BY ${safeSort} ${safeOrder}
        LIMIT ? OFFSET ?
      `,
        [...joinParams, ...whereParams, perPage, offset]
      ),
      db.query(
        `
        SELECT COUNT(*) AS total FROM posts p
        JOIN post_status ps ON ps.post_id = p.id
        ${joins} ${baseWhere}
      `,
        [...joinParams, ...whereParams]
      ),
    ]);

    const postIds = posts.map(p => p.id);
    const enriched =
      postIds.length > 0 ? await this._enrichPosts(posts) : posts;

    const total = countResult[0]?.total || 0;
    const result = {
      data: enriched,
      meta: {
        page,
        per_page: perPage,
        total,
        total_pages: Math.ceil(total / perPage),
        has_prev: page > 1,
        has_next: page < Math.ceil(total / perPage),
      },
    };

    await cache.setex(cacheKey, 300, result);
    return result;
  }

  async getPublishedPostBySlug(tenantId, slug) {
    const cacheKey = `post:${tenantId}:${slug}`;
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    const post = await db.queryOne(
      `
      SELECT p.*, ps.published_at, ps.status,
             u.id AS author_id, u.name AS author_name,
             u.avatar_url AS author_avatar, u.bio AS author_bio,
             sm.meta_title, sm.meta_description, sm.og_title, sm.og_description,
             sm.og_image_url, sm.canonical_url, sm.twitter_card,
             sm.schema_markup, sm.robots
      FROM posts p
      JOIN post_status ps ON ps.post_id = p.id
        AND ps.status = 'published'
        AND ps.id = (
          SELECT id FROM post_status WHERE post_id = p.id ORDER BY id DESC LIMIT 1
        )
      JOIN users u ON u.id = p.author_id
      LEFT JOIN seo_meta sm ON sm.post_id = p.id
      WHERE p.tenant_id = ? AND p.slug = ?
    `,
      [tenantId, slug]
    );

    if (!post) return null;

    const [enriched] = await this._enrichPosts([post]);
    await cache.setex(cacheKey, 3600, enriched);
    return enriched;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ADMIN METHODS
  // ─────────────────────────────────────────────────────────────────────────────

  async createPost(tenantId, authorId, data) {
    const {
      title,
      content,
      excerpt = '',
      contentFormat = 'html',
      categoryIds = [],
      tagIds = [],
      featuredImageUrl = null,
    } = data;

    const safeContent = sanitizeRichText(content);
    const safeExcerpt = sanitizePlainText(excerpt, 320);
    const safeFeaturedImageUrl = sanitizeExternalUrl(featuredImageUrl);
    if (!safeContent) {
      throw new AppError('Post content is required', 422, 'INVALID_CONTENT');
    }
    const slug = await this._generateUniqueSlug(tenantId, title);
    const plainText = safeContent.replace(/<[^>]*>/g, ' ');
    const wordCount = plainText.trim().split(/\s+/).filter(Boolean).length;
    const readingTime = Math.ceil(wordCount / 200);
    const postId = uuidv4();

    await db.transaction(async trx => {
      await trx.query(
        `
        INSERT INTO posts
          (id, tenant_id, author_id, title, slug, excerpt, content,
           content_format, word_count, reading_time_mins, featured_image_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          postId,
          tenantId,
          authorId,
          title,
          slug,
          safeExcerpt,
          safeContent,
          contentFormat,
          wordCount,
          readingTime,
          safeFeaturedImageUrl,
        ]
      );

      await trx.query(
        `INSERT INTO post_status (id, post_id, status, changed_by) VALUES (UUID(), ?, 'draft', ?)`,
        [postId, authorId]
      );

      if (categoryIds.length) {
        const vals = categoryIds.map((cid, i) => [
          postId,
          cid,
          i === 0 ? 1 : 0,
        ]);
        await trx.query(
          `INSERT INTO post_categories (post_id, category_id, is_primary) VALUES ?`,
          [vals]
        );
      }
      if (tagIds.length) {
        const vals = tagIds.map(tid => [postId, tid]);
        await trx.query(`INSERT INTO post_tags (post_id, tag_id) VALUES ?`, [
          vals,
        ]);
      }

      await trx.query(
        `INSERT INTO seo_meta (id, post_id, tenant_id, meta_title, meta_description)
         VALUES (UUID(), ?, ?, ?, ?)`,
        [
          postId,
          tenantId,
          title.substring(0, 70),
          safeExcerpt.substring(0, 160),
        ]
      );
    });

    await searchService.indexPost(postId, {
      tenantId,
      title,
      content: plainText,
      slug,
      excerpt: safeExcerpt,
    });
    return this.getPostById(postId, tenantId);
  }

  async updatePost(postId, tenantId, userId, data) {
    const post = await this._requirePost(postId, tenantId);

    const { title, content, excerpt, featuredImageUrl, categoryIds, tagIds } =
      data;
    const safeContent =
      content !== undefined ? sanitizeRichText(content) : post.content;
    const safeExcerpt =
      excerpt !== undefined ? sanitizePlainText(excerpt, 320) : post.excerpt;
    const safeFeaturedImageUrl =
      featuredImageUrl !== undefined
        ? sanitizeExternalUrl(featuredImageUrl)
        : post.featured_image_url;
    if (!safeContent) {
      throw new AppError('Post content is required', 422, 'INVALID_CONTENT');
    }
    const plainText = safeContent.replace(/<[^>]*>/g, ' ');
    const wordCount = plainText.trim().split(/\s+/).filter(Boolean).length;
    const slug =
      title && title !== post.title
        ? await this._generateUniqueSlug(tenantId, title, postId)
        : post.slug;
    const oldSlug = post.slug;

    await db.transaction(async trx => {
      // Save revision before update
      await trx.query(
        `INSERT INTO post_revisions (id, post_id, revised_by, title, content)
         VALUES (UUID(), ?, ?, ?, ?)`,
        [postId, userId, post.title, post.content]
      );

      await trx.query(
        `
        UPDATE posts SET
          title = COALESCE(?, title), slug = ?, content = COALESCE(?, content),
          excerpt = COALESCE(?, excerpt), featured_image_url = COALESCE(?, featured_image_url),
          word_count = ?, reading_time_mins = ?
        WHERE id = ?`,
        [
          title,
          slug,
          safeContent,
          safeExcerpt,
          safeFeaturedImageUrl,
          wordCount,
          Math.ceil(wordCount / 200),
          postId,
        ]
      );

      if (categoryIds) {
        await trx.query(`DELETE FROM post_categories WHERE post_id = ?`, [
          postId,
        ]);
        if (categoryIds.length) {
          const vals = categoryIds.map((cid, i) => [
            postId,
            cid,
            i === 0 ? 1 : 0,
          ]);
          await trx.query(
            `INSERT INTO post_categories (post_id, category_id, is_primary) VALUES ?`,
            [vals]
          );
        }
      }
      if (tagIds) {
        await trx.query(`DELETE FROM post_tags WHERE post_id = ?`, [postId]);
        if (tagIds.length) {
          const vals = tagIds.map(tid => [postId, tid]);
          await trx.query(`INSERT INTO post_tags (post_id, tag_id) VALUES ?`, [
            vals,
          ]);
        }
      }
    });

    await cache.invalidatePattern(`posts:${tenantId}:*`);
    await cache.del(`post:${tenantId}:${oldSlug}`);
    if (oldSlug !== slug) {
      await cache.del(`post:${tenantId}:${slug}`);
    }
    await webhookService.triggerRevalidation(
      tenantId,
      postId,
      slug,
      'post.updated'
    );
    return this.getPostById(postId, tenantId);
  }

  async submitForApproval(postId, tenantId, userId) {
    const post = await this._requirePost(postId, tenantId);
    await this._requireStatus(postId, ['draft', 'rejected']);
    await db.query(
      `INSERT INTO post_status (id, post_id, status, changed_by) VALUES (UUID(), ?, 'pending_approval', ?)`,
      [postId, userId]
    );
    await cache.invalidatePattern(`posts:${tenantId}:*`);
    await cache.del(`post:${tenantId}:${post.slug}`);
    return { success: true };
  }

  async approvePost(postId, tenantId, userId, note = '') {
    const post = await this._requirePost(postId, tenantId);
    await this._requireStatus(postId, ['pending_approval']);
    await db.query(
      `INSERT INTO post_status (id, post_id, status, changed_by, note) VALUES (UUID(), ?, 'approved', ?, ?)`,
      [postId, userId, note]
    );
    await cache.invalidatePattern(`posts:${tenantId}:*`);
    await cache.del(`post:${tenantId}:${post.slug}`);

    await this._syncPostToTenantBlog(tenantId, post);

    return { success: true };
  }

  async _syncPostToTenantBlog(tenantId, post) {
    const tenant = await db.queryOne(
      `SELECT blog_url, blog_api_key, allowed_origins FROM tenants WHERE id = ?`,
      [tenantId]
    );

    if (!tenant?.blog_url || !tenant?.blog_api_key) {
      logger.info(
        `Tenant ${tenantId} has no blog_url or blog_api_key configured, skipping sync`
      );
      return;
    }

    const platformUrl = process.env.PLATFORM_API_URL || 'http://localhost:3001';

    const convertToAbsoluteUrl = content => {
      if (!content) return content;
      return content.replace(
        /src=["'](\/uploads\/[^"']+)["']/g,
        (match, path) => `src="${platformUrl}${path}"`
      );
    };

    const content = convertToAbsoluteUrl(post.content);
    const featuredImageUrl = post.featured_image_url?.startsWith('/uploads/')
      ? `${platformUrl}${post.featured_image_url}`
      : post.featured_image_url;

    const payload = {
      id: post.id,
      title: post.title,
      slug: post.slug,
      content: content,
      excerpt: post.excerpt,
      featured_image_url: featuredImageUrl,
      status: 'published',
      published_at: post.published_at || new Date().toISOString(),
      author: post.author,
      categories: post.categories,
      tags: post.tags,
      seo: post.seo,
      synced_at: new Date().toISOString(),
    };

    const signature = crypto
      .createHmac('sha256', tenant.blog_api_key)
      .update(JSON.stringify(payload))
      .digest('hex');

    let origins = ['http://localhost:3002', 'http://localhost:3000'];
    if (tenant.allowed_origins) {
      try {
        origins = JSON.parse(tenant.allowed_origins);
      } catch {
        // Ignore parse errors, use default origins
      }
    }

    const results = await Promise.allSettled(
      origins.map(async origin => {
        const url = `${origin.replace(/\/$/, '')}/api/sync-post`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        try {
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Api-Key': tenant.blog_api_key,
              'X-Post-Signature': signature,
              'X-Tenant-ID': tenantId,
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });

          if (!response.ok) {
            const errorText = await response.text();
            logger.warn(
              `Failed to sync post to ${url}: ${response.status} - ${errorText}`
            );
            return { success: false, url, status: response.status };
          }

          logger.info(`Successfully synced post ${post.id} to ${url}`);
          return { success: true, url };
        } catch (err) {
          logger.warn(`Error syncing post to ${url}: ${err.message}`);
          return { success: false, url, error: err.message };
        } finally {
          clearTimeout(timeout);
        }
      })
    );

    const failed = results.filter(
      r => r.status === 'rejected' || r.value?.success === false
    );
    if (failed.length > 0) {
      logger.warn(
        `Post sync partially failed for post ${post.id}: ${failed.length} destinations failed`
      );
    }
  }

  async rejectPost(postId, tenantId, userId, reason) {
    if (!reason) throw new AppError('Rejection reason is required', 400);
    const post = await this._requirePost(postId, tenantId);
    await this._requireStatus(postId, ['pending_approval']);
    await db.query(
      `INSERT INTO post_status (id, post_id, status, changed_by, note) VALUES (UUID(), ?, 'rejected', ?, ?)`,
      [postId, userId, reason]
    );
    await cache.invalidatePattern(`posts:${tenantId}:*`);
    await cache.del(`post:${tenantId}:${post.slug}`);
    return { success: true };
  }

  async publishPost(postId, tenantId, userId) {
    const post = await this._requirePost(postId, tenantId);
    await this._requireStatus(postId, ['approved', 'scheduled', 'published']);

    // If already published, return success (idempotent)
    const currentStatus = await db.queryOne(
      `SELECT status FROM post_status WHERE post_id = ? ORDER BY id DESC LIMIT 1`,
      [postId]
    );
    if (currentStatus?.status === 'published') {
      return { success: true, message: 'Post already published' };
    }

    await db.query(
      `INSERT INTO post_status (id, post_id, status, changed_by, published_at)
       VALUES (UUID(), ?, 'published', ?, NOW())`,
      [postId, userId]
    );

    await cache.invalidatePattern(`posts:${tenantId}:*`);
    await cache.del(`post:${tenantId}:${post.slug}`);

    // Trigger webhook for ISR revalidation
    await webhookService.triggerRevalidation(
      tenantId,
      postId,
      post.slug,
      'post.published'
    );

    // Sync post to tenant's external blog
    await this._syncPostToTenantBlog(tenantId, post);

    return {
      success: true,
      message: 'Post published and synced to external blog',
    };
  }

  async schedulePost(postId, tenantId, userId, scheduledAt) {
    const post = await this._requirePost(postId, tenantId);
    await this._requireStatus(postId, ['approved', 'scheduled']);

    const scheduleDate = new Date(scheduledAt);
    if (
      Number.isNaN(scheduleDate.getTime()) ||
      scheduleDate.getTime() <= Date.now()
    ) {
      throw new AppError(
        'Scheduled time must be in the future',
        422,
        'INVALID_SCHEDULE_TIME'
      );
    }

    await enqueueScheduledPost(
      postId,
      tenantId,
      userId,
      scheduleDate.toISOString()
    );
    await db.query(
      `INSERT INTO post_status (id, post_id, status, changed_by, scheduled_at)
       VALUES (UUID(), ?, 'scheduled', ?, ?)`,
      [postId, userId, scheduleDate]
    );
    await cache.invalidatePattern(`posts:${tenantId}:*`);
    await cache.del(`post:${tenantId}:${post.slug}`);

    return {
      success: true,
      message: 'Post scheduled',
      scheduled_at: scheduleDate.toISOString(),
    };
  }

  async unpublishPost(postId, tenantId, userId) {
    const post = await this._requirePost(postId, tenantId);
    await this._requireStatus(postId, ['published']);
    await db.query(
      `INSERT INTO post_status (id, post_id, status, changed_by) VALUES (UUID(), ?, 'unpublished', ?)`,
      [postId, userId]
    );
    await cache.invalidatePattern(`posts:${tenantId}:*`);
    await cache.del(`post:${tenantId}:${post.slug}`);
    await webhookService.triggerRevalidation(
      tenantId,
      postId,
      post.slug,
      'post.unpublished'
    );
    return { success: true };
  }

  async getPostById(postId, tenantId) {
    const post = await db.queryOne(
      `
      SELECT p.*, 
             ps.status, ps.published_at, ps.scheduled_at,
             u.name AS author_name, u.avatar_url AS author_avatar,
             sm.meta_title, sm.meta_description, sm.focus_keyword,
             sm.seo_score, sm.readability_score, sm.keyword_density,
             sm.og_title, sm.og_description, sm.og_image_url,
             sm.canonical_url, sm.schema_markup, sm.robots
      FROM posts p
      LEFT JOIN post_status ps ON ps.post_id = p.id
        AND ps.id = (SELECT id FROM post_status WHERE post_id = p.id ORDER BY id DESC LIMIT 1)
      LEFT JOIN users u ON u.id = p.author_id
      LEFT JOIN seo_meta sm ON sm.post_id = p.id
      WHERE p.id = ? AND p.tenant_id = ?`,
      [postId, tenantId]
    );
    if (!post) return null;
    const [enriched] = await this._enrichPosts([post]);
    return enriched;
  }

  async listAdminPosts(tenantId, options = {}) {
    const { page = 1, perPage = 20, status, authorId, search } = options;
    const offset = (page - 1) * perPage;
    const params = [tenantId];
    let where = 'WHERE p.tenant_id = ?';

    if (status) {
      where += ' AND ps.status = ?';
      params.push(status);
    }
    if (authorId) {
      where += ' AND p.author_id = ?';
      params.push(authorId);
    }
    if (search) {
      where += ' AND MATCH(p.title, p.content) AGAINST(? IN BOOLEAN MODE)';
      params.push(`${search}*`);
    }

    const [posts, [{ total }]] = await Promise.all([
      db.query(
        `
        SELECT p.id, p.title, p.slug, p.excerpt, p.word_count, p.created_at, p.updated_at,
               ps.status, ps.published_at, ps.scheduled_at,
               u.name AS author_name
        FROM posts p
        JOIN post_status ps ON ps.post_id = p.id
          AND ps.id = (SELECT id FROM post_status WHERE post_id = p.id ORDER BY id DESC LIMIT 1)
        JOIN users u ON u.id = p.author_id
        ${where}
        ORDER BY p.updated_at DESC LIMIT ? OFFSET ?`,
        [...params, perPage, offset]
      ),
      db.query(
        `SELECT COUNT(*) AS total FROM posts p
        JOIN post_status ps ON ps.post_id = p.id
          AND ps.id = (SELECT id FROM post_status WHERE post_id = p.id ORDER BY id DESC LIMIT 1)
        ${where}`,
        params
      ),
    ]);

    return {
      data: posts,
      meta: {
        page,
        per_page: perPage,
        total,
        total_pages: Math.ceil(total / perPage),
        has_prev: page > 1,
        has_next: page < Math.ceil(total / perPage),
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────────────────────────────────────

  async _enrichPosts(posts) {
    if (!posts.length) return posts;
    const postIds = posts.map(p => p.id);
    const placeholders = postIds.map(() => '?').join(',');

    const [categories, tags] = await Promise.all([
      db.query(
        `
        SELECT pc.post_id, c.id, c.name, c.slug, pc.is_primary
        FROM post_categories pc JOIN categories c ON c.id = pc.category_id
        WHERE pc.post_id IN (${placeholders})`,
        postIds
      ),
      db.query(
        `
        SELECT pt.post_id, t.id, t.name, t.slug
        FROM post_tags pt JOIN tags t ON t.id = pt.tag_id
        WHERE pt.post_id IN (${placeholders})`,
        postIds
      ),
    ]);

    const catMap = {},
      tagMap = {};
    categories.forEach(c =>
      (catMap[c.post_id] = catMap[c.post_id] || []).push(c)
    );
    tags.forEach(t => (tagMap[t.post_id] = tagMap[t.post_id] || []).push(t));

    return posts.map(p => ({
      ...p,
      author: {
        id: p.author_id,
        name: p.author_name,
        avatar_url: p.author_avatar,
        bio: p.author_bio,
      },
      categories: catMap[p.id] || [],
      tags: tagMap[p.id] || [],
      seo: {
        meta_title: p.meta_title,
        meta_description: p.meta_description,
        og_title: p.og_title,
        og_description: p.og_description,
        og_image_url: p.og_image_url,
        canonical_url: p.canonical_url,
        twitter_card: p.twitter_card,
        schema_markup: p.schema_markup,
        robots: p.robots,
        seo_score: p.seo_score,
        readability_score: p.readability_score,
        keyword_density: p.keyword_density,
      },
    }));
  }

  async _generateUniqueSlug(tenantId, title, excludeId = null) {
    let base = slugify(title);
    let slug = base;
    let i = 1;
    while (true) {
      const existing = await db.queryOne(
        `SELECT id FROM posts WHERE tenant_id = ? AND slug = ?${excludeId ? ' AND id != ?' : ''}`,
        excludeId ? [tenantId, slug, excludeId] : [tenantId, slug]
      );
      if (!existing) return slug;
      slug = `${base}-${i++}`;
    }
  }

  async _requirePost(postId, tenantId) {
    const post = await db.queryOne(
      'SELECT * FROM posts WHERE id = ? AND tenant_id = ?',
      [postId, tenantId]
    );
    if (!post) throw new AppError('Post not found', 404, 'POST_NOT_FOUND');
    return post;
  }

  async _requireStatus(postId, allowedStatuses) {
    const status = await db.queryOne(
      `SELECT status FROM post_status WHERE post_id = ? ORDER BY id DESC LIMIT 1`,
      [postId]
    );
    if (!status || !allowedStatuses.includes(status.status)) {
      throw new AppError(
        `Cannot perform this action. Current status: ${status?.status}`,
        422,
        'INVALID_STATUS_TRANSITION'
      );
    }
    return status.status;
  }

  async _searchPosts(tenantId, query, { page, perPage }) {
    const offset = (page - 1) * perPage;
    const [posts, [{ total }]] = await Promise.all([
      db.query(
        `
        SELECT p.id, p.slug, p.title, p.excerpt, p.featured_image_url,
               p.reading_time_mins, p.word_count, ps.published_at,
               u.id AS author_id, u.name AS author_name, u.avatar_url AS author_avatar,
               MATCH(p.title, p.content, p.excerpt) AGAINST(? IN BOOLEAN MODE) AS relevance
        FROM posts p
        JOIN post_status ps ON ps.post_id = p.id AND ps.status = 'published'
          AND ps.id = (SELECT id FROM post_status WHERE post_id = p.id ORDER BY id DESC LIMIT 1)
        JOIN users u ON u.id = p.author_id
        WHERE p.tenant_id = ?
          AND MATCH(p.title, p.content, p.excerpt) AGAINST(? IN BOOLEAN MODE)
        ORDER BY relevance DESC
        LIMIT ? OFFSET ?`,
        [query, tenantId, query, perPage, offset]
      ),
      db.query(
        `
        SELECT COUNT(*) AS total
        FROM posts p
        JOIN post_status ps ON ps.post_id = p.id AND ps.status = 'published'
          AND ps.id = (SELECT id FROM post_status WHERE post_id = p.id ORDER BY id DESC LIMIT 1)
        WHERE p.tenant_id = ?
          AND MATCH(p.title, p.content, p.excerpt) AGAINST(? IN BOOLEAN MODE)`,
        [tenantId, query]
      ),
    ]);
    const enriched = await this._enrichPosts(posts);
    const totalPages = Math.ceil(total / perPage) || 1;
    return {
      data: enriched,
      meta: {
        page,
        per_page: perPage,
        total,
        total_pages: totalPages,
        has_prev: page > 1,
        has_next: page < totalPages,
      },
    };
  }
}

module.exports = new PostsService();
