// ============================================
// routes/files.js (Drive)
// ============================================
// File and folder operations using req.committeeDb.
// Dynamic Multer storage saves to committee-specific paths.
// User names are enriched from masterDb.
// ============================================

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// ── Upload base path ────────────────────────────
const UPLOAD_BASE = path.resolve(__dirname, '..', process.env.UPLOAD_BASE_DIR || '../workspace Drive/Uploads');

// ── enrichWithUserNames helper ──────────────────
async function enrichWithUserNames(masterDb, rows, userIdField = 'uploaded_by') {
    if (!rows || rows.length === 0) return rows;

    // Collect unique user IDs (handle both single field and arrays)
    const userIds = new Set();
    for (const row of rows) {
        const fields = Array.isArray(userIdField) ? userIdField : [userIdField];
        for (const field of fields) {
            if (row[field]) {
                userIds.add(row[field]);
            }
        }
    }

    if (userIds.size === 0) return rows;

    // Batch fetch user info
    const userIdsArray = Array.from(userIds);
    const placeholders = userIdsArray.map((_, i) => `$${i + 1}`).join(', ');
    const result = await masterDb.query(
        `SELECT id, name, email, avatar FROM users WHERE id IN (${placeholders})`,
        userIdsArray
    );

    // Build lookup map
    const userMap = {};
    for (const user of result.rows) {
        userMap[user.id] = user;
    }

    // Attach user info to each row
    const fields = Array.isArray(userIdField) ? userIdField : [userIdField];
    for (const row of rows) {
        for (const field of fields) {
            if (row[field] && userMap[row[field]]) {
                const prefix = field.replace(/_id$/, '').replace(/_by$/, '');
                row[`${prefix}_name`] = userMap[row[field]].name;
                row[`${prefix}_email`] = userMap[row[field]].email;
                row[`${prefix}_avatar`] = userMap[row[field]].avatar;
            }
        }
        // Always set user_name, user_email, user_avatar for the primary field
        if (!Array.isArray(userIdField)) {
            const primary = row[userIdField];
            if (primary && userMap[primary]) {
                row.user_name = userMap[primary].name;
                row.user_email = userMap[primary].email;
                row.user_avatar = userMap[primary].avatar;
            }
        }
    }

    return rows;
}

// ── Dynamic Multer storage ──────────────────────
const storage = multer.diskStorage({
    destination: (req, _file, cb) => {
        const slug = (req.committeeSlug || 'unknown').toUpperCase();
        const userId = req.user.userId;
        const destDir = path.join(UPLOAD_BASE, slug, 'drive', userId);

        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }

        cb(null, destDir);
    },
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname);
        const safeName = `${uuidv4()}${ext}`;
        cb(null, safeName);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 500 * 1024 * 1024 },
});

// ══════════════════════════════════════════════════
// GET /files — List files in a folder (or root)
// ══════════════════════════════════════════════════
router.get('/files', async (req, res) => {
    try {
        const { folderId } = req.query;
        const db = req.committeeDb;

        let result;
        if (folderId) {
            result = await db.query(
                `SELECT * FROM files
         WHERE folder_id = $1 AND is_trashed = false
         ORDER BY created_at DESC`,
                [folderId]
            );
        } else {
            result = await db.query(
                `SELECT * FROM files
         WHERE folder_id IS NULL AND is_trashed = false
         ORDER BY created_at DESC`
            );
        }

        const enriched = await enrichWithUserNames(req.masterDb, result.rows, 'uploaded_by');

        res.json({
            success: true,
            files: enriched,
            total: enriched.length,
        });
    } catch (err) {
        console.error('List files error:', err.message);
        res.status(500).json({ error: 'Failed to list files.' });
    }
});

// ══════════════════════════════════════════════════
// GET /folders — List folders in a parent (or root)
// ══════════════════════════════════════════════════
router.get('/folders', async (req, res) => {
    try {
        const { parentId } = req.query;
        const db = req.committeeDb;

        let result;
        if (parentId) {
            result = await db.query(
                `SELECT * FROM folders
         WHERE parent_id = $1 AND is_trashed = false
         ORDER BY name ASC`,
                [parentId]
            );
        } else {
            result = await db.query(
                `SELECT * FROM folders
         WHERE parent_id IS NULL AND is_trashed = false
         ORDER BY name ASC`
            );
        }

        const enriched = await enrichWithUserNames(req.masterDb, result.rows, 'created_by');

        res.json({
            success: true,
            folders: enriched,
            total: enriched.length,
        });
    } catch (err) {
        console.error('List folders error:', err.message);
        res.status(500).json({ error: 'Failed to list folders.' });
    }
});

