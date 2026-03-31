require('dotenv').config();
const { Worker } = require('bullmq');
const db = require('../config/database');
const cache = require('../config/redis');
const webhookService = require('../services/webhook.service');
const logger = require('../config/logger');
const emailService = require('../services/email.service');
const { getCampaignForSend } = require('./newsletter');
const { XMLParser } = require('fast-xml-parser');
const fs = require('fs/promises');
const { slugify } = require('../utils/slugify');
const {
  sanitizeRichText,
  sanitizePlainText,
} = require('../utils/sanitizeHtml');
const {
  connection,
  schedulePost,
  triggerSitemapRegen,
  generateSitemapSnapshot,
  isRedisQueueAvailable,
} = require('./queues');

async function publishScheduledPost(postId, tenantId, publishedBy) {
  const status = await db.queryOne(
    'SELECT status FROM post_status WHERE post_id = ? ORDER BY id DESC LIMIT 1',
    [postId]
  );

  if (status?.status !== 'scheduled') {
    logger.warn(
      `Skipping scheduled post ${postId}: status is ${status?.status}`
    );
    return false;
  }

  const post = await db.queryOne(
    'SELECT slug FROM posts WHERE id = ? AND tenant_id = ?',
    [postId, tenantId]
  );

  if (!post) {
    return false;
  }

  await db.query(
    `INSERT INTO post_status (id, post_id, status, changed_by, published_at)
     VALUES (UUID(), ?, 'published', ?, NOW())`,
    [postId, publishedBy]
  );

  await cache.invalidatePattern(`posts:${tenantId}:*`);
  await cache.del(`post:${tenantId}:${post.slug}`);
  await webhookService.triggerRevalidation(
    tenantId,
    postId,
    post.slug,
    'post.published'
  );

  logger.info(`Scheduled post ${postId} published`);
  return true;
}

async function processDueScheduledPosts() {
  const scheduledPosts = await db.query(`
    SELECT p.id AS post_id, p.tenant_id, COALESCE(ps.changed_by, p.author_id) AS published_by
    FROM posts p
    JOIN post_status ps ON ps.post_id = p.id
      AND ps.id = (
        SELECT id FROM post_status
        WHERE post_id = p.id
        ORDER BY id DESC
        LIMIT 1
      )
    WHERE ps.status = 'scheduled'
      AND ps.scheduled_at IS NOT NULL
      AND ps.scheduled_at <= NOW()
  `);

  for (const scheduledPost of scheduledPosts) {
    try {
      await publishScheduledPost(
        scheduledPost.post_id,
        scheduledPost.tenant_id,
        scheduledPost.published_by
      );
    } catch (err) {
      logger.error(
        `Scheduled post fallback failed for ${scheduledPost.post_id}: ${err.message}`
      );
    }
  }
}

function registerWorkerEvents(workers) {
  workers.forEach(worker => {
    worker.on('failed', (job, err) =>
      logger.error(`Job failed [${job?.name}]: ${err.message}`)
    );
    worker.on('completed', job => logger.info(`Job completed [${job.name}]`));
  });
}

function startFallbackWorker() {
  logger.warn(
    'Redis unavailable. Using database polling fallback for scheduled jobs'
  );

  const tick = async () => {
    try {
      await processDueScheduledPosts();
    } catch (err) {
      logger.error(`Scheduled job poller failed: ${err.message}`);
    }
  };

  tick();
  const intervalHandle = setInterval(tick, 5000);
  if (typeof intervalHandle.unref === 'function') {
    intervalHandle.unref();
  }

  logger.info('Background workers started in fallback mode');
}

