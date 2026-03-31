const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const cache = require('../../config/redis');
const { authenticate, requireRole } = require('../../middleware/auth');
const { resolveTenantFromJWT } = require('../../middleware/tenantResolver');
const { resolvePublicTenant } = require('../../middleware/publicTenant');
const webhookService = require('../../services/webhook.service');
const { requireScopeIfToken } = require('../../middleware/apiToken');
const {
  sanitizePlainText,
  sanitizeExternalUrl,
  sanitizeEmbedMarkup,
} = require('../../utils/sanitizeHtml');

// Public: GET /api/v1/site-config
router.get(
  '/',
  resolvePublicTenant,
  requireScopeIfToken('config:read'),
  async (req, res, next) => {
    try {
      const cacheKey = `site-config:${req.tenantId}`;
      let config = await cache.get(cacheKey);
      if (!config) {
        config = await db.queryOne(
          `SELECT site_name, site_tagline, logo_url, favicon_url, primary_color, font_family,
                theme_id,
                posts_per_page, enable_comments, comment_provider, comment_moderation,
                comments_per_page, analytics_id, rss_enabled,
                header_scripts, footer_scripts, social_links, nav_links, footer_links, locale, timezone
         FROM site_config WHERE tenant_id = ?`,
          [req.tenantId]
        );
        config = normalizeSiteConfig(config);
        if (config) await cache.setex(cacheKey, 86400, config);
      }
      if (!config)
        return res
          .status(404)
          .json({ success: false, error: { code: 'CONFIG_NOT_FOUND' } });
      res.json({ success: true, data: config });
    } catch (err) {
      next(err);
    }
  }
);

// Admin: GET /admin/v1/site-config
router.get(
  '/admin',
  authenticate,
  resolveTenantFromJWT,
  async (req, res, next) => {
    try {
      const config = normalizeSiteConfig(
        await db.queryOne(`SELECT * FROM site_config WHERE tenant_id = ?`, [
          req.tenantId,
        ])
      );
      res.json({ success: true, data: config });
    } catch (err) {
      next(err);
    }
  }
);

