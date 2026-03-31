const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const tenantsService = require('./tenants.service');
const { authenticate, requireSystemRole } = require('../../middleware/auth');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(422).json({ success: false, errors: errors.array() });
  next();
};

router.use(authenticate);

// All list/create routes: super_admin only
router.get('/', requireSystemRole('super_admin'), async (req, res, next) => {
  try {
    const result = await tenantsService.listTenants({
      page: parseInt(req.query.page) || 1,
      perPage: parseInt(req.query.per_page) || 20,
      status: req.query.status,
      search: req.query.search,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/',
  requireSystemRole('super_admin'),
  body('name').trim().isLength({ min: 2, max: 255 }),
  body('slug').optional().trim().isSlug(),
  body('customDomain').optional().trim().isFQDN(),
  body('plan').optional().isIn(['starter', 'pro', 'enterprise']),
  body('blogUrl').optional().trim().isURL(),
  body('blogApiKey').optional().trim().isLength({ min: 10 }),
  body('allowedOrigins').optional().isArray(),
  validate,
  async (req, res, next) => {
    try {
      const tenant = await tenantsService.createTenant({
        ...req.body,
        ownerId: req.user.id,
      });
      res.status(201).json({ success: true, data: tenant });
    } catch (err) {
      next(err);
    }
  }
);

router.get('/:id', requireSystemRole('super_admin'), async (req, res, next) => {
  try {
    const tenant = await tenantsService.getTenantById(req.params.id);
    if (!tenant)
      return res
        .status(404)
        .json({ success: false, error: { code: 'NOT_FOUND' } });
    res.json({ success: true, data: tenant });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireSystemRole('super_admin'), async (req, res, next) => {
  try {
    const tenant = await tenantsService.updateTenant(req.params.id, req.body);
    res.json({ success: true, data: tenant });
  } catch (err) {
    next(err);
  }
});

router.delete(
  '/:id',
  requireSystemRole('super_admin'),
  async (req, res, next) => {
    try {
      await tenantsService.deleteTenant(req.params.id);
      res.json({ success: true, message: 'Tenant deleted' });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/:id/stats',
  requireSystemRole('super_admin'),
  async (req, res, next) => {
    try {
      const stats = await tenantsService.getTenantStats(req.params.id);
      res.json({ success: true, data: stats });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
