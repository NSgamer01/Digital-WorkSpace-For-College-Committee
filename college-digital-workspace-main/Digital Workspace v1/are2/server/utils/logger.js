// ============================================
// utils/logger.js — Activity Logging
// ============================================

const pool = require('../database/connection');

/**
 * Log an activity to the activity_log table.
 * Errors are caught silently — logging should never crash the app.
 *
 * @param {object} params
 * @param {string} params.userId     — Who performed the action
 * @param {string} params.action     — e.g. 'upload', 'download', 'delete'
 * @param {string} params.entityType — e.g. 'file', 'folder', 'user'
 * @param {string} params.entityId   — UUID of the entity
 * @param {string} params.entityName — Human-readable name
 * @param {object} params.details    — Extra JSONB data
 * @param {string} params.ipAddress  — Client IP
 * @param {string} params.userAgent  — Client user agent
 */
const logActivity = async ({
    userId,
    action,
    entityType,
    entityId,
    entityName = '',
    details = {},
    ipAddress = '',
    userAgent = '',
}) => {
    try {
        await pool.query(
            `INSERT INTO activity_log (user_id, action, entity_type, entity_id, entity_name, details, ip_address, user_agent)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [userId, action, entityType, entityId, entityName, JSON.stringify(details), ipAddress, userAgent]
        );
    } catch (error) {
        console.error('Activity log error:', error.message);
        // Silent fail — never crash the app for logging
    }
};

/**
 * Extract request metadata for logging.
 */
const getRequestMeta = (req) => ({
    ipAddress: req.ip || req.connection?.remoteAddress || '',
    userAgent: req.get('user-agent') || '',
});

module.exports = { logActivity, getRequestMeta };
