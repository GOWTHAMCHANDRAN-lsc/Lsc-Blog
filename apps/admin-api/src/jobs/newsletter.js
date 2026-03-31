const db = require('../config/database');
const logger = require('../config/logger');
const { getNewsletterQueue } = require('./queues');

async function enqueueCampaignSend(tenantId, campaignId, requestedBy) {
  const queue = await getNewsletterQueue();
  if (!queue) {
    logger.warn('Newsletter queue unavailable, running direct fallback send');
    return { mode: 'fallback' };
  }

  const jobId = `campaign-${campaignId}`;
  await queue.add(
    'send-campaign',
    { tenantId, campaignId, requestedBy },
    { jobId, removeOnComplete: true, removeOnFail: true }
  );
  return { mode: 'bullmq', jobId };
}

async function getCampaignForSend(tenantId, campaignId) {
  const campaign = await db.queryOne(
    `SELECT id, subject, preview_text, html
     FROM newsletter_campaigns
     WHERE id = ? AND tenant_id = ?`,
    [campaignId, tenantId]
  );
  return campaign;
}

module.exports = { enqueueCampaignSend, getCampaignForSend };
