const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../../config/database');
const { authenticate, requireRole } = require('../../middleware/auth');
const { resolveTenantFromJWT } = require('../../middleware/tenantResolver');
const { AppError } = require('../../utils/errors');
const {
  sanitizePlainText,
  sanitizeEmbedMarkup,
} = require('../../utils/sanitizeHtml');
const { enqueueCampaignSend } = require('../../jobs/newsletter');

const router = express.Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(422).json({ success: false, errors: errors.array() });
  next();
};

router.use(authenticate, resolveTenantFromJWT, requireRole('admin'));

// GET /admin/v1/subscribers
router.get('/subscribers', async (req, res, next) => {
  try {
    const status = req.query.status;
    const search = String(req.query.search || '').trim();
    const params = [req.tenantId];
    let where = 'WHERE tenant_id = ?';

    if (status && ['pending', 'active', 'unsubscribed'].includes(status)) {
      where += ' AND status = ?';
      params.push(status);
    }

    if (search) {
      where += ' AND (email LIKE ? OR name LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term);
    }

    const rows = await db.query(
      `SELECT id, email, name, status, confirmed_at, created_at
       FROM subscribers
       ${where}
       ORDER BY created_at DESC
       LIMIT 500`,
      params
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// GET /admin/v1/campaigns
router.get('/campaigns', async (req, res, next) => {
  try {
    const rows = await db.query(
      `SELECT id, subject, preview_text, status, scheduled_at, sent_at, created_at, updated_at
       FROM newsletter_campaigns
       WHERE tenant_id = ?
       ORDER BY created_at DESC`,
      [req.tenantId]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// POST /admin/v1/campaigns
router.post(
  '/campaigns',
  body('subject').trim().isLength({ min: 3, max: 255 }),
  body('preview_text')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 255 }),
  body('html').notEmpty(),
  validate,
  async (req, res, next) => {
    try {
      const subject = sanitizePlainText(req.body.subject, 255);
      const previewText = sanitizePlainText(req.body.preview_text, 255) || null;
      const html = sanitizeEmbedMarkup(req.body.html) || '';
      if (!subject || !html) {
        throw new AppError(
          'Subject and HTML are required',
          422,
          'INVALID_CAMPAIGN'
        );
      }

      const id = cryptoId();
      await db.query(
        `INSERT INTO newsletter_campaigns (id, tenant_id, subject, preview_text, html, status)
         VALUES (?, ?, ?, ?, ?, 'draft')`,
        [id, req.tenantId, subject, previewText, html]
      );
      res.status(201).json({ success: true, data: { id } });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /admin/v1/campaigns/:id
router.put(
  '/campaigns/:id',
  body('subject').optional().trim().isLength({ min: 3, max: 255 }),
  body('preview_text')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 255 }),
  body('html').optional().isString(),
  validate,
  async (req, res, next) => {
    try {
      const campaign = await db.queryOne(
        `SELECT id FROM newsletter_campaigns WHERE id = ? AND tenant_id = ?`,
        [req.params.id, req.tenantId]
      );
      if (!campaign) {
        throw new AppError('Campaign not found', 404, 'NOT_FOUND');
      }

      const updates = [];
      const params = [];
      if (req.body.subject !== undefined) {
        updates.push('subject = ?');
        params.push(sanitizePlainText(req.body.subject, 255));
      }
      if (req.body.preview_text !== undefined) {
        updates.push('preview_text = ?');
        params.push(sanitizePlainText(req.body.preview_text, 255) || null);
      }
      if (req.body.html !== undefined) {
        updates.push('html = ?');
        params.push(sanitizeEmbedMarkup(req.body.html) || '');
      }
      if (!updates.length) {
        return res
          .status(400)
          .json({
            success: false,
            error: { message: 'No valid fields provided' },
          });
      }
      params.push(req.params.id, req.tenantId);

      await db.query(
        `UPDATE newsletter_campaigns SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`,
        params
      );
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

// POST /admin/v1/campaigns/:id/send
router.post('/campaigns/:id/send', async (req, res, next) => {
  try {
    const campaign = await db.queryOne(
      `SELECT id, status FROM newsletter_campaigns WHERE id = ? AND tenant_id = ?`,
      [req.params.id, req.tenantId]
    );
    if (!campaign) {
      throw new AppError('Campaign not found', 404, 'NOT_FOUND');
    }
    if (!['draft', 'scheduled', 'failed'].includes(campaign.status)) {
      throw new AppError(
        `Campaign cannot be sent from status ${campaign.status}`,
        422,
        'INVALID_STATUS'
      );
    }

    await db.query(
      `UPDATE newsletter_campaigns SET status = 'sending', scheduled_at = NULL WHERE id = ?`,
      [campaign.id]
    );

    const enqueued = await enqueueCampaignSend(
      req.tenantId,
      campaign.id,
      req.user.id
    );
    res.json({ success: true, data: { enqueued } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

function cryptoId() {
  return require('crypto').randomUUID();
}