// Admin: PUT /admin/v1/site-config
router.put(
  '/admin',
  authenticate,
  resolveTenantFromJWT,
  requireRole('admin'),
  async (req, res, next) => {
    try {
      const sanitizedBody = {
        site_name:
          req.body.site_name !== undefined
            ? sanitizePlainText(req.body.site_name, 120)
            : undefined,
        site_tagline:
          req.body.site_tagline !== undefined
            ? sanitizePlainText(req.body.site_tagline, 220)
            : undefined,
        logo_url:
          req.body.logo_url !== undefined
            ? sanitizeExternalUrl(req.body.logo_url)
            : undefined,
        favicon_url:
          req.body.favicon_url !== undefined
            ? sanitizeExternalUrl(req.body.favicon_url)
            : undefined,
        primary_color:
          req.body.primary_color !== undefined &&
          /^#[0-9a-f]{6}$/i.test(req.body.primary_color)
            ? req.body.primary_color
            : undefined,
        font_family:
          req.body.font_family !== undefined
            ? sanitizePlainText(req.body.font_family, 80)
            : undefined,
        theme_id:
          req.body.theme_id !== undefined
            ? sanitizePlainText(req.body.theme_id, 50)
            : undefined,
        posts_per_page:
          req.body.posts_per_page !== undefined
            ? Math.min(
                Math.max(parseInt(req.body.posts_per_page, 10) || 10, 1),
                50
              )
            : undefined,
        enable_comments:
          req.body.enable_comments !== undefined
            ? Boolean(req.body.enable_comments)
            : undefined,
        comment_provider:
          req.body.comment_provider !== undefined
            ? sanitizePlainText(req.body.comment_provider, 40)
            : undefined,
        comment_moderation:
          req.body.comment_moderation !== undefined &&
          ['off', 'manual', 'auto'].includes(req.body.comment_moderation)
            ? req.body.comment_moderation
            : undefined,
        comments_per_page:
          req.body.comments_per_page !== undefined
            ? Math.min(
                Math.max(parseInt(req.body.comments_per_page, 10) || 10, 1),
                50
              )
            : undefined,
        comment_blocked_words:
          req.body.comment_blocked_words !== undefined
            ? sanitizePlainText(req.body.comment_blocked_words, 2000)
            : undefined,
        analytics_id:
          req.body.analytics_id !== undefined
            ? sanitizePlainText(req.body.analytics_id, 40)
            : undefined,
        rss_enabled:
          req.body.rss_enabled !== undefined
            ? Boolean(req.body.rss_enabled)
            : undefined,
        header_scripts:
          req.body.header_scripts !== undefined
            ? sanitizeEmbedMarkup(req.body.header_scripts)
            : undefined,
        footer_scripts:
          req.body.footer_scripts !== undefined
            ? sanitizeEmbedMarkup(req.body.footer_scripts)
            : undefined,
        social_links:
          req.body.social_links && typeof req.body.social_links === 'object'
            ? Object.fromEntries(
                Object.entries(req.body.social_links)
                  .map(([label, url]) => [
                    sanitizePlainText(label, 40),
                    sanitizeExternalUrl(url),
                  ])
                  .filter(([label, url]) => label && url)
              )
            : undefined,
        nav_links: Array.isArray(req.body.nav_links)
          ? sanitizeLinkList(req.body.nav_links, 10)
          : undefined,
        footer_links: Array.isArray(req.body.footer_links)
          ? sanitizeLinkList(req.body.footer_links, 12)
          : undefined,
        locale:
          req.body.locale !== undefined
            ? sanitizePlainText(req.body.locale, 20)
            : undefined,
        timezone:
          req.body.timezone !== undefined
            ? sanitizePlainText(req.body.timezone, 60)
            : undefined,
        webhook_urls: Array.isArray(req.body.webhook_urls)
          ? req.body.webhook_urls.filter(url => isAllowedWebhookUrl(url))
          : undefined,
      };

      const allowed = [
        'site_name',
        'site_tagline',
        'logo_url',
        'favicon_url',
        'primary_color',
        'font_family',
        'theme_id',
        'posts_per_page',
        'enable_comments',
        'comment_provider',
        'comment_moderation',
        'comments_per_page',
        'comment_blocked_words',
        'analytics_id',
        'rss_enabled',
        'header_scripts',
        'footer_scripts',
        'social_links',
        'nav_links',
        'footer_links',
        'locale',
        'timezone',
        'webhook_urls',
      ];
      const updates = [],
        params = [];
      allowed.forEach(f => {
        if (sanitizedBody[f] !== undefined) {
          updates.push(`${f} = ?`);
          params.push(
            sanitizedBody[f] && typeof sanitizedBody[f] === 'object'
              ? JSON.stringify(sanitizedBody[f])
              : sanitizedBody[f]
          );
        }
      });
      if (!updates.length)
        return res
          .status(400)
          .json({
            success: false,
            error: { message: 'No valid fields provided' },
          });
      params.push(req.tenantId);
      await db.query(
        `UPDATE site_config SET ${updates.join(', ')} WHERE tenant_id = ?`,
        params
      );
      await cache.del(`site-config:${req.tenantId}`);
      await webhookService.triggerConfigUpdate(req.tenantId);
      res.json({ success: true, message: 'Site config updated' });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;

function isAllowedWebhookUrl(url) {
  if (typeof url !== 'string') {
    return false;
  }

  if (/^https:\/\/[^\s]+$/i.test(url)) {
    return true;
  }

  return (
    process.env.NODE_ENV !== 'production' &&
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/[^\s]*$/i.test(url)
  );
}

function normalizeSiteConfig(config) {
  if (!config) {
    return null;
  }

  return {
    ...config,
    posts_per_page: Number(config.posts_per_page || 0),
    comments_per_page: Number(config.comments_per_page || 0),
    enable_comments: Boolean(config.enable_comments),
    rss_enabled: Boolean(config.rss_enabled),
    social_links: parseJsonField(config.social_links),
    nav_links: parseJsonField(config.nav_links),
    footer_links: parseJsonField(config.footer_links),
    webhook_urls: parseJsonField(config.webhook_urls),
  };
}

function parseJsonField(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function sanitizeLinkList(list, maxItems) {
  const items = list
    .filter(item => item && typeof item === 'object')
    .slice(0, maxItems)
    .map(item => ({
      label: sanitizePlainText(item.label, 40),
      href: sanitizeHref(item.href),
    }))
    .filter(item => item.label && item.href);

  return items.length ? items : null;
}

function sanitizeHref(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith('/')) {
    return trimmed.slice(0, 500);
  }

  return sanitizeExternalUrl(trimmed);
}
