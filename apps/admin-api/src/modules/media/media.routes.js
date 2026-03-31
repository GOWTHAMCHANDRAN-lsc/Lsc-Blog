const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs/promises');
const multer = require('multer');
const db = require('../../config/database');
const { authenticate } = require('../../middleware/auth');
const { resolveTenantFromJWT } = require('../../middleware/tenantResolver');
const { AppError } = require('../../utils/errors');

router.use(authenticate, resolveTenantFromJWT);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

// GET /admin/v1/media
router.get('/', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const perPage = parseInt(req.query.per_page) || 30;
    const offset = (page - 1) * perPage;
    const media = await db.query(
      `
      SELECT m.*, u.name AS uploaded_by_name FROM media m
      JOIN users u ON u.id = m.uploaded_by
      WHERE m.tenant_id = ? ORDER BY m.created_at DESC LIMIT ? OFFSET ?`,
      [req.tenantId, perPage, offset]
    );
    res.json({ success: true, data: media });
  } catch (err) {
    next(err);
  }
});

// POST /admin/v1/media/upload-file — direct upload to local disk (dev / VPS)
router.post('/upload-file', upload.single('file'), async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) {
      throw new AppError('file is required', 400, 'FILE_REQUIRED');
    }

    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
    ];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new AppError('File type not allowed', 400, 'FILE_TYPE_NOT_ALLOWED');
    }

    const originalName = String(file.originalname || 'upload');
    const ext = (
      path.extname(originalName).replace('.', '') || 'bin'
    ).toLowerCase();
    const filename = `${uuidv4()}.${ext}`;

    const tenantDir = path.join(
      __dirname,
      '..',
      '..',
      '..',
      'uploads',
      req.tenantId
    );
    await fs.mkdir(tenantDir, { recursive: true });
    const outputPath = path.join(tenantDir, filename);
    await fs.writeFile(outputPath, file.buffer);

    const storageKey = `local/${req.tenantId}/${filename}`;
    const mediaId = uuidv4();
    const publicBase =
      process.env.PUBLIC_MEDIA_BASE_URL ||
      `${req.protocol}://${req.get('host')}`;
    const cdnUrl = `${publicBase}/uploads/${req.tenantId}/${filename}`;

    await db.query(
      `INSERT INTO media (id, tenant_id, uploaded_by, filename, storage_key, cdn_url, mime_type, file_size_bytes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        mediaId,
        req.tenantId,
        req.user.id,
        originalName,
        storageKey,
        cdnUrl,
        file.mimetype,
        file.size,
      ]
    );

    res.status(201).json({
      success: true,
      data: {
        mediaId,
        storageKey,
        cdnUrl,
        filename: originalName,
        mimeType: file.mimetype,
        fileSize: file.size,
        mode: 'local',
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /admin/v1/media/upload — get S3 presigned URL
router.post('/upload', async (req, res, next) => {
  try {
    const { filename, mimeType, fileSize } = req.body;
    if (!filename || !mimeType)
      throw new AppError('filename and mimeType required', 400);

    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
    ];
    if (!allowedTypes.includes(mimeType))
      throw new AppError('File type not allowed', 400);

    const ext = filename.split('.').pop().toLowerCase();
    const storageKey = `${req.tenantId}/${uuidv4()}.${ext}`;
    const cdnDomain = process.env.AWS_CLOUDFRONT_DOMAIN || 'cdn.example.com';
    const cdnUrl = `https://${cdnDomain}/${storageKey}`;
    const mediaId = uuidv4();

    // Record in DB optimistically (mark as pending)
    await db.query(
      `INSERT INTO media (id, tenant_id, uploaded_by, filename, storage_key, cdn_url, mime_type, file_size_bytes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        mediaId,
        req.tenantId,
        req.user.id,
        filename,
        storageKey,
        cdnUrl,
        mimeType,
        fileSize || 0,
      ]
    );

    // Generate presigned URL (S3 SDK required in production)
    let presignedUrl = null;
    if (process.env.AWS_S3_BUCKET) {
      const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
      const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
      const s3 = new S3Client({
        region: process.env.AWS_REGION || 'us-east-1',
      });
      presignedUrl = await getSignedUrl(
        s3,
        new PutObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET,
          Key: storageKey,
          ContentType: mimeType,
          Metadata: { tenantId: req.tenantId, mediaId },
        }),
        { expiresIn: 300 }
      );
    }

    res.json({
      success: true,
      data: {
        mediaId,
        storageKey,
        cdnUrl,
        presignedUrl,
        message: presignedUrl
          ? 'PUT file to presignedUrl'
          : 'S3 not configured',
      },
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /admin/v1/media/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const media = await db.queryOne(
      `SELECT * FROM media WHERE id = ? AND tenant_id = ?`,
      [req.params.id, req.tenantId]
    );
    if (!media) throw new AppError('Media not found', 404);
    await db.query(`DELETE FROM media WHERE id = ?`, [req.params.id]);
    res.json({ success: true, message: 'Media deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
