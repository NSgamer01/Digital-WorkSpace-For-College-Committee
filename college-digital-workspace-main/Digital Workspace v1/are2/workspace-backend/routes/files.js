// ============================================
// routes/files.js — File & Drive Routes
// ============================================
// All routes use req.committeeDb.
// Multer storage is dynamic per committee.
// ============================================

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { enrichWithUserNames } = require('../utils/enrichUsers');

// ── Multer dynamic storage ─────────────────────
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const slugUpper = (req.committeeSlug || 'DEFAULT').toUpperCase();
        const userId = req.user.id;
        const dir = path.join(
            process.cwd(),
            'uploads',
            slugUpper,
            'drive',
            userId
        );
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        cb(null, `${uuidv4()}_${safeName}`);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 104857600 },
});

// ═══════════════════════════════════════════════
//  GET /files — List files in a folder
// ═══════════════════════════════════════════════
router.get('/files', async (req, res) => {
    try {
        const { folderId } = req.query;

        let result;
        if (folderId) {
            result = await req.committeeDb.query(
                `SELECT * FROM files
                 WHERE folder_id = $1 AND is_trashed = false
                 ORDER BY created_at DESC`,
                [folderId]
            );
        } else {
            result = await req.committeeDb.query(
                `SELECT * FROM files
                 WHERE folder_id IS NULL AND is_trashed = false
                 ORDER BY created_at DESC`
            );
        }

        const files = await enrichWithUserNames(req.masterDb, result.rows, 'uploaded_by');

        res.json({ success: true, files });
    } catch (err) {
        console.error('  ❌ List files error:', err.message);
        res.status(500).json({ error: 'Failed to list files' });
    }
});

// ═══════════════════════════════════════════════
//  GET /folders — List folders
// ═══════════════════════════════════════════════
router.get('/folders', async (req, res) => {
    try {
        const { parentId } = req.query;

        let result;
        if (parentId) {
            result = await req.committeeDb.query(
                `SELECT * FROM folders
                 WHERE parent_id = $1 AND is_trashed = false
                 ORDER BY name ASC`,
                [parentId]
            );
        } else {
            result = await req.committeeDb.query(
                `SELECT * FROM folders
                 WHERE parent_id IS NULL AND is_trashed = false
                 ORDER BY name ASC`
            );
        }

        const folders = await enrichWithUserNames(req.masterDb, result.rows, 'created_by');

        res.json({ success: true, folders });
    } catch (err) {
        console.error('  ❌ List folders error:', err.message);
        res.status(500).json({ error: 'Failed to list folders' });
    }
});