// ══════════════════════════════════════════════════
// POST /folders — Create a folder
// ══════════════════════════════════════════════════
router.post('/folders', async (req, res) => {
    try {
        const { name, parentId, color } = req.body;
        const db = req.committeeDb;

        if (!name) {
            return res.status(400).json({ error: 'Folder name is required.' });
        }

        const result = await db.query(
            `INSERT INTO folders (name, parent_id, created_by, color)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
            [name.trim(), parentId || null, req.user.userId, color || null]
        );

        // Log activity
        await db.query(
            `INSERT INTO activity_log (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                req.user.userId,
                'created_folder',
                'folder',
                result.rows[0].id,
                JSON.stringify({ name: name.trim() }),
                req.ip,
            ]
        );

        res.status(201).json({
            success: true,
            folder: result.rows[0],
        });
    } catch (err) {
        console.error('Create folder error:', err.message);
        res.status(500).json({ error: 'Failed to create folder.' });
    }
});

// ══════════════════════════════════════════════════
// POST /upload — Upload a file
// ══════════════════════════════════════════════════
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file provided.' });
        }

        const db = req.committeeDb;
        const { folderId, description, tags } = req.body;
        const slug = (req.committeeSlug || 'unknown').toUpperCase();

        // Build relative storage path
        const storagePath = path.join(slug, 'drive', req.user.userId, req.file.filename);

        const parsedTags = tags ? (typeof tags === 'string' ? tags.split(',').map(t => t.trim()) : tags) : [];

        const result = await db.query(
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
                req.user.userId,
                description || null,
                parsedTags,
            ]
        );

        // Log activity
        await db.query(
            `INSERT INTO activity_log (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                req.user.userId,
                'uploaded_file',
                'file',
                result.rows[0].id,
                JSON.stringify({ name: req.file.originalname, size: req.file.size }),
                req.ip,
            ]
        );

        res.status(201).json({
            success: true,
            file: result.rows[0],
        });
    } catch (err) {
        console.error('Upload error:', err.message);
        res.status(500).json({ error: 'Failed to upload file.' });
    }
});

// ══════════════════════════════════════════════════
// DELETE /files/:id — Soft-delete a file
// ══════════════════════════════════════════════════
router.delete('/files/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const db = req.committeeDb;

        const result = await db.query(
            `UPDATE files SET is_trashed = true, trashed_at = NOW(), updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
            [id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'File not found.' });
        }

        // Log activity
        await db.query(
            `INSERT INTO activity_log (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                req.user.userId,
                'trashed_file',
                'file',
                id,
                JSON.stringify({ name: result.rows[0].original_name }),
                req.ip,
            ]
        );

        res.json({
            success: true,
            message: 'File moved to trash.',
        });
    } catch (err) {
        console.error('Delete file error:', err.message);
        res.status(500).json({ error: 'Failed to delete file.' });
    }
});

// ══════════════════════════════════════════════════
// GET /trash — List trashed files and folders
// ══════════════════════════════════════════════════
router.get('/trash', async (req, res) => {
    try {
        const db = req.committeeDb;

        const filesResult = await db.query(
            `SELECT * FROM files WHERE is_trashed = true ORDER BY trashed_at DESC`
        );
        const foldersResult = await db.query(
            `SELECT * FROM folders WHERE is_trashed = true ORDER BY trashed_at DESC`
        );

        const enrichedFiles = await enrichWithUserNames(req.masterDb, filesResult.rows, 'uploaded_by');
        const enrichedFolders = await enrichWithUserNames(req.masterDb, foldersResult.rows, 'created_by');

        res.json({
            success: true,
            files: enrichedFiles,
            folders: enrichedFolders,
        });
    } catch (err) {
        console.error('List trash error:', err.message);
        res.status(500).json({ error: 'Failed to list trash.' });
    }
});

// ══════════════════════════════════════════════════
// GET /search — Search files
// ══════════════════════════════════════════════════
router.get('/search', async (req, res) => {
    try {
        const { q } = req.query;
        const db = req.committeeDb;

        if (!q) {
            return res.status(400).json({ error: 'Search query (q) is required.' });
        }

        const searchTerm = `%${q}%`;

        const result = await db.query(
            `SELECT * FROM files
       WHERE is_trashed = false
         AND (
           original_name ILIKE $1
           OR description ILIKE $1
           OR $2 = ANY(tags)
         )
       ORDER BY created_at DESC
       LIMIT 50`,
            [searchTerm, q]
        );

        const enriched = await enrichWithUserNames(req.masterDb, result.rows, 'uploaded_by');

        res.json({
            success: true,
            files: enriched,
            total: enriched.length,
        });
    } catch (err) {
        console.error('Search error:', err.message);
        res.status(500).json({ error: 'Failed to search files.' });
    }
});

// ══════════════════════════════════════════════════
// GET /stats — Drive statistics
// ══════════════════════════════════════════════════
router.get('/stats', async (req, res) => {
    try {
        const db = req.committeeDb;

        const result = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM files WHERE is_trashed = false) AS total_files,
        (SELECT COALESCE(SUM(size), 0) FROM files WHERE is_trashed = false) AS total_size,
        (SELECT COUNT(*) FROM files WHERE is_trashed = true) AS trashed_files,
        (SELECT COUNT(*) FROM files WHERE is_starred = true AND is_trashed = false) AS starred_files,
        (SELECT COUNT(*) FROM folders WHERE is_trashed = false) AS total_folders
    `);

        const stats = result.rows[0];

        // Get committee storage limit from master DB
        let storageLimit = 5368709120; // 5 GB default
        if (req.committee) {
            storageLimit = req.committee.storage_limit || storageLimit;
        }

        res.json({
            success: true,
            stats: {
                totalFiles: parseInt(stats.total_files) || 0,
                totalSize: parseInt(stats.total_size) || 0,
                trashedFiles: parseInt(stats.trashed_files) || 0,
                starredFiles: parseInt(stats.starred_files) || 0,
                totalFolders: parseInt(stats.total_folders) || 0,
                storageLimit,
            },
        });
    } catch (err) {
        console.error('Drive stats error:', err.message);
        res.status(500).json({ error: 'Failed to fetch drive stats.' });
    }
});
// ══════════════════════════════════════════════════
// DELETE /folders/:id — Soft-delete a folder
// ══════════════════════════════════════════════════
router.delete('/folders/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const db = req.committeeDb;

        const result = await db.query(
            `UPDATE folders SET is_trashed = true, trashed_at = NOW(), updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
            [id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Folder not found.' });
        }

        // Also trash all files inside this folder
        await db.query(
            `UPDATE files SET is_trashed = true, trashed_at = NOW(), updated_at = NOW()
       WHERE folder_id = $1 AND is_trashed = false`,
            [id]
        );

        // Also trash subfolders recursively
        await db.query(
            `WITH RECURSIVE sub AS (
                SELECT id FROM folders WHERE parent_id = $1
                UNION ALL
                SELECT f.id FROM folders f INNER JOIN sub s ON f.parent_id = s.id
            )
            UPDATE folders SET is_trashed = true, trashed_at = NOW(), updated_at = NOW()
            WHERE id IN (SELECT id FROM sub)`,
            [id]
        );

        res.json({ success: true, message: 'Folder moved to trash.' });
    } catch (err) {
        console.error('Delete folder error:', err.message);
        res.status(500).json({ error: 'Failed to delete folder.' });
    }
});

// ══════════════════════════════════════════════════
// PATCH /files/:id — Update a file (rename, move, etc.)
// ══════════════════════════════════════════════════
router.patch('/files/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const db = req.committeeDb;
        const { name, folder_id, description } = req.body;

        const updates = [];
        const values = [];
        let idx = 1;

        if (name !== undefined) { updates.push(`original_name = $${idx++}`); values.push(name); }
        if (folder_id !== undefined) { updates.push(`folder_id = $${idx++}`); values.push(folder_id || null); }
        if (description !== undefined) { updates.push(`description = $${idx++}`); values.push(description); }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update.' });
        }

        updates.push(`updated_at = NOW()`);
        values.push(id);

        const result = await db.query(
            `UPDATE files SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
            values
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'File not found.' });
        }

        res.json({ success: true, file: result.rows[0] });
    } catch (err) {
        console.error('Update file error:', err.message);
        res.status(500).json({ error: 'Failed to update file.' });
    }
});

