require('dotenv').config();
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { errorHandler } = require('./utils/errors');
const logger = require('./config/logger');

// Route modules
const authRoutes = require('./modules/auth/auth.routes');
const postsRoutes = require('./modules/posts/posts.routes');
const adminPostsRoutes = require('./modules/posts/admin-posts.routes');
const tenantsRoutes = require('./modules/tenants/tenants.routes');
const usersRoutes = require('./modules/users/users.routes');
const categoriesRoutes = require('./modules/categories/categories.routes');
const tagsRoutes = require('./modules/tags/tags.routes');
const mediaRoutes = require('./modules/media/media.routes');
const seoRoutes = require('./modules/seo/seo.routes');
const approvalRoutes = require('./modules/approval/approval.routes');
const {
  publicAnalyticsRouter,
  adminAnalyticsRouter,
} = require('./modules/analytics/analytics.routes');
const siteConfigRoutes = require('./modules/site-config/site-config.routes');
const apiTokensRoutes = require('./modules/api-tokens/api-tokens.routes');
const {
  publicCommentsRouter,
  adminCommentsRouter,
} = require('./modules/comments/comments.routes');
const subscriptionsRoutes = require('./modules/subscriptions/subscriptions.routes');
const newslettersRoutes = require('./modules/newsletters/newsletters.routes');
const importsRoutes = require('./modules/imports/imports.routes');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

const publicApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 240,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Try again shortly.',
    },
  },
});

const adminApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Try again shortly.',
    },
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts. Try again later.',
    },
  },
});

// ─── Security & Parsing Middleware ────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:3000',
    ],
    credentials: true,
  })
);
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(
  morgan('combined', { stream: { write: msg => logger.info(msg.trim()) } })
);
app.use('/api/v1', publicApiLimiter);
app.use('/admin/v1', adminApiLimiter);
app.use('/admin/v1/auth', authLimiter);

// ─── Local media (dev / VPS) ──────────────────────────────────────────────────
// When using local-disk media storage, files are written under apps/admin-api/uploads/
// and served from /uploads/* (typically behind Nginx in production).
app.use(
  '/uploads',
  express.static(path.join(__dirname, '..', 'uploads'), {
    maxAge: process.env.NODE_ENV === 'production' ? '30d' : 0,
    fallthrough: true,
  })
);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// ─── Public Blog API (consumed by blog frontend sites via API token) ──────────
app.use('/api/v1/posts', postsRoutes);
app.use('/api/v1/posts', publicCommentsRouter);
app.use('/api/v1/categories', categoriesRoutes);
app.use('/api/v1/tags', tagsRoutes);
app.use('/api/v1/site-config', siteConfigRoutes);
app.use('/api/v1/analytics', publicAnalyticsRouter);
app.use('/api/v1/subscriptions', subscriptionsRoutes);

// ─── Admin API (consumed by admin dashboard via JWT) ──────────────────────────
app.use('/admin/v1/auth', authRoutes);
app.use('/admin/v1/tenants', tenantsRoutes);
app.use('/admin/v1/posts', adminPostsRoutes);
app.use('/admin/v1/users', usersRoutes);
app.use('/admin/v1/media', mediaRoutes);
app.use('/admin/v1/seo', seoRoutes);
app.use('/admin/v1/approval', approvalRoutes);
app.use('/admin/v1/analytics', adminAnalyticsRouter);
app.use('/admin/v1/api-tokens', apiTokensRoutes);
app.use('/admin/v1/comments', adminCommentsRouter);
app.use('/admin/v1', newslettersRoutes);
app.use('/admin/v1', importsRoutes);

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use(errorHandler);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  logger.info(`Admin API running on port ${PORT} [${process.env.NODE_ENV}]`);
});

module.exports = app;
