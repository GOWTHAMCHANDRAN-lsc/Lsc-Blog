// ─── users.routes.js ─────────────────────────────────────────────────────────
const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const db = require('../../config/database');
const { authenticate, requireRole } = require('../../middleware/auth');
const { resolveTenantFromJWT } = require('../../middleware/tenantResolver');
const { AppError } = require('../../utils/errors');
const { sendMail } = require('../../services/email.service');

const router = express.Router();
router.use(authenticate, resolveTenantFromJWT);

// GET /admin/v1/users — list users in tenant
router.get('/', async (req, res, next) => {
  try {
    const users = await db.query(
      `
      SELECT u.id, u.email, u.name, u.avatar_url, u.last_login_at, u.is_active,
             tu.role, tu.joined_at
      FROM tenant_users tu
      JOIN users u ON u.id = tu.user_id
      WHERE tu.tenant_id = ?
      ORDER BY tu.joined_at DESC`,
      [req.tenantId]
    );
    res.json({ success: true, data: users });
  } catch (err) {
    next(err);
  }
});

// GET /admin/v1/users/me — get current user info
router.get('/me', async (req, res, next) => {
  try {
    const user = await db.queryOne(
      `SELECT id, email, name, avatar_url, last_login_at, is_active
       FROM users WHERE id = ?`,
      [req.user.id]
    );
    if (!user) throw new AppError('User not found', 404);
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

// PUT /admin/v1/users/me/password — change current user's password
router.put('/me/password', async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      throw new AppError('Current password and new password are required', 400);
    }

    if (newPassword.length < 8) {
      throw new AppError('New password must be at least 8 characters', 400);
    }

    const user = await db.queryOne(
      `SELECT id, password_hash FROM users WHERE id = ?`,
      [req.user.id]
    );

    if (!user) {
      throw new AppError('User not found', 404);
    }

    const isValid = bcrypt.compareSync(currentPassword, user.password_hash);
    if (!isValid) {
      throw new AppError('Current password is incorrect', 401);
    }

    const newHash = bcrypt.hashSync(newPassword, 12);
    await db.query(
      `UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?`,
      [newHash, req.user.id]
    );

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    next(err);
  }
});

// POST /admin/v1/users/create — create user directly (super_admin only)
router.post('/create', requireRole('super_admin'), async (req, res, next) => {
  try {
    const { name, email, password, role = 'author' } = req.body;

    if (!name || !email || !password) {
      throw new AppError('Name, email, and password are required', 400);
    }

    if (password.length < 8) {
      throw new AppError('Password must be at least 8 characters', 400);
    }

    const existingUser = await db.queryOne(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );
    if (existingUser) {
      throw new AppError('User with this email already exists', 409);
    }

    const passwordHash = bcrypt.hashSync(password, 12);
    const userId = uuidv4();

    await db.query(
      `INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)`,
      [userId, email, passwordHash, name]
    );

    const existing = await db.queryOne(
      `SELECT id FROM tenant_users WHERE tenant_id = ? AND user_id = ?`,
      [req.tenantId, userId]
    );

    if (!existing) {
      await db.query(
        `INSERT INTO tenant_users (id, tenant_id, user_id, role) VALUES (UUID(), ?, ?, ?)`,
        [req.tenantId, userId, role]
      );
    }

    res
      .status(201)
      .json({ success: true, message: 'User created successfully' });
  } catch (err) {
    next(err);
  }
});

// POST /admin/v1/users/invite
router.post('/invite', requireRole('admin'), async (req, res, next) => {
  try {
    const { email, role = 'author', name } = req.body;
    if (!email) throw new AppError('Email required', 400);

    let user = await db.queryOne('SELECT id FROM users WHERE email = ?', [
      email,
    ]);
    let tempPasswordPlain = null;
    if (!user) {
      tempPasswordPlain = crypto.randomBytes(8).toString('hex'); // Generate secure temp password
      const tempPasswordHash = bcrypt.hashSync(tempPasswordPlain, 10);
      user = { id: uuidv4() };
      await db.query(
        `INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)`,
        [user.id, email, tempPasswordHash, name || email.split('@')[0]]
      );
    }

    const existing = await db.queryOne(
      `SELECT id FROM tenant_users WHERE tenant_id = ? AND user_id = ?`,
      [req.tenantId, user.id]
    );
    if (existing) throw new AppError('User already in this workspace', 409);

    await db.query(
      `INSERT INTO tenant_users (id, tenant_id, user_id, role) VALUES (UUID(), ?, ?, ?)`,
      [req.tenantId, user.id, role]
    );

    // Send invitation email if new user
    if (tempPasswordPlain) {
      const tenant = await db.queryOne(
        'SELECT name FROM tenants WHERE id = ?',
        [req.tenantId]
      );
      const subject = `You're invited to join ${tenant.name}`;
      const html = `
        <h1>Welcome to ${tenant.name}!</h1>
        <p>You've been invited to join the team.</p>
        <p><strong>Your temporary password:</strong> ${tempPasswordPlain}</p>
        <p>Please log in and change your password immediately.</p>
        <p>Login at: http://localhost:3000/login</p>
      `;
      const text = `Welcome to ${tenant.name}! You've been invited. Temporary password: ${tempPasswordPlain}. Login at http://localhost:3000/login and change your password.`;

      try {
        await sendMail({ to: email, subject, html, text });
      } catch (emailErr) {
        // Log the password for development purposes
        console.log(
          `Invitation for ${email}: Temporary password is ${tempPasswordPlain}`
        );
        console.error('Failed to send invitation email:', emailErr);
        // Don't fail the invite if email fails
      }
    }

    res
      .status(201)
      .json({ success: true, message: 'User invited successfully' });
  } catch (err) {
    next(err);
  }
});

// PUT /admin/v1/users/:id/role
router.put('/:id/role', requireRole('admin'), async (req, res, next) => {
  try {
    const { role } = req.body;
    const validRoles = ['admin', 'editor', 'author', 'viewer'];
    if (!validRoles.includes(role)) throw new AppError('Invalid role', 400);
    await db.query(
      `UPDATE tenant_users SET role = ? WHERE tenant_id = ? AND user_id = ?`,
      [role, req.tenantId, req.params.id]
    );
    res.json({ success: true, message: 'Role updated' });
  } catch (err) {
    next(err);
  }
});

// DELETE /admin/v1/users/:id
router.delete('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    await db.query(
      `DELETE FROM tenant_users WHERE tenant_id = ? AND user_id = ?`,
      [req.tenantId, req.params.id]
    );
    res.json({ success: true, message: 'User removed from workspace' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
