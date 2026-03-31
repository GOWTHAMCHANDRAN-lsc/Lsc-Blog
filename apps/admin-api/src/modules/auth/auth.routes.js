const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const authService = require('./auth.service');
const { authenticate } = require('../../middleware/auth');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }
  next();
};

// POST /admin/v1/auth/login
router.post(
  '/login',
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('tenantId').optional().isUUID(),
  validate,
  async (req, res, next) => {
    try {
      const result = await authService.login(
        req.body.email,
        req.body.password,
        req.body.tenantId || null
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

// POST /admin/v1/auth/refresh
router.post(
  '/refresh',
  body('refreshToken').notEmpty(),
  validate,
  async (req, res, next) => {
    try {
      const result = await authService.refreshToken(req.body.refreshToken);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

// POST /admin/v1/auth/switch-tenant
router.post(
  '/switch-tenant',
  authenticate,
  body('tenantId').isUUID(),
  body('refreshToken').notEmpty(),
  validate,
  async (req, res, next) => {
    try {
      const result = await authService.switchTenant(
        req.user.id,
        req.user.systemRole,
        req.body.tenantId,
        req.body.refreshToken || null
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

// POST /admin/v1/auth/logout
router.post('/logout', authenticate, async (req, res, next) => {
  try {
    await authService.logout(req.body.refreshToken);
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
});

// POST /admin/v1/auth/register
router.post(
  '/register',
  body('email').isEmail().normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters'),
  body('name').trim().isLength({ min: 2 }),
  validate,
  async (req, res, next) => {
    try {
      const user = await authService.register(req.body);
      res.status(201).json({ success: true, data: user });
    } catch (err) {
      next(err);
    }
  }
);

// GET /admin/v1/auth/me
router.get('/me', authenticate, async (req, res) => {
  res.json({ success: true, data: req.user });
});

module.exports = router;