async function startQueueWorkers() {
  const scheduledPostsWorker = new Worker(
    'scheduled-posts',
    async job => {
      const { postId, tenantId, publishedBy } = job.data;
      logger.info(`Processing scheduled publish: post ${postId}`);
      await publishScheduledPost(postId, tenantId, publishedBy);
    },
    { connection }
  );

  const sitemapWorker = new Worker(
    'sitemap-gen',
    async job => {
      const { tenantId } = job.data;
      logger.info(`Generating sitemap for tenant ${tenantId}`);
      const posts = await generateSitemapSnapshot(tenantId);
      logger.info(
        `Sitemap cached for tenant ${tenantId}: ${posts.length} URLs`
      );
    },
    { connection }
  );

  const analyticsWorker = new Worker(
    'analytics-rollup',
    async job => {
      const { tenantId, date } = job.data;
      logger.info(`Rolling up analytics for tenant ${tenantId} on ${date}`);
      // Aggregate daily stats here and store in analytics_daily_summary table
    },
    { connection }
  );

  const newsletterWorker = new Worker(
    'newsletter-send',
    async job => {
      const { tenantId, campaignId } = job.data;
      logger.info(
        `Sending newsletter campaign ${campaignId} for tenant ${tenantId}`
      );

      const campaign = await getCampaignForSend(tenantId, campaignId);
      if (!campaign) {
        logger.warn(`Campaign not found: ${campaignId}`);
        return;
      }

      const subscribers = await db.query(
        `SELECT id, email, name, unsubscribe_token
       FROM subscribers
       WHERE tenant_id = ? AND status = 'active'
       ORDER BY created_at ASC`,
        [tenantId]
      );

      await db.query(
        `UPDATE newsletter_campaigns SET status = 'sending' WHERE id = ?`,
        [campaignId]
      );

      let sentCount = 0;
      let failedCount = 0;

      for (const sub of subscribers) {
        try {
          await db.query(
            `INSERT IGNORE INTO newsletter_sends (id, campaign_id, subscriber_id, status)
           VALUES (UUID(), ?, ?, 'queued')`,
            [campaignId, sub.id]
          );

          const baseUrl = process.env.PUBLIC_SITE_BASE_URL || null;
          const unsubscribeUrl = baseUrl
            ? `${baseUrl}/unsubscribe?token=${sub.unsubscribe_token}`
            : null;

          const html = unsubscribeUrl
            ? `${campaign.html}<hr/><p style="font-size:12px;color:#64748b">Unsubscribe: <a href="${unsubscribeUrl}">${unsubscribeUrl}</a></p>`
            : campaign.html;

          await emailService.sendMail({
            to: sub.email,
            subject: campaign.subject,
            html,
            text: campaign.preview_text || undefined,
          });

          await db.query(
            `UPDATE newsletter_sends SET status = 'sent', sent_at = NOW(), error = NULL
           WHERE campaign_id = ? AND subscriber_id = ?`,
            [campaignId, sub.id]
          );
          sentCount++;
        } catch (err) {
          await db.query(
            `UPDATE newsletter_sends SET status = 'failed', error = ?
           WHERE campaign_id = ? AND subscriber_id = ?`,
            [
              String(err?.message || 'send failed').slice(0, 500),
              campaignId,
              sub.id,
            ]
          );
          failedCount++;
        }
      }

      const finalStatus =
        failedCount === 0 ? 'sent' : sentCount === 0 ? 'failed' : 'partial';
      await db.query(
        `UPDATE newsletter_campaigns SET status = ?, sent_at = NOW() WHERE id = ?`,
        [finalStatus, campaignId]
      );
      logger.info(
        `Newsletter campaign ${campaignId} completed: ${sentCount} sent, ${failedCount} failed`
      );
    },
    { connection }
  );

  const importsWorker = new Worker(
    'imports',
    async job => {
      const { tenantId, jobId, type, filePath, requestedBy } = job.data;
      logger.info(
        `Running import job ${jobId} (${type}) for tenant ${tenantId}`
      );

      await db.query(
        `UPDATE import_jobs SET status = 'processing', progress = 0, total = 0, error = NULL WHERE id = ? AND tenant_id = ?`,
        [jobId, tenantId]
      );

      const xml = await fs.readFile(filePath, 'utf8');
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '',
        cdataPropName: '__cdata',
        trimValues: true,
      });
      const parsed = parser.parse(xml);

      const items =
        type === 'wxr' ? extractWxrItems(parsed) : extractRssItems(parsed);

      await db.query(
        `UPDATE import_jobs SET total = ? WHERE id = ? AND tenant_id = ?`,
        [items.length, jobId, tenantId]
      );

      let imported = 0;
      const createdPostIds = [];

      for (const item of items) {
        try {
          const title = sanitizePlainText(item.title, 500) || 'Untitled';
          const content =
            sanitizeRichText(item.content || '<p></p>') || '<p></p>';
          const excerpt = sanitizePlainText(item.excerpt || '', 320) || '';
          const slug = await generateUniqueSlug(tenantId, title);

          const plainText = content.replace(/<[^>]*>/g, ' ');
          const wordCount = plainText
            .trim()
            .split(/\s+/)
            .filter(Boolean).length;
          const readingTime = Math.max(1, Math.ceil(wordCount / 200));
          const postId = require('crypto').randomUUID();

          await db.transaction(async trx => {
            await trx.query(
              `INSERT INTO posts
               (id, tenant_id, author_id, title, slug, excerpt, content, content_format, word_count, reading_time_mins)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'html', ?, ?)`,
              [
                postId,
                tenantId,
                requestedBy,
                title,
                slug,
                excerpt,
                content,
                wordCount,
                readingTime,
              ]
            );

            await trx.query(
              `INSERT INTO post_status (id, post_id, status, changed_by) VALUES (UUID(), ?, 'draft', ?)`,
              [postId, requestedBy]
            );

            await trx.query(
              `INSERT INTO seo_meta (id, post_id, tenant_id, meta_title, meta_description)
             VALUES (UUID(), ?, ?, ?, ?)`,
              [
                postId,
                tenantId,
                title.substring(0, 70),
                excerpt.substring(0, 160),
              ]
            );
          });

          createdPostIds.push(postId);
          imported += 1;
        } catch (err) {
          // Continue importing other items
        } finally {
          await db.query(
            `UPDATE import_jobs SET progress = ? WHERE id = ? AND tenant_id = ?`,
            [imported, jobId, tenantId]
          );
        }
      }

      await db.query(
        `UPDATE import_jobs SET status = 'completed', result_json = ? WHERE id = ? AND tenant_id = ?`,
        [
          JSON.stringify({
            imported: imported,
            postIds: createdPostIds.slice(0, 50),
          }),
          jobId,
          tenantId,
        ]
      );
    },
    { connection }
  );

  registerWorkerEvents([
    scheduledPostsWorker,
    sitemapWorker,
    analyticsWorker,
    newsletterWorker,
  ]);
  registerWorkerEvents([importsWorker]);
  logger.info('Background workers started');
}

