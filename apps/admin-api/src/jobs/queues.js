require('dotenv').config();
const net = require('net');
const { Queue } = require('bullmq');
const db = require('../config/database');
const cache = require('../config/redis');
const logger = require('../config/logger');

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: Number.parseInt(process.env.REDIS_PORT, 10) || 6379,
};

let scheduledPostsQueue = null;
let sitemapQueue = null;
let newsletterQueue = null;
let importsQueue = null;
let lastProbeAt = 0;
let lastProbeResult = false;
let fallbackLogged = false;

async function isRedisQueueAvailable() {
  const now = Date.now();
  if (now - lastProbeAt < 5000) {
    return lastProbeResult;
  }

  lastProbeResult = await new Promise(resolve => {
    const socket = net.createConnection(connection);
    const finalize = result => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(750);
    socket.once('connect', () => finalize(true));
    socket.once('timeout', () => finalize(false));
    socket.once('error', () => finalize(false));
  });

  lastProbeAt = now;

  if (!lastProbeResult && !fallbackLogged) {
    logger.warn('Redis queue backend unavailable, using direct fallback jobs');
    fallbackLogged = true;
  }

  if (lastProbeResult) {
    fallbackLogged = false;
  }

  return lastProbeResult;
}

async function getScheduledPostsQueue() {
  if (!(await isRedisQueueAvailable())) {
    return null;
  }

  if (!scheduledPostsQueue) {
    scheduledPostsQueue = new Queue('scheduled-posts', { connection });
  }

  return scheduledPostsQueue;
}

async function getSitemapQueue() {
  if (!(await isRedisQueueAvailable())) {
    return null;
  }

  if (!sitemapQueue) {
    sitemapQueue = new Queue('sitemap-gen', { connection });
  }

  return sitemapQueue;
}

async function getNewsletterQueue() {
  if (!(await isRedisQueueAvailable())) {
    return null;
  }

  if (!newsletterQueue) {
    newsletterQueue = new Queue('newsletter-send', { connection });
  }

  return newsletterQueue;
}

async function getImportsQueue() {
  if (!(await isRedisQueueAvailable())) {
    return null;
  }

  if (!importsQueue) {
    importsQueue = new Queue('imports', { connection });
  }

  return importsQueue;
}

async function generateSitemapSnapshot(tenantId) {
  const posts = await db.query(
    `
    SELECT p.slug, ps.published_at
    FROM posts p
    JOIN post_status ps ON ps.post_id = p.id
      AND ps.status = 'published'
      AND ps.id = (
        SELECT id FROM post_status
        WHERE post_id = p.id
        ORDER BY created_at DESC
        LIMIT 1
      )
    WHERE p.tenant_id = ?
  `,
    [tenantId]
  );

  await cache.setex(`sitemap:${tenantId}`, 3600, posts);
  return posts;
}

async function schedulePost(postId, tenantId, publishedBy, scheduledAt) {
  const delay = new Date(scheduledAt).getTime() - Date.now();
  if (delay <= 0) {
    throw new Error('Scheduled time must be in the future');
  }

  const queue = await getScheduledPostsQueue();
  if (!queue) {
    return { mode: 'fallback' };
  }

  const jobId = `schedule-${postId}`;
  const existingJob = await queue.getJob(jobId);
  if (existingJob) {
    await existingJob.remove();
  }

  await queue.add(
    'publish',
    { postId, tenantId, publishedBy },
    { delay, jobId, removeOnComplete: true, removeOnFail: true }
  );

  return { mode: 'bullmq', jobId };
}

async function triggerSitemapRegen(tenantId) {
  const queue = await getSitemapQueue();
  if (!queue) {
    await generateSitemapSnapshot(tenantId);
    return { mode: 'fallback' };
  }

  await queue.add('generate', { tenantId }, { removeOnComplete: true });
  return { mode: 'bullmq' };
}

module.exports = {
  connection,
  schedulePost,
  generateSitemapSnapshot,
  isRedisQueueAvailable,
  triggerSitemapRegen,
  getNewsletterQueue,
  getImportsQueue,
};
