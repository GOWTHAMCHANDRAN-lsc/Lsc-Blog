const express = require('express');
const router = express.Router();
const seoService = require('./seo.service');
const { authenticate } = require('../../middleware/auth');
const { resolveTenantFromJWT } = require('../../middleware/tenantResolver');

router.use(authenticate, resolveTenantFromJWT);

// POST /admin/v1/seo/:postId/analyze
router.post('/:postId/analyze', async (req, res, next) => {
  try {
    const analysis = await seoService.analyzePost(
      req.params.postId,
      req.tenantId
    );
    res.json({ success: true, data: analysis });
  } catch (err) {
    next(err);
  }
});

// PUT /admin/v1/seo/:postId
router.put('/:postId', async (req, res, next) => {
  try {
    await seoService.saveSeoMeta(req.params.postId, req.tenantId, req.body);
    res.json({ success: true, message: 'SEO meta saved' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