function extractRssItems(parsed) {
  const channel = parsed?.rss?.channel || parsed?.feed;
  const rawItems = channel?.item || channel?.entry || [];
  const items = Array.isArray(rawItems) ? rawItems : [rawItems].filter(Boolean);

  return items
    .map(item => ({
      title: item.title?.__cdata || item.title || '',
      excerpt: item.description?.__cdata || item.description || '',
      content:
        item['content:encoded']?.__cdata ||
        item['content:encoded'] ||
        item.content?.__cdata ||
        item.content ||
        item.description?.__cdata ||
        item.description ||
        '',
    }))
    .filter(item => item.title || item.content);
}

function extractWxrItems(parsed) {
  const channel = parsed?.rss?.channel;
  const rawItems = channel?.item || [];
  const items = Array.isArray(rawItems) ? rawItems : [rawItems].filter(Boolean);

  return items
    .filter(item => {
      const postType = item['wp:post_type']?.__cdata || item['wp:post_type'];
      const status = item['wp:status']?.__cdata || item['wp:status'];
      return (
        postType === 'post' && (status === 'publish' || status === 'draft')
      );
    })
    .map(item => ({
      title: item.title?.__cdata || item.title || '',
      excerpt:
        item['excerpt:encoded']?.__cdata || item['excerpt:encoded'] || '',
      content:
        item['content:encoded']?.__cdata || item['content:encoded'] || '',
    }))
    .filter(item => item.title || item.content);
}

async function generateUniqueSlug(tenantId, title) {
  let base = slugify(title);
  let slug = base;
  let i = 1;
  while (true) {
    const existing = await db.queryOne(
      `SELECT id FROM posts WHERE tenant_id = ? AND slug = ?`,
      [tenantId, slug]
    );
    if (!existing) {
      return slug;
    }
    slug = `${base}-${i++}`;
  }
}

async function bootstrap() {
  if (await isRedisQueueAvailable()) {
    await startQueueWorkers();
    return;
  }

  startFallbackWorker();
}

bootstrap().catch(err => {
  logger.error(`Background worker bootstrap failed: ${err.message}`);
  process.exit(1);
});

module.exports = {
  schedulePost,
  triggerSitemapRegen,
  processDueScheduledPosts,
};
