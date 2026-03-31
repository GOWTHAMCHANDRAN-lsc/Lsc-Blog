// tenants.service.js
const { v4: uuidv4 } = require('uuid');
const db = require('../../config/database');
const cache = require('../../config/redis');
const { slugify } = require('../../utils/slugify');
const { AppError } = require('../../utils/errors');

class TenantsService {
  async listTenants({ page = 1, perPage = 20, status, search } = {}) {
    const offset = (page - 1) * perPage;
    const params = [];
    let where = 'WHERE deleted_at IS NULL';
    if (status) {
      where += ' AND status = ?';
      params.push(status);
    }
    if (search) {
      where += ' AND (name LIKE ? OR slug LIKE ? OR custom_domain LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const [tenants, [{ total }]] = await Promise.all([
      db.query(
        `
        SELECT t.*, u.name AS owner_name, u.email AS owner_email,
               (SELECT COUNT(*) FROM posts WHERE tenant_id = t.id) AS post_count,
               (SELECT COUNT(*) FROM tenant_users WHERE tenant_id = t.id) AS user_count
        FROM tenants t
        LEFT JOIN users u ON u.id = t.owner_id
        ${where} ORDER BY t.created_at DESC LIMIT ? OFFSET ?`,
        [...params, perPage, offset]
      ),
      db.query(`SELECT COUNT(*) AS total FROM tenants ${where}`, params),
    ]);

    return {
      data: tenants,
      meta: {
        page,
        per_page: perPage,
        total,
        total_pages: Math.ceil(total / perPage),
      },
    };
  }

  async getTenantById(id) {
    const tenant = await db.queryOne(
      `SELECT t.*, u.name AS owner_name FROM tenants t LEFT JOIN users u ON u.id = t.owner_id
       WHERE t.id = ? AND t.deleted_at IS NULL`,
      [id]
    );
    if (tenant?.allowed_origins) {
      try {
        tenant.allowed_origins = JSON.parse(tenant.allowed_origins);
      } catch {
        tenant.allowed_origins = [];
      }
    }
    return tenant;
  }

  async createTenant({
    name,
    slug,
    customDomain,
    plan = 'starter',
    ownerId,
    blogUrl,
    blogApiKey,
    allowedOrigins,
  }) {
    const tenantSlug = slug || slugify(name);
    const existing = await db.queryOne(
      'SELECT id FROM tenants WHERE slug = ?',
      [tenantSlug]
    );
    if (existing)
      throw new AppError(
        'A tenant with this slug already exists',
        409,
        'SLUG_EXISTS'
      );

    const id = uuidv4();
    await db.transaction(async trx => {
      await trx.query(
        `INSERT INTO tenants (id, name, slug, custom_domain, plan, status, owner_id, blog_url, blog_api_key, allowed_origins)
         VALUES (?, ?, ?, ?, ?, 'trial', ?, ?, ?, ?)`,
        [
          id,
          name,
          tenantSlug,
          customDomain || null,
          plan,
          ownerId || null,
          blogUrl || null,
          blogApiKey || null,
          allowedOrigins ? JSON.stringify(allowedOrigins) : null,
        ]
      );
      // Seed default site config
      await trx.query(
        `INSERT INTO site_config (id, tenant_id, site_name, posts_per_page) VALUES (UUID(), ?, ?, 10)`,
        [id, name]
      );
      // Make owner an admin
      if (ownerId) {
        await trx.query(
          `INSERT INTO tenant_users (id, tenant_id, user_id, role, joined_at) VALUES (UUID(), ?, ?, 'admin', NOW())`,
          [id, ownerId]
        );
      }
    });

    return this.getTenantById(id);
  }

  async updateTenant(id, data) {
    const fields = ['name', 'custom_domain', 'plan', 'status'];
    const updates = [],
      params = [];
    fields.forEach(f => {
      if (data[f] !== undefined) {
        updates.push(`${f} = ?`);
        params.push(data[f]);
      }
    });
    if (!updates.length) return this.getTenantById(id);
    params.push(id);
    await db.query(
      `UPDATE tenants SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    await cache.del(`tenant:${id}`);
    await cache.invalidatePattern('domain_map:*');
    return this.getTenantById(id);
  }

  async deleteTenant(id) {
    await db.query(`UPDATE tenants SET deleted_at = NOW() WHERE id = ?`, [id]);
    await cache.del(`tenant:${id}`);
  }

  async getTenantStats(tenantId) {
    const [posts, users, views] = await Promise.all([
      db.query(
        `
        SELECT ps.status, COUNT(*) AS count FROM posts p
        JOIN post_status ps ON ps.post_id = p.id
          AND ps.id = (SELECT id FROM post_status WHERE post_id = p.id ORDER BY id DESC LIMIT 1)
        WHERE p.tenant_id = ? GROUP BY ps.status`,
        [tenantId]
      ),
      db.queryOne(
        `SELECT COUNT(*) AS count FROM tenant_users WHERE tenant_id = ?`,
        [tenantId]
      ),
      db.queryOne(
        `SELECT COUNT(*) AS count FROM analytics_pageviews
         WHERE tenant_id = ? AND viewed_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
        [tenantId]
      ),
    ]);
    const postsByStatus = Object.fromEntries(
      posts.map(p => [p.status, p.count])
    );
    return { posts: postsByStatus, users: users.count, views_30d: views.count };
  }
}

module.exports = new TenantsService();
