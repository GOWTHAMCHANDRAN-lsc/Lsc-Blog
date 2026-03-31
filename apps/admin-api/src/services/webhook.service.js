const crypto = require('crypto');
const db = require('../config/database');
const logger = require('../config/logger');

class WebhookService {
  /**
   * Fires a cache invalidation webhook to all registered webhook URLs for a tenant.
   * Blog frontends use this to trigger Next.js ISR revalidation.
   */
  async triggerRevalidation(
    tenantId,
    postId,
    postSlug = null,
    event = 'post.published'
  ) {
    const webhookUrls = await this._getWebhookUrls(tenantId);
    if (!webhookUrls.length) return;

    const payload = JSON.stringify({
      event,
      tenantId,
      postId,
      postSlug,
      timestamp: new Date().toISOString(),
    });

    const secret = process.env.WEBHOOK_SECRET;
    const signature = `sha256=${crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex')}`;

    const results = await Promise.allSettled(
      webhookUrls.map(url => this._sendWebhook(url, payload, signature))
    );

    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        logger.warn(
          `Webhook failed for ${webhookUrls[i]}: ${r.reason?.message}`
        );
      }
    });
  }

  async triggerConfigUpdate(tenantId) {
    return this.triggerEvent(tenantId, 'config.updated', {});
  }

  async triggerEvent(tenantId, event, data = {}) {
    const webhookUrls = await this._getWebhookUrls(tenantId);
    if (!webhookUrls.length) return;

    const payload = JSON.stringify({
      event,
      tenantId,
      ...data,
      timestamp: new Date().toISOString(),
    });

    const secret = process.env.WEBHOOK_SECRET;
    const signature = `sha256=${crypto.createHmac('sha256', secret).update(payload).digest('hex')}`;

    await Promise.allSettled(
      webhookUrls.map(url => this._sendWebhook(url, payload, signature))
    );
  }

  async _sendWebhook(url, payload, signature) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Platform-Event': 'cache-invalidation',
        },
        body: payload,
        signal: controller.signal,
      });

      if (!response.ok) {
        logger.warn(`Webhook ${url} responded with ${response.status}`);
      }

      return response;
    } finally {
      clearTimeout(timeout);
    }
  }

  async _getWebhookUrls(tenantId) {
    const config = await db.queryOne(
      `SELECT webhook_urls FROM site_config WHERE tenant_id = ?`,
      [tenantId]
    );
    if (!config?.webhook_urls) return [];
    try {
      const urls = JSON.parse(config.webhook_urls);
      return Array.isArray(urls)
        ? urls.filter(url => isAllowedWebhookUrl(url))
        : [];
    } catch {
      return [];
    }
  }
}

module.exports = new WebhookService();

function isAllowedWebhookUrl(url) {
  if (typeof url !== 'string') {
    return false;
  }

  if (url.startsWith('https://')) {
    return true;
  }

  return (
    process.env.NODE_ENV !== 'production' &&
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/[^\s]*$/i.test(url)
  );
}
