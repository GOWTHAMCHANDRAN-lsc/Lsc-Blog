const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const { authenticate, requireRole } = require('../../middleware/auth');
const { resolveTenantFromJWT } = require('../../middleware/tenantResolver');

router.use(authenticate, resolveTenantFromJWT);

// GET /admin/v1/approval/queue — posts awaiting review
router.get('/queue', requireRole('editor'), async (req, res, next) => {
  try {
    const posts = await db.query(
      `
      SELECT p.id, p.title, p.slug, p.excerpt, p.updated_at,
             ps.status, ps.created_at AS submitted_at, ps.note,
             u.name AS author_name, u.email AS author_email, u.avatar_url
      FROM posts p
      JOIN post_status ps ON ps.post_id = p.id
        AND ps.status = 'pending_approval'
        AND ps.id = (SELECT id FROM post_status WHERE post_id = p.id ORDER BY id DESC LIMIT 1)
      JOIN users u ON u.id = p.author_id
      WHERE p.tenant_id = ?
      ORDER BY ps.created_at ASC`,
      [req.tenantId]
    );
    res.json({ success: true, data: posts });
  } catch (err) {
    next(err);
  }
});

// GET /admin/v1/approval/:postId/history
router.get('/:postId/history', async (req, res, next) => {
  try {
    const history = await db.query(
      `
      SELECT ps.id, ps.status, ps.note, ps.published_at, ps.scheduled_at, ps.created_at,
             u.name AS changed_by_name, u.avatar_url
      FROM post_status ps
      JOIN users u ON u.id = ps.changed_by
      WHERE ps.post_id = ?
      ORDER BY ps.created_at ASC`,
      [req.params.postId]
    );
    res.json({ success: true, data: history });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
