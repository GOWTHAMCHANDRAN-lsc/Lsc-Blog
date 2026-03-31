const express = require('express');
const db = require('../../config/database');
const { authenticate } = require('../../middleware/auth');
const { resolveTenantFromJWT } = require('../../middleware/tenantResolver');
const { resolvePublicTenant } = require('../../middleware/publicTenant');
const { requireScopeIfToken } = require('../../middleware/apiToken');

const publicAnalyticsRouter = express.Router();
const adminAnalyticsRouter = express.Router();

adminAnalyticsRouter.use(authenticate, resolveTenantFromJWT);

adminAnalyticsRouter.get('/overview', async (req, res, next) => {
  try {
    const [views, topPosts, byDay] = await Promise.all([
      db.queryOne(
        `SELECT COUNT(*) AS total_views FROM analytics_pageviews
         WHERE tenant_id = ? AND viewed_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
        [req.tenantId]
      ),
      db.query(
        `SELECT p.title, p.slug, COUNT(av.id) AS views
         FROM analytics_pageviews av
         JOIN posts p ON p.id = av.post_id
         WHERE av.tenant_id = ? AND av.viewed_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
         GROUP BY p.id ORDER BY views DESC LIMIT 10`,
        [req.tenantId]
      ),
      db.query(
        `SELECT DATE(viewed_at) AS date, COUNT(*) AS views
         FROM analytics_pageviews
         WHERE tenant_id = ? AND viewed_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
         GROUP BY DATE(viewed_at) ORDER BY date ASC`,
        [req.tenantId]
      ),
    ]);

    res.json({
      success: true,
      data: {
        total_views: views.total_views,
        top_posts: topPosts,
        by_day: byDay,
      },
    });
  } catch (err) {
    next(err);
  }
});

publicAnalyticsRouter.post(
  '/pageview',
  resolvePublicTenant,
  requireScopeIfToken('analytics:write'),
  async (req, res) => {
    try {
      const { postId, path, referrer, countryCode, deviceType } = req.body;
      await db.query(
        `INSERT INTO analytics_pageviews (tenant_id, post_id, path, referrer, country_code, device_type)
       VALUES (?, ?, ?, ?, ?, ?)`,
        [
          req.tenantId,
          postId || null,
          path,
          referrer || null,
          countryCode || null,
          deviceType || null,
        ]
      );
      res.json({ success: true });
    } catch {
      res.json({ success: true });
    }
  }
);

module.exports = { publicAnalyticsRouter, adminAnalyticsRouter };
