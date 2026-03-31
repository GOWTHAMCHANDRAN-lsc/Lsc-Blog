const express = require('express');
const router = express.Router();
const postsService = require('./posts.service');
const { resolvePublicTenant } = require('../../middleware/publicTenant');
const { requireScopeIfToken } = require('../../middleware/apiToken');

router.use(resolvePublicTenant);
router.use(requireScopeIfToken('posts:read'));

// GET /api/v1/posts
router.get('/', async (req, res, next) => {
  try {
    const result = await postsService.getPublishedPosts(req.tenantId, {
      page: parseInt(req.query.page) || 1,
      perPage: Math.min(parseInt(req.query.per_page) || 10, 100),
      categorySlug: req.query.category,
      tagSlug: req.query.tag,
      searchQuery: req.query.search,
      sort: req.query.sort,
      order: req.query.order?.toUpperCase(),
    });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/posts/featured
router.get('/featured', async (req, res, next) => {
  try {
    const result = await postsService.getPublishedPosts(req.tenantId, {
      perPage: 5,
      sort: 'published_at',
      order: 'DESC',
    });
    res.json({ success: true, data: result.data });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/posts/:slug
router.get('/:slug', async (req, res, next) => {
  try {
    const post = await postsService.getPublishedPostBySlug(
      req.tenantId,
      req.params.slug
    );
    if (!post)
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Post not found' },
      });
    res.json({ success: true, data: post });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
