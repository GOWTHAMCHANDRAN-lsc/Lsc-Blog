const crypto = require('crypto');
const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, query, validationResult } = require('express-validator');
const db = require('../../config/database');
const webhookService = require('../../services/webhook.service');
const { authenticate, requireRole } = require('../../middleware/auth');
const { resolveTenantFromJWT } = require('../../middleware/tenantResolver');
const { resolvePublicTenant } = require('../../middleware/publicTenant');
const { requireScopeIfToken } = require('../../middleware/apiToken');
const { AppError } = require('../../utils/errors');
const {
  sanitizePlainText,
  sanitizeExternalUrl,
} = require('../../utils/sanitizeHtml');

const publicCommentsRouter = express.Router();
const adminCommentsRouter = express.Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: errors.array()[0]?.msg || 'Invalid request',
      },
      errors: errors.array(),
    });
  }
  next();
};

const commentSubmissionLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many comment submissions. Try again later.',
    },
  },
});

adminCommentsRouter.use(authenticate, resolveTenantFromJWT);

publicCommentsRouter.get(
  '/:slug/comments',
  resolvePublicTenant,
  requireScopeIfToken('comments:read'),
  query('page').optional().isInt({ min: 1 }),
  query('per_page').optional().isInt({ min: 1, max: 50 }),
  validate,
  async (req, res, next) => {
    try {
      const settings = await getCommentSettings(req.tenantId);
      if (!supportsNativeComments(settings)) {
        return res.json({
          success: true,
          data: [],
          meta: emptyMeta(1, settings?.comments_per_page || 10, 0),
        });
      }

      const post = await getPublishedPostBySlug(req.tenantId, req.params.slug);
      if (!post) {
        return res.status(404).json({
          success: false,
          error: { code: 'POST_NOT_FOUND', message: 'Post not found' },
        });
      }

      const page = Number.parseInt(req.query.page, 10) || 1;
      const perPage =
        Number.parseInt(req.query.per_page, 10) ||
        settings.comments_per_page ||
        10;
      const offset = (page - 1) * perPage;

      const [rows, [{ total } = { total: 0 }]] = await Promise.all([
        db.query(
          `SELECT id, author_name, author_website, content, created_at, status
           FROM comments
           WHERE tenant_id = ? AND post_id = ? AND status = 'approved' AND parent_id IS NULL
           ORDER BY created_at ASC
           LIMIT ? OFFSET ?`,
          [req.tenantId, post.id, perPage, offset]
        ),
        db.query(
          `SELECT COUNT(*) AS total
           FROM comments
           WHERE tenant_id = ? AND post_id = ? AND status = 'approved' AND parent_id IS NULL`,
          [req.tenantId, post.id]
        ),
      ]);

      res.json({
        success: true,
        data: rows,
        meta: buildMeta(page, perPage, total || 0),
      });
    } catch (err) {
      next(err);
    }
  }
);

