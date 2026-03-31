const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../../config/database');
const cache = require('../../config/redis');
const { authenticate, requireRole } = require('../../middleware/auth');
const { resolveTenantFromJWT } = require('../../middleware/tenantResolver');
const { AppError } = require('../../utils/errors');

router.use(authenticate, resolveTenantFromJWT);

// GET /admin/v1/api-tokens
router.get('/', requireRole('admin'), async (req, res, next) => {
  try {
    const tokens = await db.query(
      `
      SELECT id, name, token_prefix, scopes, rate_limit_rpm,
             expires_at, last_used_at, is_active, created_at
      FROM api_tokens WHERE tenant_id = ? ORDER BY created_at DESC`,
      [req.tenantId]
    );
    const normalizedTokens = tokens.map(token => ({
      ...token,
      scopes: parseScopes(token.scopes),
      is_active: Boolean(token.is_active),
    }));
    res.json({ success: true, data: normalizedTokens });
  } catch (err) {
    next(err);
  }
});

// POST /admin/v1/api-tokens
router.post('/', requireRole('admin'), async (req, res, next) => {
  try {
    const {
      name,
      scopes = ['posts:read', 'config:read'],
      rateLimitRpm = 300,
      expiresAt,
    } = req.body;
    if (!name) throw new AppError('Token name required', 400);

    // Generate a secure token: prefix_randomhex
    const rawToken = `sbp_${crypto.randomBytes(32).toString('hex')}`;
    const prefix = rawToken.substring(0, 8);
    const tokenHash = bcrypt.hashSync(rawToken, 10);
    const id = uuidv4();

    await db.query(
      `
      INSERT INTO api_tokens
        (id, tenant_id, name, token_hash, token_prefix, scopes, rate_limit_rpm, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        req.tenantId,
        name,
        tokenHash,
        prefix,
        JSON.stringify(scopes),
        rateLimitRpm,
        expiresAt || null,
      ]
    );

    // Return token ONCE — never stored in plaintext
    res.status(201).json({
      success: true,
      data: {
        id,
        name,
        token: rawToken,
        prefix,
        scopes,
        message: 'Copy this token now — it will not be shown again.',
      },
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /admin/v1/api-tokens/:id
router.delete('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const token = await db.queryOne(
      `SELECT id, token_prefix FROM api_tokens WHERE id = ? AND tenant_id = ?`,
      [req.params.id, req.tenantId]
    );
    if (!token) throw new AppError('Token not found', 404);

    await db.query(`UPDATE api_tokens SET is_active = 0 WHERE id = ?`, [
      req.params.id,
    ]);
    await cache.del(`token:${token.token_prefix}`); // bust auth cache
    res.json({ success: true, message: 'Token revoked' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

function parseScopes(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== 'string') {
    return [];
  }

  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}
