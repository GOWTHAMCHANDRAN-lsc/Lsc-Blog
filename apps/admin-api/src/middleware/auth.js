const jwt = require('jsonwebtoken');
const { AppError } = require('../utils/errors');

/**
 * Verifies JWT from Authorization: Bearer <token> header
 * Attaches req.user = { id, email, systemRole, tenantId, role }
 */
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new AppError('Token has expired', 401, 'TOKEN_EXPIRED'));
    }
    return next(new AppError('Invalid token', 401, 'INVALID_TOKEN'));
  }
};

/**
 * Require specific system role (super_admin check)
 */
const requireSystemRole =
  (...roles) =>
  (req, res, next) => {
    if (!req.user)
      return next(new AppError('Unauthorized', 401, 'UNAUTHORIZED'));
    if (!roles.includes(req.user.systemRole)) {
      return next(new AppError('Insufficient permissions', 403, 'FORBIDDEN'));
    }
    next();
  };

/**
 * Require minimum tenant role
 * Role hierarchy: admin > editor > author > viewer
 */
const ROLE_LEVELS = {
  super_admin: 99,
  admin: 4,
  editor: 3,
  author: 2,
  viewer: 1,
};

const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (!req.user)
      return next(new AppError('Unauthorized', 401, 'UNAUTHORIZED'));
    if (req.user.systemRole === 'super_admin') return next(); // super admin bypasses all

    const userLevel = ROLE_LEVELS[req.user.tenantRole] || 0;
    const minRequired = Math.min(...roles.map(r => ROLE_LEVELS[r] || 99));

    if (userLevel < minRequired) {
      return next(new AppError('Insufficient permissions', 403, 'FORBIDDEN'));
    }
    next();
  };

module.exports = { authenticate, requireSystemRole, requireRole };
