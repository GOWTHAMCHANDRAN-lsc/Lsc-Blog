const express = require('express');
const path = require('path');
const fs = require('fs/promises');
const multer = require('multer');
const db = require('../../config/database');
const { authenticate, requireRole } = require('../../middleware/auth');
const { resolveTenantFromJWT } = require('../../middleware/tenantResolver');
const { AppError } = require('../../utils/errors');
const { enqueueImportJob } = require('../../jobs/imports');

const router = express.Router();
router.use(authenticate, resolveTenantFromJWT, requireRole('admin'));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

// POST /admin/v1/imports/rss
router.post('/imports/rss', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError('file is required', 400, 'FILE_REQUIRED');
    }

    const jobId = require('crypto').randomUUID();
    const dir = path.join(__dirname, '..', '..', '..', 'imports', req.tenantId);
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, `${jobId}.xml`);
    await fs.writeFile(filePath, req.file.buffer);

    await db.query(
      `INSERT INTO import_jobs (id, tenant_id, type, status, progress, total)
       VALUES (?, ?, 'rss', 'queued', 0, 0)`,
      [jobId, req.tenantId]
    );

    const enqueued = await enqueueImportJob({
      tenantId: req.tenantId,
      jobId,
      type: 'rss',
      filePath,
      requestedBy: req.user.id,
    });

    res.status(201).json({ success: true, data: { id: jobId, enqueued } });
  } catch (err) {
    next(err);
  }
});

// POST /admin/v1/imports/wxr
router.post('/imports/wxr', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError('file is required', 400, 'FILE_REQUIRED');
    }

    const jobId = require('crypto').randomUUID();
    const dir = path.join(__dirname, '..', '..', '..', 'imports', req.tenantId);
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, `${jobId}.xml`);
    await fs.writeFile(filePath, req.file.buffer);

    await db.query(
      `INSERT INTO import_jobs (id, tenant_id, type, status, progress, total)
       VALUES (?, ?, 'wxr', 'queued', 0, 0)`,
      [jobId, req.tenantId]
    );

    const enqueued = await enqueueImportJob({
      tenantId: req.tenantId,
      jobId,
      type: 'wxr',
      filePath,
      requestedBy: req.user.id,
    });

    res.status(201).json({ success: true, data: { id: jobId, enqueued } });
  } catch (err) {
    next(err);
  }
});

// GET /admin/v1/imports/:id
router.get('/imports/:id', async (req, res, next) => {
  try {
    const job = await db.queryOne(
      `SELECT * FROM import_jobs WHERE id = ? AND tenant_id = ?`,
      [req.params.id, req.tenantId]
    );
    if (!job) {
      throw new AppError('Import job not found', 404, 'NOT_FOUND');
    }
    res.json({ success: true, data: normalize(job) });
  } catch (err) {
    next(err);
  }
});

// GET /admin/v1/imports
router.get('/imports', async (req, res, next) => {
  try {
    const rows = await db.query(
      `SELECT id, type, status, progress, total, error, created_at, updated_at
       FROM import_jobs
       WHERE tenant_id = ?
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.tenantId]
    );
    res.json({ success: true, data: rows.map(normalize) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

function normalize(job) {
  return {
    ...job,
    progress: Number(job.progress || 0),
    total: Number(job.total || 0),
    result_json: parseJson(job.result_json),
  };
}

function parseJson(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
