const db = require('../config/database');
const cache = require('../config/redis');
const { AppError } = require('../utils/errors');

/**
 * Resolves the tenant from the Host header (for domain-based routing).
 * Populates req.tenant = { id, slug, name, plan, status }
 * Used by admin dashboard routes to scope requests to the correct tenant.
 */
const resolveTenantFromDomain = async (req, res, next) => {
  const host = req.headers['x-tenant-domain'] || req.hostname;
  if (!host) return next();

  const cacheKey = `domain_map:${host}`;
  let tenant = await cache.get(cacheKey);

  if (!tenant) {
    // Match custom domain or subdomain
    tenant = await db.queryOne(
      `SELECT id, slug, name, plan, status FROM tenants
       WHERE (custom_domain = ? OR CONCAT(slug, '.', ?) = ?)
         AND status = 'active' AND deleted_at IS NULL`,
      [host, process.env.PLATFORM_DOMAIN || 'platform.com', host]
    );

    if (!tenant) {
      return next(
        new AppError(
          'Tenant not found for this domain',
          404,
          'TENANT_NOT_FOUND'
        )
      );
    }

    await cache.setex(cacheKey, 3600, tenant); // cache 1 hour
  }

  req.tenant = tenant;
  req.tenantId = tenant.id;
  next();
};

/**
 * Resolves tenant from JWT claim (for admin dashboard requests).
 * The JWT payload includes tenantId from login/switch context.
 */
const resolveTenantFromJWT = async (req, res, next) => {
  // req.user is set by auth middleware
  if (!req.user) return next(new AppError('Authenticated user required', 401));

  let tenantId = req.params.tenantId || req.user.tenantId;
  let tenant = null;

  if (!tenantId) {
    tenant = await db.queryOne(
      `SELECT t.*, tu.role AS user_role
       FROM tenant_users tu
       JOIN tenants t ON t.id = tu.tenant_id
       WHERE tu.user_id = ? AND t.deleted_at IS NULL
       ORDER BY tu.joined_at ASC
       LIMIT 1`,
      [req.user.id]
    );

    if (!tenant) return next(); // super_admin cross-tenant requests with no memberships
    tenantId = tenant.id;
  }

  const cacheKey = `tenant:${tenantId}`;
  if (!tenant) {
    tenant = await cache.get(cacheKey);
  }

  if (!tenant) {
    tenant = await db.queryOne(
      `SELECT t.*, tu.role AS user_role
       FROM tenants t
       JOIN tenant_users tu ON tu.tenant_id = t.id AND tu.user_id = ?
       WHERE t.id = ? AND t.deleted_at IS NULL`,
      [req.user.id, tenantId]
    );

    if (!tenant && req.user.systemRole !== 'super_admin') {
      return next(
        new AppError(
          'Access to this tenant denied',
          403,
          'TENANT_ACCESS_DENIED'
        )
      );
    }

    if (tenant) {
      await cache.setex(cacheKey, 300, tenant);
    }
  }

  req.tenant = tenant;
  req.tenantId = tenantId;
  req.user.tenantId = tenantId;
  req.user.tenantRole = tenant?.user_role;
  next();
};

module.exports = { resolveTenantFromDomain, resolveTenantFromJWT };