// ═══════════════════════════════════════════════
//  POST /folders — Create folder
// ═══════════════════════════════════════════════
router.post('/folders', async (req, res) => {
    try {
        const { name, parentId, color } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Folder name is required' });
        }

        const result = await req.committeeDb.query(
            `INSERT INTO folders (name, parent_id, created_by, color)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [name, parentId || null, req.user.id, color || '#6366f1']
        );

        // Log activity
        await req.committeeDb.query(
            `INSERT INTO activity_log (user_id, action, entity_type, entity_id, details)
             VALUES ($1, 'created', 'folder', $2, $3)`,
            [req.user.id, result.rows[0].id, JSON.stringify({ name })]
        );

        res.status(201).json({ success: true, folder: result.rows[0] });
    } catch (err) {
        console.error('  ❌ Create folder error:', err.message);
        res.status(500).json({ error: 'Failed to create folder' });
    }
});

// ═══════════════════════════════════════════════
//  POST /upload — Upload file
// ═══════════════════════════════════════════════
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file provided' });
        }

        const { folderId, description, tags } = req.body;
        const slugUpper = (req.committeeSlug || 'DEFAULT').toUpperCase();

        // Build storage path relative to uploads dir
        const storagePath = path.join(
            slugUpper,
            'drive',
            req.user.id,
            req.file.filename
        ).replace(/\\/g, '/');

        const parsedTags = tags ? (typeof tags === 'string' ? tags.split(',').map((t) => t.trim()) : tags) : [];

        const result = await req.committeeDb.query(
            `INSERT INTO files (name, original_name, mime_type, size, storage_path, folder_id, uploaded_by, description, tags)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING *`,
            [
                req.file.filename,
                req.file.originalname,
                req.file.mimetype,
                req.file.size,
                storagePath,
                folderId || null,
                req.user.id,
                description || '',
                parsedTags,
            ]
        );

        // Log activity
        await req.committeeDb.query(
            `INSERT INTO activity_log (user_id, action, entity_type, entity_id, details)
             VALUES ($1, 'uploaded', 'file', $2, $3)`,
            [
                req.user.id,
                result.rows[0].id,
                JSON.stringify({ name: req.file.originalname, size: req.file.size }),
            ]
        );

        res.status(201).json({ success: true, file: result.rows[0] });
    } catch (err) {
        console.error('  ❌ Upload error:', err.message);
        res.status(500).json({ error: 'Failed to upload file' });
    }
});

// ═══════════════════════════════════════════════
//  DELETE /files/:id — Soft delete file
// ═══════════════════════════════════════════════
router.delete('/files/:id', async (req, res) => {
    try {
        const result = await req.committeeDb.query(
            `UPDATE files SET is_trashed = true, trashed_at = NOW(), updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'File not found' });
        }

        res.json({ success: true, message: 'File moved to trash' });
    } catch (err) {
        console.error('  ❌ Delete file error:', err.message);
        res.status(500).json({ error: 'Failed to delete file' });
    }
});

// ═══════════════════════════════════════════════
//  PATCH /files/:id/star — Toggle star
// ═══════════════════════════════════════════════
router.patch('/files/:id/star', async (req, res) => {
    try {
        const result = await req.committeeDb.query(
            `UPDATE files SET is_starred = NOT is_starred, updated_at = NOW()
             WHERE id = $1
             RETURNING id, is_starred`,
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'File not found' });
        }

        res.json({ success: true, file: result.rows[0] });
    } catch (err) {
        console.error('  ❌ Star file error:', err.message);
        res.status(500).json({ error: 'Failed to toggle star' });
    }
});

// ═══════════════════════════════════════════════
//  GET /trash — List trashed items
// ═══════════════════════════════════════════════
router.get('/trash', async (req, res) => {
    try {
        const filesResult = await req.committeeDb.query(
            `SELECT *, 'file' AS item_type FROM files
             WHERE is_trashed = true
             ORDER BY trashed_at DESC`
        );

        const foldersResult = await req.committeeDb.query(
            `SELECT *, 'folder' AS item_type FROM folders
             WHERE is_trashed = true
             ORDER BY trashed_at DESC`
        );

        const files = await enrichWithUserNames(req.masterDb, filesResult.rows, 'uploaded_by');
        const folders = await enrichWithUserNames(req.masterDb, foldersResult.rows, 'created_by');

        res.json({ success: true, files, folders });
    } catch (err) {
        console.error('  ❌ List trash error:', err.message);
        res.status(500).json({ error: 'Failed to list trash' });
    }
});

// ═══════════════════════════════════════════════
//  POST /trash/restore/:id — Restore from trash
// ═══════════════════════════════════════════════
router.post('/trash/restore/:id', async (req, res) => {
    try {
        // Try files first
        let result = await req.committeeDb.query(
            `UPDATE files SET is_trashed = false, trashed_at = NULL, updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [req.params.id]
        );

        if (result.rows.length > 0) {
            return res.json({ success: true, item: result.rows[0], type: 'file' });
        }

        // Try folders
        result = await req.committeeDb.query(
            `UPDATE folders SET is_trashed = false, trashed_at = NULL, updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [req.params.id]
        );

        if (result.rows.length > 0) {
            return res.json({ success: true, item: result.rows[0], type: 'folder' });
        }

        res.status(404).json({ error: 'Item not found in trash' });
    } catch (err) {
        console.error('  ❌ Restore error:', err.message);
        res.status(500).json({ error: 'Failed to restore item' });
    }
});

