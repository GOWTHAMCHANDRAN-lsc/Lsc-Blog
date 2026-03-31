const bcrypt = require('bcryptjs');
const db = require('../config/database');
const cache = require('../config/redis');
const { AppError } = require('../utils/errors');

/**
 * Authenticates blog site requests using X-API-Token header.
 * Resolves tenant_id from the token and applies per-token rate limiting.
 */
const apiTokenAuth = async (req, res, next) => {
  const apiToken = req.headers['x-api-token'];
  if (!apiToken || apiToken.length < 8) {
    return next(
      new AppError('Valid API token required', 401, 'INVALID_API_TOKEN')
    );
  }

  const prefix = apiToken.substring(0, 8);
  const cacheKey = `token:${prefix}`;

  try {
    let tokenRecord = await cache.get(cacheKey);

    if (!tokenRecord) {
      // Fetch all active tokens with this prefix (should be 1)
      const records = await db.query(
        `SELECT id, tenant_id, token_hash, scopes, rate_limit_rpm
         FROM api_tokens
         WHERE token_prefix = ? AND is_active = 1
           AND (expires_at IS NULL OR expires_at > NOW())`,
        [prefix]
      );

      // Verify full token against hash
      tokenRecord = null;
      for (const rec of records) {
        if (bcrypt.compareSync(apiToken, rec.token_hash)) {
          tokenRecord = rec;
          break;
        }
      }

      if (!tokenRecord) {
        return next(
          new AppError('Invalid or expired API token', 401, 'INVALID_API_TOKEN')
        );
      }

      // Cache for 1 hour
      await cache.setex(cacheKey, 3600, tokenRecord);

      // Update last_used_at asynchronously
      db.query('UPDATE api_tokens SET last_used_at = NOW() WHERE id = ?', [
        tokenRecord.id,
      ]).catch(() => {}); // non-blocking
    }

    // ── Rate limiting (sliding window per token) ──────────────────────────
    const rateLimitKey = `ratelimit:${tokenRecord.id}`;
    const requests = await cache.incr(rateLimitKey);
    if (requests === 1) await cache.expire(rateLimitKey, 60);

    const limit = tokenRecord.rate_limit_rpm || 300;
    if (requests > limit) {
      res.set({
        'X-RateLimit-Limit': limit,
        'X-RateLimit-Remaining': 0,
        'Retry-After': await cache.ttl(rateLimitKey),
      });
      return next(
        new AppError('Rate limit exceeded', 429, 'RATE_LIMIT_EXCEEDED')
      );
    }

    res.set({
      'X-RateLimit-Limit': limit,
      'X-RateLimit-Remaining': Math.max(0, limit - requests),
    });

    req.tenantId = tokenRecord.tenant_id;
    req.tokenScopes = Array.isArray(tokenRecord.scopes)
      ? tokenRecord.scopes
      : JSON.parse(tokenRecord.scopes || '[]');

    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Check token has required scope
 */
const requireScope = scope => (req, res, next) => {
  if (!req.tokenScopes?.includes(scope)) {
    return next(
      new AppError(`Scope '${scope}' required`, 403, 'INSUFFICIENT_SCOPE')
    );
  }
  next();
};

/**
 * Like requireScope, but only enforced when a request was authenticated via API token.
 * Domain-resolved public requests (no API token) are allowed through.
 */
const requireScopeIfToken = scope => (req, res, next) => {
  if (!req.tokenScopes) {
    return next();
  }
  return requireScope(scope)(req, res, next);
};

module.exports = { apiTokenAuth, requireScope, requireScopeIfToken };
