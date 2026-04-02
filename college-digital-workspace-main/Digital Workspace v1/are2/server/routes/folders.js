// ============================================
// routes/folders.js — Folder Operations Routes
// ============================================

const express = require('express');
const pool = require('../database/connection');
const { verifyToken } = require('../middleware/auth');
const { logActivity, getRequestMeta } = require('../utils/logger');
const { validateFileName, sanitizeInput } = require('../utils/validation');

const router = express.Router();
router.use(verifyToken);

// ═══════════════════════════════════════════════
//  CREATE FOLDER
//  POST /api/drive/folders
// ═══════════════════════════════════════════════
router.post('/', async (req, res, next) => {
    try {
        const { name, parentId, color, icon, description } = req.body;

        if (!name || !validateFileName(name)) {
            return res.status(400).json({ error: 'Valid folder name is required' });
        }

        // Calculate path
        let folderPath = '/';
        if (parentId) {
            const parent = await pool.query('SELECT path, name FROM folders WHERE id = $1', [parentId]);
            if (parent.rows.length === 0) {
                return res.status(404).json({ error: 'Parent folder not found' });
            }
            folderPath = `${parent.rows[0].path}${parent.rows[0].name}/`;
        }

        const result = await pool.query(
            `INSERT INTO folders (name, parent_id, created_by, path, color, icon, description)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [sanitizeInput(name), parentId || null, req.user.userId, folderPath,
            color || '#6366f1', icon || '📁', description || '']
        );

        const folder = result.rows[0];

        // Get with creator info
        const folderResult = await pool.query(
            `SELECT fo.*, u.name AS creator_name
             FROM folders fo LEFT JOIN users u ON fo.created_by = u.id
             WHERE fo.id = $1`,
            [folder.id]
        );

        const meta = getRequestMeta(req);
        logActivity({
            userId: req.user.userId, action: 'create_folder', entityType: 'folder',
            entityId: folder.id, entityName: folder.name, ...meta,
        });

        res.status(201).json({ folder: folderResult.rows[0] });
    } catch (error) {
        next(error);
    }
});

// ═══════════════════════════════════════════════
//  UPDATE FOLDER
//  PATCH /api/drive/folders/:folderId
// ═══════════════════════════════════════════════
router.patch('/:folderId', async (req, res, next) => {
    try {
        const { name, color, icon, description } = req.body;
        const updates = [];
        const values = [];
        let paramIdx = 1;

        if (name !== undefined) {
            if (!validateFileName(name)) return res.status(400).json({ error: 'Invalid folder name' });
            updates.push(`name = $${paramIdx++}`);
            values.push(sanitizeInput(name));
        }
        if (color !== undefined) { updates.push(`color = $${paramIdx++}`); values.push(color); }
        if (icon !== undefined) { updates.push(`icon = $${paramIdx++}`); values.push(icon); }
        if (description !== undefined) { updates.push(`description = $${paramIdx++}`); values.push(sanitizeInput(description)); }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        values.push(req.params.folderId, req.user.userId);

        const result = await pool.query(
            `UPDATE folders SET ${updates.join(', ')} WHERE id = $${paramIdx++} AND created_by = $${paramIdx}
             RETURNING *`,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Folder not found' });
        }

        res.json({ folder: result.rows[0] });
    } catch (error) {
        next(error);
    }
});

// ═══════════════════════════════════════════════
//  STAR FOLDER
//  PATCH /api/drive/folders/:folderId/star
// ═══════════════════════════════════════════════
router.patch('/:folderId/star', async (req, res, next) => {
    try {
        const { starred } = req.body;

        let result;
        if (starred !== undefined) {
            result = await pool.query(
                'UPDATE folders SET is_starred = $1 WHERE id = $2 AND created_by = $3 RETURNING *',
                [starred, req.params.folderId, req.user.userId]
            );
        } else {
            result = await pool.query(
                'UPDATE folders SET is_starred = NOT is_starred WHERE id = $1 AND created_by = $2 RETURNING *',
                [req.params.folderId, req.user.userId]
            );
        }

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Folder not found' });
        }

        res.json({ success: true, folder: result.rows[0] });
    } catch (error) {
        next(error);
    }
});

// ═══════════════════════════════════════════════
//  DELETE FOLDER (soft delete with recursive)
//  DELETE /api/drive/folders/:folderId
// ═══════════════════════════════════════════════
router.delete('/:folderId', async (req, res, next) => {
    try {
        // Use CTE to find all subfolders
        const result = await pool.query(
            `WITH RECURSIVE subfolder_ids AS (
                SELECT id FROM folders WHERE id = $1 AND created_by = $2
                UNION ALL
                SELECT fo.id FROM folders fo JOIN subfolder_ids sf ON fo.parent_id = sf.id
            )
            UPDATE folders SET is_trashed = true, trashed_at = NOW()
            WHERE id IN (SELECT id FROM subfolder_ids)`,
            [req.params.folderId, req.user.userId]
        );

        // Also trash files in those folders
        await pool.query(
            `WITH RECURSIVE subfolder_ids AS (
                SELECT id FROM folders WHERE id = $1
                UNION ALL
                SELECT fo.id FROM folders fo JOIN subfolder_ids sf ON fo.parent_id = sf.id
            )
            UPDATE files SET is_trashed = true, trashed_at = NOW()
            WHERE folder_id IN (SELECT id FROM subfolder_ids)`,
            [req.params.folderId]
        );

        const meta = getRequestMeta(req);
        logActivity({
            userId: req.user.userId, action: 'delete_folder', entityType: 'folder',
            entityId: req.params.folderId, entityName: '', ...meta,
        });

        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});

// ═══════════════════════════════════════════════
//  MOVE FOLDER
//  PATCH /api/drive/folders/:folderId/move
// ═══════════════════════════════════════════════
router.patch('/:folderId/move', async (req, res, next) => {
    try {
        const { parentId } = req.body;

        // Prevent moving to self
        if (parentId === req.params.folderId) {
            return res.status(400).json({ error: 'Cannot move folder into itself' });
        }

        // Prevent moving to own child (circular reference check)
        if (parentId) {
            const result = await pool.query(
                `WITH RECURSIVE subfolder_ids AS (
                    SELECT id FROM folders WHERE id = $1
                    UNION ALL
                    SELECT fo.id FROM folders fo JOIN subfolder_ids sf ON fo.parent_id = sf.id
                )
                SELECT id FROM subfolder_ids WHERE id = $2`,
                [req.params.folderId, parentId]
            );
            if (result.rows.length > 0) {
                return res.status(400).json({ error: 'Cannot move folder into its own subfolder' });
            }
        }

        // Calculate new path based on new parent
        let newPath = '/';
        if (parentId) {
            const parent = await pool.query('SELECT path, name FROM folders WHERE id = $1', [parentId]);
            if (parent.rows.length > 0) {
                newPath = `${parent.rows[0].path}${parent.rows[0].name}/`;
            }
        }

        // Get old path for this folder (to update descendants)
        const oldFolder = await pool.query(
            'SELECT path, name FROM folders WHERE id = $1 AND created_by = $2',
            [req.params.folderId, req.user.userId]
        );
        if (oldFolder.rows.length === 0) {
            return res.status(404).json({ error: 'Folder not found' });
        }

        const oldFullPath = `${oldFolder.rows[0].path}${oldFolder.rows[0].name}/`;
        const newFullPath = `${newPath}${oldFolder.rows[0].name}/`;

        // Update the folder itself
        const updateResult = await pool.query(
            'UPDATE folders SET parent_id = $1, path = $2 WHERE id = $3 AND created_by = $4 RETURNING *',
            [parentId || null, newPath, req.params.folderId, req.user.userId]
        );

        // Update paths of all descendant folders (replace old prefix with new)
        if (oldFullPath !== newFullPath) {
            await pool.query(
                `UPDATE folders SET path = $1 || substring(path from $2)
                 WHERE path LIKE $3 AND id != $4`,
                [newFullPath, oldFullPath.length + 1, `${oldFullPath}%`, req.params.folderId]
            );
        }

        res.json({ success: true, folder: updateResult.rows[0] });
    } catch (error) {
        next(error);
    }
});

// ═══════════════════════════════════════════════
//  FOLDER CONTENTS
//  GET /api/drive/folders/:folderId/contents
// ═══════════════════════════════════════════════
router.get('/:folderId/contents', async (req, res, next) => {
    try {
        const files = await pool.query(
            `SELECT f.*, u.name AS uploader_name, u.avatar AS uploader_avatar
             FROM files f LEFT JOIN users u ON f.uploaded_by = u.id
             WHERE f.folder_id = $1 AND f.is_trashed = false
             ORDER BY f.created_at DESC`,
            [req.params.folderId]
        );

        const subfolders = await pool.query(
            `SELECT fo.*, u.name AS creator_name,
                (SELECT COUNT(*) FROM files WHERE folder_id = fo.id AND is_trashed = false) AS file_count
             FROM folders fo LEFT JOIN users u ON fo.created_by = u.id
             WHERE fo.parent_id = $1 AND fo.is_trashed = false
             ORDER BY fo.name ASC`,
            [req.params.folderId]
        );

        res.json({ files: files.rows, folders: subfolders.rows });
    } catch (error) {
        next(error);
    }
});

// ═══════════════════════════════════════════════
//  FOLDER TREE
//  GET /api/drive/folder-tree
// ═══════════════════════════════════════════════
router.get('/', async (req, res, next) => {
    try {
        const { parentId } = req.query;

        let query = `
            SELECT fo.*, u.name AS creator_name,
                (SELECT COUNT(*) FROM files WHERE folder_id = fo.id AND is_trashed = false) AS file_count,
                (SELECT COALESCE(SUM(size), 0) FROM files WHERE folder_id = fo.id AND is_trashed = false) AS total_size
            FROM folders fo LEFT JOIN users u ON fo.created_by = u.id
            WHERE fo.is_trashed = false AND fo.created_by = $1`;
        const params = [req.user.userId];

        if (parentId) {
            query += ' AND fo.parent_id = $2';
            params.push(parentId);
        } else {
            query += ' AND fo.parent_id IS NULL';
        }

        query += ' ORDER BY fo.name ASC';

        const result = await pool.query(query, params);
        res.json({ folders: result.rows });
    } catch (error) {
        next(error);
    }
});

// ═══════════════════════════════════════════════
//  FOLDER PATH (breadcrumb)
//  GET /api/drive/folders/:folderId/path
// ═══════════════════════════════════════════════
router.get('/:folderId/path', async (req, res, next) => {
    try {
        const { folderId } = req.params;
        const path = [];

        // Walk up the folder tree
        let currentId = folderId;
        let safety = 20; // prevent infinite loops
        while (currentId && safety-- > 0) {
            const result = await pool.query(
                'SELECT id, name, parent_id FROM folders WHERE id = $1 AND is_trashed = false',
                [currentId]
            );
            if (result.rows.length === 0) break;
            path.unshift({ id: result.rows[0].id, name: result.rows[0].name });
            currentId = result.rows[0].parent_id;
        }

        res.json({ path });
    } catch (error) {
        next(error);
    }
});

// ═══════════════════════════════════════════════
//  TRASH FOLDER (soft delete single folder)
//  PATCH /api/drive/folders/:folderId/trash
// ═══════════════════════════════════════════════
router.patch('/:folderId/trash', async (req, res, next) => {
    try {
        const result = await pool.query(
            `UPDATE folders SET is_trashed = true, trashed_at = NOW()
             WHERE id = $1 AND created_by = $2 RETURNING *`,
            [req.params.folderId, req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Folder not found' });
        }

        // Also trash files in this folder
        await pool.query(
            'UPDATE files SET is_trashed = true, trashed_at = NOW() WHERE folder_id = $1',
            [req.params.folderId]
        );

        const meta = getRequestMeta(req);
        logActivity({
            userId: req.user.userId, action: 'trash_folder', entityType: 'folder',
            entityId: req.params.folderId, entityName: result.rows[0].name, ...meta,
        });

        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});

// ═══════════════════════════════════════════════
//  RESTORE FOLDER from trash
//  PATCH /api/drive/folders/:folderId/restore
// ═══════════════════════════════════════════════
router.patch('/:folderId/restore', async (req, res, next) => {
    try {
        const result = await pool.query(
            `UPDATE folders SET is_trashed = false, trashed_at = NULL
             WHERE id = $1 AND created_by = $2 RETURNING *`,
            [req.params.folderId, req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Folder not found' });
        }

        // Also restore files in this folder
        await pool.query(
            'UPDATE files SET is_trashed = false, trashed_at = NULL WHERE folder_id = $1',
            [req.params.folderId]
        );

        const meta = getRequestMeta(req);
        logActivity({
            userId: req.user.userId, action: 'restore_folder', entityType: 'folder',
            entityId: req.params.folderId, entityName: result.rows[0].name, ...meta,
        });

        res.json({ success: true, folder: result.rows[0] });
    } catch (error) {
        next(error);
    }
});

// ═══════════════════════════════════════════════
//  REORDER FOLDERS (batch position update)
//  PATCH /api/drive/folders/reorder
// ═══════════════════════════════════════════════
router.patch('/reorder', async (req, res, next) => {
    try {
        const { items } = req.body; // [{ id, position }]

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Items array required' });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            for (const item of items) {
                await client.query(
                    'UPDATE folders SET position = $1 WHERE id = $2 AND created_by = $3',
                    [item.position, item.id, req.user.userId]
                );
            }
            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }

        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});

// ═══════════════════════════════════════════════
//  SHARE FOLDER
//  POST /api/drive/folders/:folderId/share
// ═══════════════════════════════════════════════
router.post('/:folderId/share', async (req, res, next) => {
    try {
        const { userId, permission = 'view' } = req.body;

        if (!userId) {
            return res.status(400).json({ error: 'User ID required' });
        }

        // Verify folder belongs to current user
        const folder = await pool.query(
            'SELECT id, name FROM folders WHERE id = $1 AND created_by = $2',
            [req.params.folderId, req.user.userId]
        );
        if (folder.rows.length === 0) {
            return res.status(404).json({ error: 'Folder not found' });
        }

        // Upsert share (update permission if already shared)
        const result = await pool.query(
            `INSERT INTO folder_shares (folder_id, shared_by, shared_with, permission)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (folder_id, shared_with) DO UPDATE SET permission = $4
             RETURNING *`,
            [req.params.folderId, req.user.userId, userId, permission]
        );

        const meta = getRequestMeta(req);
        logActivity({
            userId: req.user.userId, action: 'share_folder', entityType: 'folder',
            entityId: req.params.folderId, entityName: folder.rows[0].name,
            details: { sharedWith: userId, permission }, ...meta,
        });

        res.json({ share: result.rows[0] });
    } catch (error) {
        next(error);
    }
});

// ═══════════════════════════════════════════════
//  GET FOLDER SHARES
//  GET /api/drive/folders/:folderId/shares
// ═══════════════════════════════════════════════
router.get('/:folderId/shares', async (req, res, next) => {
    try {
        const result = await pool.query(
            `SELECT fs.*, u.name AS user_name, u.email AS user_email, u.avatar AS user_avatar
             FROM folder_shares fs
             LEFT JOIN users u ON fs.shared_with = u.id
             WHERE fs.folder_id = $1 AND fs.shared_by = $2
             ORDER BY fs.created_at DESC`,
            [req.params.folderId, req.user.userId]
        );

        res.json({ shares: result.rows });
    } catch (error) {
        next(error);
    }
});

// ═══════════════════════════════════════════════
//  DELETE FOLDER SHARE
//  DELETE /api/drive/folder-shares/:shareId
// ═══════════════════════════════════════════════
router.delete('/folder-shares/:shareId', async (req, res, next) => {
    try {
        const result = await pool.query(
            'DELETE FROM folder_shares WHERE id = $1 AND shared_by = $2 RETURNING *',
            [req.params.shareId, req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Share not found' });
        }

        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
