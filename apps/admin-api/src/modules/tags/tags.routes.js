// ─── tags.routes.js ──────────────────────────────────────────────────────────
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../../config/database');
const cache = require('../../config/redis');
const { authenticate, requireRole } = require('../../middleware/auth');
const { resolveTenantFromJWT } = require('../../middleware/tenantResolver');
const { resolvePublicTenant } = require('../../middleware/publicTenant');
const { requireScopeIfToken } = require('../../middleware/apiToken');
const { slugify } = require('../../utils/slugify');

const tagsRouter = express.Router();

// Public
tagsRouter.get(
  '/',
  resolvePublicTenant,
  requireScopeIfToken('tags:read'),
  async (req, res, next) => {
    try {
      const cacheKey = `tags:${req.tenantId}`;
      let tags = await cache.get(cacheKey);
      if (!tags) {
        tags = await db.query(
          `
        SELECT t.id, t.name, t.slug, COUNT(DISTINCT ps.post_id) AS post_count
        FROM tags t
        LEFT JOIN post_tags pt ON pt.tag_id = t.id
        LEFT JOIN posts p ON p.id = pt.post_id AND p.tenant_id = t.tenant_id
        LEFT JOIN post_status ps ON ps.post_id = p.id
          AND ps.status = 'published'
          AND ps.id = (SELECT id FROM post_status WHERE post_id = p.id ORDER BY id DESC LIMIT 1)
        WHERE t.tenant_id = ? GROUP BY t.id ORDER BY post_count DESC, t.name`,
          [req.tenantId]
        );
        await cache.setex(cacheKey, 600, tags);
      }
      res.json({ success: true, data: tags });
    } catch (err) {
      next(err);
    }
  }
);

tagsRouter.get(
  '/:slug/posts',
  resolvePublicTenant,
  requireScopeIfToken('posts:read'),
  async (req, res, next) => {
    try {
      const postsService = require('../posts/posts.service');
      const result = await postsService.getPublishedPosts(req.tenantId, {
        tagSlug: req.params.slug,
        page: parseInt(req.query.page) || 1,
        perPage: parseInt(req.query.per_page) || 10,
      });
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }
);

// Admin - List all tags
tagsRouter.get(
  '/admin',
  authenticate,
  resolveTenantFromJWT,
  requireRole('viewer'),
  async (req, res, next) => {
    try {
      const tags = await db.query(
        `SELECT t.id, t.name, t.slug, COUNT(DISTINCT pt.post_id) AS post_count
         FROM tags t
         LEFT JOIN post_tags pt ON pt.tag_id = t.id
         WHERE t.tenant_id = ?
         GROUP BY t.id
         ORDER BY t.name`,
        [req.tenantId]
      );
      res.json({ success: true, data: tags });
    } catch (err) {
      next(err);
    }
  }
);

// Admin
tagsRouter.post(
  '/admin',
  authenticate,
  resolveTenantFromJWT,
  requireRole('author'),
  async (req, res, next) => {
    try {
      const { name } = req.body;
      const slug = slugify(name);
      const id = uuidv4();
      await db.query(
        `INSERT INTO tags (id, tenant_id, name, slug) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name)`,
        [id, req.tenantId, name, slug]
      );
      await cache.del(`tags:${req.tenantId}`);
      res.status(201).json({ success: true, data: { id, name, slug } });
    } catch (err) {
      next(err);
    }
  }
);

tagsRouter.delete(
  '/admin/:id',
  authenticate,
  resolveTenantFromJWT,
  requireRole('editor'),
  async (req, res, next) => {
    try {
      await db.query(`DELETE FROM tags WHERE id = ? AND tenant_id = ?`, [
        req.params.id,
        req.tenantId,
      ]);
      await cache.del(`tags:${req.tenantId}`);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = tagsRouter;
