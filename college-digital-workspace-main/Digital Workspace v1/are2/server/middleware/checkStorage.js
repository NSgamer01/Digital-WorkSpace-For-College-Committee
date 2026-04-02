// ============================================
// middleware/checkStorage.js — Storage Quota
// ============================================

const pool = require('../database/connection');

/**
 * Check if user has enough storage quota before upload.
 * Reads Content-Length header to estimate incoming file size.
 */
const checkStorage = async (req, res, next) => {
    try {
        const userId = req.user.userId;

        // Get user quota
        const result = await pool.query(
            'SELECT storage_used, storage_limit FROM users WHERE id = $1',
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // PostgreSQL returns BIGINT as strings — must parse to numbers!
        const storage_used = parseInt(result.rows[0].storage_used, 10) || 0;
        const storage_limit = parseInt(result.rows[0].storage_limit, 10) || 0;
        const contentLength = parseInt(req.headers['content-length'], 10) || 0;

        if (storage_used + contentLength > storage_limit) {
            const used = Math.round(storage_used / 1024 / 1024);
            const limit = Math.round(storage_limit / 1024 / 1024);
            const available = Math.max(0, Math.round((storage_limit - storage_used) / 1024 / 1024));

            return res.status(413).json({
                error: 'Storage quota exceeded',
                used: `${used} MB`,
                limit: `${limit} MB`,
                available: `${available} MB`,
            });
        }

        next();
    } catch (error) {
        console.error('Storage check error:', error);
        next(); // Don't block upload on check failure
    }
};

module.exports = checkStorage;
