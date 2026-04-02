// ============================================
// routes/analytics.js — Storage Analytics
// ============================================

const express = require('express');
const pool = require('../database/connection');
const { verifyToken, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(verifyToken);

// ═══════════════════════════════════════════════
//  GET /api/drive/storage — User storage overview
// ═══════════════════════════════════════════════
router.get('/storage', async (req, res, next) => {
    try {
        const userId = req.user.userId;

        // File stats by type
        const stats = await pool.query(
            `SELECT
                COUNT(*) AS total_files,
                COALESCE(SUM(size), 0) AS total_size,
                COUNT(CASE WHEN mime_type LIKE 'image/%' THEN 1 END) AS image_count,
                COALESCE(SUM(CASE WHEN mime_type LIKE 'image/%' THEN size ELSE 0 END), 0) AS image_size,
                COUNT(CASE WHEN mime_type LIKE 'video/%' THEN 1 END) AS video_count,
                COALESCE(SUM(CASE WHEN mime_type LIKE 'video/%' THEN size ELSE 0 END), 0) AS video_size,
                COUNT(CASE WHEN mime_type LIKE 'audio/%' THEN 1 END) AS audio_count,
                COALESCE(SUM(CASE WHEN mime_type LIKE 'audio/%' THEN size ELSE 0 END), 0) AS audio_size,
                COUNT(CASE WHEN mime_type LIKE 'application/pdf' OR mime_type LIKE '%document%' OR mime_type LIKE 'text/%' THEN 1 END) AS doc_count,
                COALESCE(SUM(CASE WHEN mime_type LIKE 'application/pdf' OR mime_type LIKE '%document%' OR mime_type LIKE 'text/%' THEN size ELSE 0 END), 0) AS doc_size,
                COUNT(CASE WHEN mime_type LIKE 'application/zip' OR mime_type LIKE '%compressed%' OR mime_type LIKE '%archive%' THEN 1 END) AS archive_count,
                COALESCE(SUM(CASE WHEN mime_type LIKE 'application/zip' OR mime_type LIKE '%compressed%' OR mime_type LIKE '%archive%' THEN size ELSE 0 END), 0) AS archive_size
             FROM files WHERE is_trashed = false AND uploaded_by = $1`,
            [userId]
        );

        // User quota
        const quota = await pool.query(
            'SELECT storage_used, storage_limit FROM users WHERE id = $1',
            [userId]
        );

        const overview = stats.rows[0];
        const userQuota = quota.rows[0];
        const usedPercent = userQuota.storage_limit > 0
            ? Math.round((userQuota.storage_used / userQuota.storage_limit) * 10000) / 100
            : 0;

        res.json({
            overview: {
                totalFiles: parseInt(overview.total_files),
                totalSize: parseInt(overview.total_size),
            },
            byType: {
                images: { count: parseInt(overview.image_count), size: parseInt(overview.image_size) },
                videos: { count: parseInt(overview.video_count), size: parseInt(overview.video_size) },
                audio: { count: parseInt(overview.audio_count), size: parseInt(overview.audio_size) },
                documents: { count: parseInt(overview.doc_count), size: parseInt(overview.doc_size) },
                archives: { count: parseInt(overview.archive_count), size: parseInt(overview.archive_size) },
            },
            quota: {
                used: parseInt(userQuota.storage_used),
                limit: parseInt(userQuota.storage_limit),
                available: Math.max(0, parseInt(userQuota.storage_limit) - parseInt(userQuota.storage_used)),
            },
            usedPercent,
        });
    } catch (error) {
        next(error);
    }
});

// ═══════════════════════════════════════════════
//  GET /api/drive/storage/by-user — Admin only
// ═══════════════════════════════════════════════
router.get('/storage/by-user', requireRole('admin'), async (req, res, next) => {
    try {
        const result = await pool.query(
            `SELECT u.id, u.name, u.email, u.role, u.storage_used, u.storage_limit,
                    COUNT(f.id) AS file_count,
                    COALESCE(SUM(f.size), 0) AS total_size,
                    ROUND((u.storage_used::numeric / NULLIF(u.storage_limit, 0)::numeric) * 100, 2) AS used_percent
             FROM users u
             LEFT JOIN files f ON u.id = f.uploaded_by AND f.is_trashed = false
             WHERE u.is_active = true
             GROUP BY u.id ORDER BY u.storage_used DESC`
        );

        res.json({ users: result.rows });
    } catch (error) {
        next(error);
    }
});

// ═══════════════════════════════════════════════
//  GET /api/drive/largest-files — Top 20 by size
// ═══════════════════════════════════════════════
router.get('/largest-files', async (req, res, next) => {
    try {
        const result = await pool.query(
            `SELECT f.*, u.name AS uploader_name
             FROM files f LEFT JOIN users u ON f.uploaded_by = u.id
             WHERE f.is_trashed = false AND f.uploaded_by = $1
             ORDER BY f.size DESC LIMIT 20`,
            [req.user.userId]
        );

        res.json({ files: result.rows });
    } catch (error) {
        next(error);
    }
});

// ═══════════════════════════════════════════════
//  GET /api/drive/activity — Recent activity
// ═══════════════════════════════════════════════
router.get('/activity', async (req, res, next) => {
    try {
        const { limit = 100, action, entityType } = req.query;
        const limitNum = Math.min(500, Math.max(1, parseInt(limit, 10) || 100));

        let query = `
            SELECT al.*, u.name AS user_name, u.avatar AS user_avatar
            FROM activity_log al
            LEFT JOIN users u ON al.user_id = u.id
            WHERE al.user_id = $1`;
        const params = [req.user.userId];
        let paramIdx = 2;

        if (action) {
            query += ` AND al.action = $${paramIdx++}`;
            params.push(action);
        }
        if (entityType) {
            query += ` AND al.entity_type = $${paramIdx++}`;
            params.push(entityType);
        }

        query += ` ORDER BY al.created_at DESC LIMIT $${paramIdx}`;
        params.push(limitNum);

        const result = await pool.query(query, params);
        res.json({ activities: result.rows });
    } catch (error) {
        next(error);
    }
});

// ═══════════════════════════════════════════════
//  GET /api/drive/file-types — Distribution
// ═══════════════════════════════════════════════
router.get('/file-types', async (req, res, next) => {
    try {
        const result = await pool.query(
            `SELECT extension, COUNT(*) AS count, COALESCE(SUM(size), 0) AS total_size
             FROM files WHERE is_trashed = false AND uploaded_by = $1
             GROUP BY extension ORDER BY count DESC`,
            [req.user.userId]
        );

        res.json({ types: result.rows });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
