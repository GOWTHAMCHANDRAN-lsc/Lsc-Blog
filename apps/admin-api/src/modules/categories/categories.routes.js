const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const db = require('../../config/database');
const cache = require('../../config/redis');
const { authenticate, requireRole } = require('../../middleware/auth');
const { resolveTenantFromJWT } = require('../../middleware/tenantResolver');
const { resolvePublicTenant } = require('../../middleware/publicTenant');
const { requireScopeIfToken } = require('../../middleware/apiToken');
const { slugify } = require('../../utils/slugify');
const { AppError } = require('../../utils/errors');
const webhookService = require('../../services/webhook.service');

// ── Public API (blog frontend) ─────────────────────────────────────────────
router.get(
  '/',
  resolvePublicTenant,
  requireScopeIfToken('categories:read'),
  async (req, res, next) => {
    try {
      const cacheKey = `categories:${req.tenantId}`;
      let cats = await cache.get(cacheKey);
      if (!cats) {
        cats = await db.query(
          `
        SELECT c.id, c.name, c.slug, c.description, c.parent_id, c.sort_order,
               COUNT(DISTINCT ps.post_id) AS post_count
        FROM categories c
        LEFT JOIN post_categories pc ON pc.category_id = c.id
        LEFT JOIN posts p ON p.id = pc.post_id AND p.tenant_id = c.tenant_id
        LEFT JOIN post_status ps ON ps.post_id = p.id
          AND ps.status = 'published'
          AND ps.id = (SELECT id FROM post_status WHERE post_id = p.id ORDER BY id DESC LIMIT 1)
        WHERE c.tenant_id = ?
        GROUP BY c.id ORDER BY c.sort_order, c.name`,
          [req.tenantId]
        );
        await cache.setex(cacheKey, 600, cats);
      }
      res.json({ success: true, data: cats });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/:slug/posts',
  resolvePublicTenant,
  requireScopeIfToken('posts:read'),
  async (req, res, next) => {
    try {
      const postsService = require('../posts/posts.service');
      const result = await postsService.getPublishedPosts(req.tenantId, {
        categorySlug: req.params.slug,
        page: parseInt(req.query.page) || 1,
        perPage: parseInt(req.query.per_page) || 10,
      });
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }
);

// ── Admin API ──────────────────────────────────────────────────────────────
const adminRouter = express.Router();
adminRouter.use(authenticate, resolveTenantFromJWT);

adminRouter.get('/', async (req, res, next) => {
  try {
    const cats = await db.query(
      `SELECT * FROM categories WHERE tenant_id = ? ORDER BY sort_order, name`,
      [req.tenantId]
    );
    res.json({ success: true, data: cats });
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/', requireRole('editor'), async (req, res, next) => {
  try {
    const { name, description, parentId, sortOrder = 0 } = req.body;
    if (!name) throw new AppError('Name required', 400);
    const slug = slugify(name);
    const id = uuidv4();
    await db.query(
      `INSERT INTO categories (id, tenant_id, name, slug, description, parent_id, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        req.tenantId,
        name,
        slug,
        description || null,
        parentId || null,
        sortOrder,
      ]
    );
    await cache.del(`categories:${req.tenantId}`);
    await webhookService.triggerEvent(req.tenantId, 'category.updated', {
      categoryId: id,
      categorySlug: slug,
    });
    res.status(201).json({ success: true, data: { id, name, slug } });
  } catch (err) {
    next(err);
  }
});

adminRouter.put('/:id', requireRole('editor'), async (req, res, next) => {
  try {
    const { name, description, parentId, sortOrder } = req.body;
    await db.query(
      `UPDATE categories SET name = COALESCE(?, name), description = COALESCE(?, description),
       parent_id = ?, sort_order = COALESCE(?, sort_order) WHERE id = ? AND tenant_id = ?`,
      [
        name,
        description,
        parentId || null,
        sortOrder,
        req.params.id,
        req.tenantId,
      ]
    );
    await cache.del(`categories:${req.tenantId}`);
    const updated = await db.queryOne(
      `SELECT slug FROM categories WHERE id = ? AND tenant_id = ?`,
      [req.params.id, req.tenantId]
    );
    await webhookService.triggerEvent(req.tenantId, 'category.updated', {
      categoryId: req.params.id,
      categorySlug: updated?.slug || null,
    });
    res.json({ success: true, message: 'Category updated' });
  } catch (err) {
    next(err);
  }
});

adminRouter.delete('/:id', requireRole('editor'), async (req, res, next) => {
  try {
    const existing = await db.queryOne(
      `SELECT slug FROM categories WHERE id = ? AND tenant_id = ?`,
      [req.params.id, req.tenantId]
    );
    await db.query(`DELETE FROM categories WHERE id = ? AND tenant_id = ?`, [
      req.params.id,
      req.tenantId,
    ]);
    await cache.del(`categories:${req.tenantId}`);
    await webhookService.triggerEvent(req.tenantId, 'category.updated', {
      categoryId: req.params.id,
      categorySlug: existing?.slug || null,
    });
    res.json({ success: true, message: 'Category deleted' });
  } catch (err) {
    next(err);
  }
});

// Mount admin router at a separate path (wired in app.js)
router.use('/admin', adminRouter);

module.exports = router;