publicCommentsRouter.post(
  '/:slug/comments',
  resolvePublicTenant,
  requireScopeIfToken('comments:write'),
  commentSubmissionLimiter,
  body('authorName').trim().isLength({ min: 2, max: 120 }),
  body('authorEmail').trim().isEmail().isLength({ max: 255 }),
  body('authorWebsite')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 1000 }),
  body('content').trim().isLength({ min: 3, max: 2000 }),
  body('company').optional({ values: 'falsy' }).trim().isLength({ max: 255 }),
  validate,
  async (req, res, next) => {
    try {
      const settings = await getCommentSettings(req.tenantId);
      if (!supportsNativeComments(settings)) {
        throw new AppError(
          'Comments are disabled for this site',
          403,
          'COMMENTS_DISABLED'
        );
      }

      const post = await getPublishedPostBySlug(req.tenantId, req.params.slug);
      if (!post) {
        throw new AppError('Post not found', 404, 'POST_NOT_FOUND');
      }

      // Honeypot: silently accept to avoid teaching bots about the field.
      if (typeof req.body.company === 'string' && req.body.company.trim()) {
        return res.json({
          success: true,
          data: { status: 'pending', message: 'Comment submitted for review.' },
        });
      }

      const authorName = sanitizePlainText(req.body.authorName, 120);
      const authorEmail = sanitizePlainText(
        req.body.authorEmail,
        255
      )?.toLowerCase();
      const authorWebsite = sanitizeExternalUrl(req.body.authorWebsite);
      const content = sanitizePlainText(req.body.content, 2000);

      if (!authorName || !authorEmail || !content) {
        throw new AppError(
          'Valid comment details are required',
          422,
          'INVALID_COMMENT'
        );
      }

      const ipHash = hashIp(req.ip);
      const duplicate = await db.queryOne(
        `SELECT id
         FROM comments
         WHERE tenant_id = ? AND post_id = ? AND author_email = ? AND content = ?
           AND created_at >= DATE_SUB(NOW(), INTERVAL 30 MINUTE)
         LIMIT 1`,
        [req.tenantId, post.id, authorEmail, content]
      );
      if (duplicate) {
        throw new AppError(
          'This comment was already submitted recently',
          409,
          'DUPLICATE_COMMENT'
        );
      }

      const moderation = resolveCommentModeration(
        settings,
        content,
        authorWebsite
      );
      const result = await db.transaction(async trx => {
        const commentId = crypto.randomUUID();
        await trx.query(
          `INSERT INTO comments
             (id, tenant_id, post_id, author_name, author_email, author_website, content,
              status, moderation_reason, ip_hash, user_agent, approved_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            commentId,
            req.tenantId,
            post.id,
            authorName,
            authorEmail,
            authorWebsite,
            content,
            moderation.status,
            moderation.reason,
            ipHash,
            sanitizePlainText(req.get('user-agent'), 500),
            moderation.status === 'approved' ? new Date() : null,
          ]
        );

        return trx.queryOne(
          `SELECT id, author_name, author_website, content, created_at
           FROM comments
           WHERE id = ?`,
          [commentId]
        );
      });

      if (moderation.status === 'approved') {
        await webhookService.triggerRevalidation(
          req.tenantId,
          post.id,
          post.slug,
          'comment.approved'
        );
      }

      res.status(201).json({
        success: true,
        data: {
          status: moderation.publicStatus,
          message:
            moderation.publicStatus === 'approved'
              ? 'Comment published.'
              : 'Comment submitted for review.',
          comment: moderation.publicStatus === 'approved' ? result : null,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

adminCommentsRouter.get(
  '/',
  query('status').optional().isIn(['pending', 'approved', 'rejected', 'spam']),
  query('search').optional().isLength({ min: 1, max: 120 }),
  validate,
  async (req, res, next) => {
    try {
      const params = [req.tenantId];
      let where = 'WHERE c.tenant_id = ?';

      if (req.query.status) {
        where += ' AND c.status = ?';
        params.push(req.query.status);
      }

      if (req.query.search) {
        where +=
          ' AND (c.author_name LIKE ? OR c.author_email LIKE ? OR c.content LIKE ? OR p.title LIKE ?)';
        const term = `%${req.query.search}%`;
        params.push(term, term, term, term);
      }

      const [comments, counts] = await Promise.all([
        db.query(
          `SELECT c.id, c.status, c.author_name, c.author_email, c.author_website, c.content,
                  c.moderation_reason, c.created_at, p.id AS post_id, p.slug AS post_slug, p.title AS post_title
           FROM comments c
           JOIN posts p ON p.id = c.post_id
           ${where}
           ORDER BY
             CASE c.status
               WHEN 'pending' THEN 0
               WHEN 'spam' THEN 1
               WHEN 'rejected' THEN 2
               ELSE 3
             END,
             c.created_at DESC`,
          params
        ),
        db.query(
          `SELECT status, COUNT(*) AS total
           FROM comments
           WHERE tenant_id = ?
           GROUP BY status`,
          [req.tenantId]
        ),
      ]);

      res.json({
        success: true,
        data: comments,
        meta: {
          counts: counts.reduce(
            (acc, row) => ({ ...acc, [row.status]: row.total }),
            { pending: 0, approved: 0, rejected: 0, spam: 0 }
          ),
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

adminCommentsRouter.post(
  '/:id/approve',
  requireRole('editor'),
  async (req, res, next) => {
    try {
      const comment = await requireComment(req.params.id, req.tenantId);
      await db.query(
        `UPDATE comments
       SET status = 'approved', moderation_reason = NULL, approved_at = NOW(), approved_by = ?
       WHERE id = ?`,
        [req.user.id, comment.id]
      );

      const post = await db.queryOne(
        'SELECT id, slug FROM posts WHERE id = ?',
        [comment.post_id]
      );
      if (post) {
        await webhookService.triggerRevalidation(
          req.tenantId,
          post.id,
          post.slug,
          'comment.approved'
        );
      }

      res.json({ success: true, message: 'Comment approved' });
    } catch (err) {
      next(err);
    }
  }
);

adminCommentsRouter.post(
  '/:id/reject',
  requireRole('editor'),
  body('reason').optional({ values: 'falsy' }).trim().isLength({ max: 255 }),
  validate,
  async (req, res, next) => {
    try {
      const comment = await requireComment(req.params.id, req.tenantId);
      const reason =
        sanitizePlainText(req.body.reason, 255) || 'Rejected by moderator';
      await db.query(
        `UPDATE comments
         SET status = 'rejected', moderation_reason = ?, approved_at = NULL, approved_by = NULL
         WHERE id = ?`,
        [reason, comment.id]
      );
      res.json({ success: true, message: 'Comment rejected' });
    } catch (err) {
      next(err);
    }
  }
);

adminCommentsRouter.delete(
  '/:id',
  requireRole('editor'),
  async (req, res, next) => {
    try {
      const comment = await requireComment(req.params.id, req.tenantId);
      await db.query('DELETE FROM comments WHERE id = ?', [comment.id]);
      res.json({ success: true, message: 'Comment deleted' });
    } catch (err) {
      next(err);
    }
  }
);

function supportsNativeComments(settings) {
  return (
    Boolean(settings?.enable_comments) &&
    (!settings?.comment_provider || settings.comment_provider === 'native')
  );
}

async function getCommentSettings(tenantId) {
  return db.queryOne(
    `SELECT enable_comments, comment_provider, comment_moderation, comments_per_page, comment_blocked_words
     FROM site_config
     WHERE tenant_id = ?`,
    [tenantId]
  );
}

async function getPublishedPostBySlug(tenantId, slug) {
  return db.queryOne(
    `SELECT p.id, p.slug
     FROM posts p
     JOIN post_status ps ON ps.post_id = p.id
       AND ps.status = 'published'
       AND ps.id = (SELECT id FROM post_status WHERE post_id = p.id ORDER BY id DESC LIMIT 1)
     WHERE p.tenant_id = ? AND p.slug = ?`,
    [tenantId, slug]
  );
}

async function requireComment(commentId, tenantId) {
  const comment = await db.queryOne(
    `SELECT id, post_id FROM comments WHERE id = ? AND tenant_id = ?`,
    [commentId, tenantId]
  );
  if (!comment) {
    throw new AppError('Comment not found', 404, 'COMMENT_NOT_FOUND');
  }
  return comment;
}

function resolveCommentModeration(settings, content, authorWebsite) {
  if (settings.comment_moderation === 'manual') {
    return {
      status: 'pending',
      publicStatus: 'pending',
      reason: 'Pending moderator review',
    };
  }

  if (settings.comment_moderation === 'auto') {
    const spamReason = detectSpam(
      content,
      authorWebsite,
      settings.comment_blocked_words
    );
    if (spamReason) {
      return { status: 'spam', publicStatus: 'pending', reason: spamReason };
    }
  }

  return { status: 'approved', publicStatus: 'approved', reason: null };
}

function detectSpam(content, authorWebsite, blockedWordsRaw) {
  const blockedWords = String(blockedWordsRaw || '')
    .split(/[\n,]/)
    .map(word => word.trim().toLowerCase())
    .filter(Boolean);
  const text = content.toLowerCase();
  const urlMatches = text.match(/https?:\/\/|www\./g) || [];

  if (authorWebsite && urlMatches.length >= 2) {
    return 'Too many promotional links';
  }

  if (urlMatches.length >= 3) {
    return 'Too many links in comment';
  }

  if (/(.)\1{7,}/.test(text)) {
    return 'Suspicious repeated characters';
  }

  const blockedMatch = blockedWords.find(word => text.includes(word));
  if (blockedMatch) {
    return `Blocked keyword: ${blockedMatch}`;
  }

  return null;
}

function hashIp(ipAddress) {
  return crypto
    .createHash('sha256')
    .update(
      `${process.env.COMMENT_IP_SALT || process.env.JWT_SECRET || 'comments'}:${ipAddress || 'unknown'}`
    )
    .digest('hex');
}

function buildMeta(page, perPage, total) {
  const totalPages = Math.ceil(total / perPage) || 1;
  return {
    page,
    per_page: perPage,
    total,
    total_pages: totalPages,
    has_prev: page > 1,
    has_next: page < totalPages,
  };
}

function emptyMeta(page, perPage, total) {
  return {
    page,
    per_page: perPage,
    total,
    total_pages: 0,
    has_prev: false,
    has_next: false,
  };
}

module.exports = { publicCommentsRouter, adminCommentsRouter };