// ══════════════════════════════════════════════════
// PATCH /folders/:id — Update a folder (move, etc.)
// ══════════════════════════════════════════════════
router.patch('/folders/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const db = req.committeeDb;
        const { name, parent_id, color } = req.body;

        const updates = [];
        const values = [];
        let idx = 1;

        if (name !== undefined) { updates.push(`name = $${idx++}`); values.push(name); }
        if (parent_id !== undefined) { updates.push(`parent_id = $${idx++}`); values.push(parent_id || null); }
        if (color !== undefined) { updates.push(`color = $${idx++}`); values.push(color); }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update.' });
        }

        updates.push(`updated_at = NOW()`);
        values.push(id);

        const result = await db.query(
            `UPDATE folders SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
            values
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Folder not found.' });
        }

        res.json({ success: true, folder: result.rows[0] });
    } catch (err) {
        console.error('Update folder error:', err.message);
        res.status(500).json({ error: 'Failed to update folder.' });
    }
});

// ══════════════════════════════════════════════════
// PATCH /files/:id/restore — Restore file from trash
// ══════════════════════════════════════════════════
router.patch('/files/:id/restore', async (req, res) => {
    try {
        const { id } = req.params;
        const db = req.committeeDb;

        const result = await db.query(
            `UPDATE files SET is_trashed = false, trashed_at = NULL, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
            [id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'File not found.' });
        }

        res.json({ success: true, message: 'File restored.', file: result.rows[0] });
    } catch (err) {
        console.error('Restore file error:', err.message);
        res.status(500).json({ error: 'Failed to restore file.' });
    }
});

