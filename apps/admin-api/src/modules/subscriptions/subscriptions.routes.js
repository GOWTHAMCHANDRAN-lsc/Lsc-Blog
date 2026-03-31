const crypto = require('crypto');
const express = require('express');
const { body, query, validationResult } = require('express-validator');
const db = require('../../config/database');
const { resolvePublicTenant } = require('../../middleware/publicTenant');
const { AppError } = require('../../utils/errors');
const { sanitizePlainText } = require('../../utils/sanitizeHtml');
const emailService = require('../../services/email.service');

const router = express.Router();

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

router.use(resolvePublicTenant);

// POST /api/v1/subscriptions/subscribe
router.post(
  '/subscribe',
  body('email').isEmail().normalizeEmail(),
  body('name').optional({ values: 'falsy' }).trim().isLength({ max: 255 }),
  validate,
  async (req, res, next) => {
    try {
      const email = String(req.body.email || '').toLowerCase();
      const name = sanitizePlainText(req.body.name, 255) || null;

      const rawConfirmToken = crypto.randomBytes(32).toString('hex');
      const confirmTokenHash = crypto
        .createHash('sha256')
        .update(rawConfirmToken)
        .digest('hex');
      const unsubscribeToken = crypto.randomBytes(24).toString('hex');

      await db.transaction(async trx => {
        const existing = await trx.queryOne(
          `SELECT id, status FROM subscribers WHERE tenant_id = ? AND email = ?`,
          [req.tenantId, email]
        );

        if (existing?.status === 'active') {
          return;
        }

        if (existing) {
          await trx.query(
            `UPDATE subscribers
             SET status = 'pending',
                 name = COALESCE(?, name),
                 confirm_token_hash = ?,
                 unsubscribe_token = ?,
                 confirmed_at = NULL
             WHERE id = ?`,
            [name, confirmTokenHash, unsubscribeToken, existing.id]
          );
          return;
        }

        await trx.query(
          `INSERT INTO subscribers
             (id, tenant_id, email, name, status, confirm_token_hash, unsubscribe_token)
           VALUES (UUID(), ?, ?, ?, 'pending', ?, ?)`,
          [req.tenantId, email, name, confirmTokenHash, unsubscribeToken]
        );
      });

      const baseUrl = resolvePublicBaseUrl(req);
      const confirmUrl = `${baseUrl}/subscribe/confirm?token=${rawConfirmToken}`;

      await emailService.sendMail({
        to: email,
        subject: 'Confirm your subscription',
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.5">
            <h2>Confirm your subscription</h2>
            <p>Click the button below to confirm your email and start receiving updates.</p>
            <p>
              <a href="${confirmUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 14px;border-radius:8px;text-decoration:none">
                Confirm subscription
              </a>
            </p>
            <p style="color:#64748b;font-size:12px">If you did not request this, you can ignore this email.</p>
          </div>
        `,
        text: `Confirm your subscription: ${confirmUrl}`,
      });

      res.status(201).json({
        success: true,
        data: {
          status: 'pending',
          message: 'Check your email to confirm your subscription.',
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/subscriptions/confirm?token=...
router.get(
  '/confirm',
  query('token').isLength({ min: 10 }),
  validate,
  async (req, res, next) => {
    try {
      const token = String(req.query.token || '');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      const subscriber = await db.queryOne(
        `SELECT id, status FROM subscribers WHERE tenant_id = ? AND confirm_token_hash = ?`,
        [req.tenantId, tokenHash]
      );
      if (!subscriber) {
        throw new AppError(
          'Invalid or expired confirmation token',
          400,
          'INVALID_TOKEN'
        );
      }

      if (subscriber.status === 'active') {
        return res.json({ success: true, data: { status: 'active' } });
      }

      await db.query(
        `UPDATE subscribers
         SET status = 'active', confirmed_at = NOW(), confirm_token_hash = NULL
         WHERE id = ?`,
        [subscriber.id]
      );

      res.json({
        success: true,
        data: { status: 'active', message: 'Subscription confirmed.' },
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/subscriptions/unsubscribe?token=...
router.get(
  '/unsubscribe',
  query('token').isLength({ min: 10 }),
  validate,
  async (req, res, next) => {
    try {
      const token = String(req.query.token || '');
      const subscriber = await db.queryOne(
        `SELECT id FROM subscribers WHERE tenant_id = ? AND unsubscribe_token = ?`,
        [req.tenantId, token]
      );
      if (!subscriber) {
        throw new AppError('Invalid unsubscribe token', 400, 'INVALID_TOKEN');
      }

      await db.query(
        `UPDATE subscribers SET status = 'unsubscribed' WHERE id = ?`,
        [subscriber.id]
      );

      res.json({
        success: true,
        data: {
          status: 'unsubscribed',
          message: 'You have been unsubscribed.',
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;

function resolvePublicBaseUrl(req) {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const proto =
    (typeof forwardedProto === 'string' && forwardedProto.split(',')[0]) ||
    req.protocol ||
    'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  if (!host) {
    return 'https://localhost';
  }
  return `${proto}://${String(host).split(',')[0]}`;
}