// ═══════════════════════════════════════════════
//  DELETE /trash/:id — Permanent delete
// ═══════════════════════════════════════════════
router.delete('/trash/:id', async (req, res) => {
    try {
        // Try files first
        const fileResult = await req.committeeDb.query(
            'SELECT * FROM files WHERE id = $1',
            [req.params.id]
        );

        if (fileResult.rows.length > 0) {
            const file = fileResult.rows[0];

            // Delete from disk
            const filePath = path.join(process.cwd(), 'uploads', file.storage_path);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }

            // Delete from database
            await req.committeeDb.query('DELETE FROM files WHERE id = $1', [req.params.id]);
            return res.json({ success: true, message: 'File permanently deleted' });
        }

        // Try folders
        const folderResult = await req.committeeDb.query(
            'DELETE FROM folders WHERE id = $1 RETURNING *',
            [req.params.id]
        );

        if (folderResult.rows.length > 0) {
            return res.json({ success: true, message: 'Folder permanently deleted' });
        }

        res.status(404).json({ error: 'Item not found' });
    } catch (err) {
        console.error('  ❌ Permanent delete error:', err.message);
        res.status(500).json({ error: 'Failed to permanently delete item' });
    }
});

// ═══════════════════════════════════════════════
//  GET /search — Search files
// ═══════════════════════════════════════════════
router.get('/search', async (req, res) => {
    try {
        const { q } = req.query;

        if (!q) {
            return res.status(400).json({ error: 'Search query (q) is required' });
        }

        const searchPattern = `%${q}%`;

        const result = await req.committeeDb.query(
            `SELECT * FROM files
             WHERE is_trashed = false
               AND (original_name ILIKE $1 OR description ILIKE $1 OR $2 = ANY(tags))
             ORDER BY updated_at DESC
             LIMIT 50`,
            [searchPattern, q]
        );

        const files = await enrichWithUserNames(req.masterDb, result.rows, 'uploaded_by');

        res.json({ success: true, files });
    } catch (err) {
        console.error('  ❌ Search error:', err.message);
        res.status(500).json({ error: 'Failed to search files' });
    }
});

// ═══════════════════════════════════════════════
//  GET /stats — Drive statistics
// ═══════════════════════════════════════════════
router.get('/stats', async (req, res) => {
    try {
        const statsResult = await req.committeeDb.query(`
            SELECT
                COUNT(*) FILTER (WHERE is_trashed = false) AS total_files,
                COALESCE(SUM(size) FILTER (WHERE is_trashed = false), 0) AS total_size,
                COUNT(*) FILTER (WHERE is_trashed = true) AS trashed_files,
                COUNT(*) FILTER (WHERE is_starred = true AND is_trashed = false) AS starred_files
            FROM files
        `);

        const folderCount = await req.committeeDb.query(
            'SELECT COUNT(*) AS count FROM folders WHERE is_trashed = false'
        );

        // Get committee storage limit from master DB
        let storageLimit = 5368709120; // 5GB default
        try {
            const committeeResult = await req.masterDb.query(
                'SELECT storage_limit FROM committees WHERE slug = $1',
                [req.committeeSlug]
            );
            if (committeeResult.rows.length > 0) {
                storageLimit = committeeResult.rows[0].storage_limit;
            }
        } catch (e) {
            // Use default
        }

        const stats = statsResult.rows[0];

        res.json({
            success: true,
            stats: {
                totalFiles: parseInt(stats.total_files),
                totalSize: parseInt(stats.total_size),
                trashedFiles: parseInt(stats.trashed_files),
                starredFiles: parseInt(stats.starred_files),
                totalFolders: parseInt(folderCount.rows[0].count),
                storageLimit,
            },
        });
    } catch (err) {
        console.error('  ❌ Stats error:', err.message);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

module.exports = router;
