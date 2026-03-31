const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const postsService = require('./posts.service');
const seoService = require('../seo/seo.service');
const { authenticate, requireRole } = require('../../middleware/auth');
const { resolveTenantFromJWT } = require('../../middleware/tenantResolver');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(422).json({ success: false, errors: errors.array() });
  next();
};

// All admin post routes require authentication + tenant context
router.use(authenticate, resolveTenantFromJWT);

// GET /admin/v1/posts
router.get('/', async (req, res, next) => {
  try {
    const result = await postsService.listAdminPosts(req.tenantId, {
      page: parseInt(req.query.page) || 1,
      perPage: parseInt(req.query.per_page) || 20,
      status: req.query.status,
      authorId: req.query.author_id,
      search: req.query.search,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

// POST /admin/v1/posts
router.post(
  '/',
  requireRole('author'),
  body('title').trim().isLength({ min: 5, max: 500 }),
  body('content').notEmpty(),
  validate,
  async (req, res, next) => {
    try {
      const post = await postsService.createPost(
        req.tenantId,
        req.user.id,
        req.body
      );
      res.status(201).json({ success: true, data: post });
    } catch (err) {
      next(err);
    }
  }
);

// GET /admin/v1/posts/:id
router.get('/:id', async (req, res, next) => {
  try {
    const post = await postsService.getPostById(req.params.id, req.tenantId);
    if (!post)
      return res
        .status(404)
        .json({ success: false, error: { code: 'NOT_FOUND' } });
    res.json({ success: true, data: post });
  } catch (err) {
    next(err);
  }
});

// PUT /admin/v1/posts/:id
router.put('/:id', requireRole('author'), async (req, res, next) => {
  try {
    const post = await postsService.updatePost(
      req.params.id,
      req.tenantId,
      req.user.id,
      req.body
    );
    res.json({ success: true, data: post });
  } catch (err) {
    next(err);
  }
});

// POST /admin/v1/posts/:id/submit
router.post('/:id/submit', requireRole('author'), async (req, res, next) => {
  try {
    const result = await postsService.submitForApproval(
      req.params.id,
      req.tenantId,
      req.user.id
    );
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

// POST /admin/v1/posts/:id/approve
router.post('/:id/approve', requireRole('editor'), async (req, res, next) => {
  try {
    const result = await postsService.approvePost(
      req.params.id,
      req.tenantId,
      req.user.id,
      req.body.note
    );
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

// POST /admin/v1/posts/:id/reject
router.post(
  '/:id/reject',
  requireRole('editor'),
  body('reason').trim().notEmpty().withMessage('Rejection reason is required'),
  validate,
  async (req, res, next) => {
    try {
      const result = await postsService.rejectPost(
        req.params.id,
        req.tenantId,
        req.user.id,
        req.body.reason
      );
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }
);

// POST /admin/v1/posts/:id/publish
router.post('/:id/publish', requireRole('admin'), async (req, res, next) => {
  try {
    const result = await postsService.publishPost(
      req.params.id,
      req.tenantId,
      req.user.id
    );
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

// POST /admin/v1/posts/:id/schedule
router.post(
  '/:id/schedule',
  requireRole('admin'),
  body('scheduledAt')
    .isISO8601()
    .withMessage('A valid schedule time is required'),
  validate,
  async (req, res, next) => {
    try {
      const result = await postsService.schedulePost(
        req.params.id,
        req.tenantId,
        req.user.id,
        req.body.scheduledAt
      );
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }
);

// POST /admin/v1/posts/:id/unpublish
router.post('/:id/unpublish', requireRole('admin'), async (req, res, next) => {
  try {
    const result = await postsService.unpublishPost(
      req.params.id,
      req.tenantId,
      req.user.id
    );
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

// POST /admin/v1/posts/:id/seo/analyze
router.post('/:id/seo/analyze', async (req, res, next) => {
  try {
    const analysis = await seoService.analyzePost(req.params.id, req.tenantId);
    res.json({ success: true, data: analysis });
  } catch (err) {
    next(err);
  }
});

// PUT /admin/v1/posts/:id/seo
router.put('/:id/seo', async (req, res, next) => {
  try {
    await seoService.saveSeoMeta(req.params.id, req.tenantId, req.body);
    res.json({ success: true, message: 'SEO metadata saved' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
