const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../../config/database');
const cache = require('../../config/redis');
const { AppError } = require('../../utils/errors');

class AuthService {
  async _getUserByEmail(email) {
    return db.queryOne(
      `SELECT id, email, password_hash, name, system_role, is_active, email_verified
       FROM users
       WHERE email = ?`,
      [email]
    );
  }

  async _getUserById(userId) {
    return db.queryOne(
      `SELECT id, email, name, system_role, is_active
       FROM users
       WHERE id = ?`,
      [userId]
    );
  }

  async _resolveTenantContext(user, tenantId = null) {
    if (tenantId) {
      const tenant = await db.queryOne(
        `SELECT id, name
         FROM tenants
         WHERE id = ? AND deleted_at IS NULL`,
        [tenantId]
      );

      if (!tenant) {
        throw new AppError('Tenant not found', 404, 'TENANT_NOT_FOUND');
      }

      const membership = await db.queryOne(
        `SELECT role
         FROM tenant_users
         WHERE tenant_id = ? AND user_id = ?`,
        [tenantId, user.id]
      );

      if (membership) {
        return {
          tenantId,
          tenantRole: membership.role,
          tenantName: tenant.name,
        };
      }

      if (user.system_role === 'super_admin') {
        return { tenantId, tenantRole: 'admin', tenantName: tenant.name };
      }

      throw new AppError(
        'Access to this tenant is not allowed',
        403,
        'TENANT_FORBIDDEN'
      );
    }

    const membership = await db.queryOne(
      `SELECT tu.tenant_id, tu.role, t.name AS tenant_name
       FROM tenant_users tu
       JOIN tenants t ON t.id = tu.tenant_id
       WHERE tu.user_id = ? AND t.deleted_at IS NULL
       ORDER BY tu.joined_at ASC
       LIMIT 1`,
      [user.id]
    );

    if (membership) {
      return {
        tenantId: membership.tenant_id,
        tenantRole: membership.role,
        tenantName: membership.tenant_name,
      };
    }

    if (user.system_role === 'super_admin') {
      const tenant = await db.queryOne(
        `SELECT id, name
         FROM tenants
         WHERE deleted_at IS NULL
         ORDER BY created_at ASC
         LIMIT 1`
      );

      if (tenant) {
        return {
          tenantId: tenant.id,
          tenantRole: 'admin',
          tenantName: tenant.name,
        };
      }
    }

    return { tenantId: null, tenantRole: null, tenantName: null };
  }

  _buildUserPayload(user, tenantContext) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      systemRole: user.system_role,
      tenantId: tenantContext.tenantId,
      tenantRole: tenantContext.tenantRole,
      tenantName: tenantContext.tenantName,
    };
  }

  async _issueSession(user, tenantContext, refreshToken = null) {
    const payload = this._buildUserPayload(user, tenantContext);
    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    });

    const resolvedRefreshToken = refreshToken || uuidv4();
    await cache.setex(
      `refresh:${resolvedRefreshToken}`,
      7 * 24 * 3600,
      JSON.stringify({ userId: user.id, tenantId: tenantContext.tenantId })
    );

    return {
      accessToken,
      refreshToken: resolvedRefreshToken,
      user: payload,
    };
  }

  async login(email, password, tenantId = null) {
    const user = await this._getUserByEmail(email);

    if (!user || !user.is_active) {
      throw new AppError(
        'Invalid email or password',
        401,
        'INVALID_CREDENTIALS'
      );
    }

    const validPassword = bcrypt.compareSync(password, user.password_hash);
    if (!validPassword) {
      throw new AppError(
        'Invalid email or password',
        401,
        'INVALID_CREDENTIALS'
      );
    }

    const tenantContext = await this._resolveTenantContext(user, tenantId);
    await db.query(`UPDATE users SET last_login_at = NOW() WHERE id = ?`, [
      user.id,
    ]);

    return this._issueSession(user, tenantContext);
  }

  async refreshToken(refreshToken) {
    const data = await cache.get(`refresh:${refreshToken}`);
    if (!data) {
      throw new AppError(
        'Invalid or expired refresh token',
        401,
        'INVALID_REFRESH_TOKEN'
      );
    }

    const user = await this._getUserById(data.userId);
    if (!user || !user.is_active) {
      throw new AppError('User not found or inactive', 401, 'UNAUTHORIZED');
    }

    const tenantContext = await this._resolveTenantContext(user, data.tenantId);
    const payload = this._buildUserPayload(user, tenantContext);
    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    });

    const newRefreshToken = uuidv4();
    await cache.setex(
      `refresh:${newRefreshToken}`,
      7 * 24 * 3600,
      JSON.stringify({ userId: user.id, tenantId: tenantContext.tenantId })
    );

    await cache.del(`refresh:${refreshToken}`);

    return { accessToken, refreshToken: newRefreshToken, user: payload };
  }

  async switchTenant(userId, systemRole, tenantId, refreshToken) {
    const user = await this._getUserById(userId);
    if (!user || !user.is_active) {
      throw new AppError('User not found or inactive', 401, 'UNAUTHORIZED');
    }

    // Validate tenant exists and is not deleted
    const tenant = await db.queryOne(
      `SELECT id, name FROM tenants WHERE id = ? AND deleted_at IS NULL`,
      [tenantId]
    );
    if (!tenant) {
      throw new AppError(
        'Tenant not found or has been deleted',
        404,
        'TENANT_NOT_FOUND'
      );
    }

    user.system_role = systemRole || user.system_role;
    const tenantContext = await this._resolveTenantContext(user, tenantId);

    const refreshData = await cache.get(`refresh:${refreshToken}`);
    if (refreshData?.userId !== userId) {
      throw new AppError(
        'Invalid refresh token for tenant switch',
        401,
        'INVALID_REFRESH_TOKEN'
      );
    }

    return this._issueSession(user, tenantContext, refreshToken);
  }

  async logout(refreshToken) {
    if (refreshToken) {
      await cache.del(`refresh:${refreshToken}`);
    }
  }

  async register(userData) {
    const { email, password, name } = userData;

    const existing = await db.queryOne('SELECT id FROM users WHERE email = ?', [
      email,
    ]);
    if (existing) {
      throw new AppError('Email already registered', 409, 'EMAIL_EXISTS');
    }

    const passwordHash = bcrypt.hashSync(password, 12);
    const userId = uuidv4();

    await db.query(
      `INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)`,
      [userId, email, passwordHash, name]
    );

    return { id: userId, email, name };
  }
}

module.exports = new AuthService();
