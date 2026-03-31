const { apiTokenAuth } = require('./apiToken');
const { resolveTenantFromDomain } = require('./tenantResolver');

/**
 * Public tenant resolver for blog-facing endpoints.
 *
 * Supports two modes:
 * - Partner/API mode: `X-API-Token` authenticates and sets `req.tenantId`
 * - Domain mode: resolves tenant from `Host` / `X-Tenant-Domain`
 *
 * This enables one shared blog frontend to serve many tenants and custom domains,
 * while keeping the existing token-based access for integrations.
 */
async function resolvePublicTenant(req, res, next) {
  const apiToken = req.headers['x-api-token'];
  if (typeof apiToken === 'string' && apiToken.trim().length >= 8) {
    return apiTokenAuth(req, res, next);
  }

  return resolveTenantFromDomain(req, res, next);
}

module.exports = { resolvePublicTenant };