// ══════════════════════════════════════════════════
// PATCH /folders/:id/restore — Restore folder from trash
// ══════════════════════════════════════════════════
router.patch('/folders/:id/restore', async (req, res) => {
    try {
        const { id } = req.params;
        const db = req.committeeDb;

        const result = await db.query(
            `UPDATE folders SET is_trashed = false, trashed_at = NULL, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
            [id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Folder not found.' });
        }

        res.json({ success: true, message: 'Folder restored.', folder: result.rows[0] });
    } catch (err) {
        console.error('Restore folder error:', err.message);
        res.status(500).json({ error: 'Failed to restore folder.' });
    }
});

// ══════════════════════════════════════════════════
// PATCH /files/:id/star — Toggle star on a file
// ══════════════════════════════════════════════════
router.patch('/files/:id/star', async (req, res) => {
    try {
        const { id } = req.params;
        const db = req.committeeDb;

        const result = await db.query(
            `UPDATE files SET is_starred = NOT is_starred, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
            [id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'File not found.' });
        }

        res.json({ success: true, file: result.rows[0] });
    } catch (err) {
        console.error('Star file error:', err.message);
        res.status(500).json({ error: 'Failed to toggle star.' });
    }
});

// ══════════════════════════════════════════════════
// PATCH /folders/:id/star — Toggle star on a folder
// ══════════════════════════════════════════════════
router.patch('/folders/:id/star', async (req, res) => {
    try {
        const { id } = req.params;
        const db = req.committeeDb;

        const result = await db.query(
            `UPDATE folders SET is_starred = NOT is_starred, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
            [id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Folder not found.' });
        }

        res.json({ success: true, folder: result.rows[0] });
    } catch (err) {
        console.error('Star folder error:', err.message);
        res.status(500).json({ error: 'Failed to toggle star.' });
    }
});

// ══════════════════════════════════════════════════
// DELETE /trash — Empty trash (permanently delete all)
// ══════════════════════════════════════════════════
router.delete('/trash', async (req, res) => {
    try {
        const db = req.committeeDb;

        // Get trashed files to delete from filesystem
        const trashedFiles = await db.query(
            'SELECT id, storage_path FROM files WHERE is_trashed = true'
        );

        // Delete files from filesystem
        for (const file of trashedFiles.rows) {
            try {
                const filePath = path.join(UPLOAD_BASE, file.storage_path);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            } catch (e) {
                console.error('Failed to delete physical file:', e.message);
            }
        }

        // Permanently delete from database
        await db.query('DELETE FROM files WHERE is_trashed = true');
        await db.query('DELETE FROM folders WHERE is_trashed = true');

        res.json({
            success: true,
            message: `Permanently deleted ${trashedFiles.rows.length} files.`,
        });
    } catch (err) {
        console.error('Empty trash error:', err.message);
        res.status(500).json({ error: 'Failed to empty trash.' });
    }
});

// ══════════════════════════════════════════════════
// GET /files/:id/download — Download a file
// ══════════════════════════════════════════════════
router.get('/files/:id/download', async (req, res) => {
    try {
        const { id } = req.params;
        const db = req.committeeDb;

        const result = await db.query(
            'SELECT * FROM files WHERE id = $1',
            [id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'File not found.' });
        }

        const file = result.rows[0];
        const filePath = path.join(UPLOAD_BASE, file.storage_path);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found on disk.' });
        }

        res.setHeader('Content-Disposition', `attachment; filename="${file.original_name}"`);
        res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
        fs.createReadStream(filePath).pipe(res);
    } catch (err) {
        console.error('Download error:', err.message);
        res.status(500).json({ error: 'Failed to download file.' });
    }
});

// ══════════════════════════════════════════════════
// GET /recent — Recently accessed files
// ══════════════════════════════════════════════════
router.get('/recent', async (req, res) => {
    try {
        const db = req.committeeDb;
        const { limit = 20 } = req.query;
        const parsedLimit = Math.min(parseInt(limit) || 20, 50);

        const result = await db.query(
            `SELECT * FROM files
             WHERE is_trashed = false
               AND last_accessed IS NOT NULL
             ORDER BY last_accessed DESC
             LIMIT $1`,
            [parsedLimit]
        );

        res.json({ success: true, files: result.rows });
    } catch (err) {
        console.error('Recent files error:', err.message);
        res.status(500).json({ error: 'Failed to fetch recent files.' });
    }
});

// ══════════════════════════════════════════════════
// GET /starred — Starred files and folders
// ══════════════════════════════════════════════════
router.get('/starred', async (req, res) => {
    try {
        const db = req.committeeDb;

        const filesResult = await db.query(
            `SELECT *, 'file' AS item_type FROM files
             WHERE is_starred = true AND is_trashed = false
             ORDER BY updated_at DESC`
        );

        const foldersResult = await db.query(
            `SELECT *, 'folder' AS item_type FROM folders
             WHERE is_starred = true AND is_trashed = false
             ORDER BY updated_at DESC`
        );

        res.json({
            success: true,
            files: filesResult.rows,
            folders: foldersResult.rows,
            items: [...foldersResult.rows, ...filesResult.rows],
        });
    } catch (err) {
        console.error('Starred items error:', err.message);
        res.status(500).json({ error: 'Failed to fetch starred items.' });
    }
});

// ══════════════════════════════════════════════════
// PATCH /files/:id/access — Mark file as recently accessed
// ══════════════════════════════════════════════════
router.patch('/files/:id/access', async (req, res) => {
    try {
        const db = req.committeeDb;
        const { id } = req.params;

        await db.query(
            `UPDATE files SET last_accessed = NOW() WHERE id = $1`,
            [id]
        );

        res.json({ success: true });
    } catch (err) {
        console.error('Mark access error:', err.message);
        res.status(500).json({ error: 'Failed to update file access.' });
    }
});

// ══════════════════════════════════════════════════
// PATCH /folders/:id — Update folder (name, color, icon)
// ══════════════════════════════════════════════════
router.patch('/folders/:id', async (req, res) => {
    try {
        const db = req.committeeDb;
        const { id } = req.params;
        const { name, color, icon } = req.body;

        const updates = [];
        const values = [];
        let paramIdx = 1;

        if (name !== undefined) {
            updates.push(`name = $${paramIdx++}`);
            values.push(name.trim());
        }
        if (color !== undefined) {
            updates.push(`color = $${paramIdx++}`);
            values.push(color);
        }
        if (icon !== undefined) {
            updates.push(`icon = $${paramIdx++}`);
            values.push(icon);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update.' });
        }

        values.push(id);
        const result = await db.query(
            `UPDATE folders SET ${updates.join(', ')}, updated_at = NOW()
             WHERE id = $${paramIdx}
             RETURNING *`,
            values
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Folder not found.' });
        }

        res.json({ success: true, folder: result.rows[0] });
    } catch (err) {
        console.error('Update folder error:', err.message);
        res.status(500).json({ error: 'Failed to update folder.' });
    }
});

module.exports = router;
