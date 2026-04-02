// ============================================
// utils/enrichUsers.js — User Enrichment Helper
// ============================================
// Batch-fetches user names, emails, and avatars from
// workspace_master and attaches them to rows from
// committee database queries.
// ============================================

/**
 * Enrich rows with user name, email, and avatar from the master database.
 *
 * @param {Pool} masterDb - Master database pool
 * @param {Array} rows - Array of row objects from committee DB query
 * @param {string} userIdField - Name of the field containing user UUIDs (e.g. 'created_by')
 * @returns {Array} Rows with appended user_name, user_email, user_avatar
 */
async function enrichWithUserNames(masterDb, rows, userIdField) {
    if (!rows || rows.length === 0) {
        return rows;
    }

    // Collect unique user IDs, filtering out null/undefined
    const userIds = [...new Set(
        rows
            .map((row) => row[userIdField])
            .filter((id) => id !== null && id !== undefined)
    )];

    if (userIds.length === 0) {
        return rows.map((row) => ({
            ...row,
            user_name: 'Unknown',
            user_email: '',
            user_avatar: null,
        }));
    }

    // Batch fetch from master database
    const result = await masterDb.query(
        'SELECT id, name, email, avatar FROM users WHERE id = ANY($1)',
        [userIds]
    );

    // Build lookup map
    const userMap = {};
    for (const user of result.rows) {
        userMap[user.id] = {
            name: user.name,
            email: user.email,
            avatar: user.avatar,
        };
    }

    // Enrich rows
    return rows.map((row) => ({
        ...row,
        user_name: userMap[row[userIdField]]?.name || 'Unknown',
        user_email: userMap[row[userIdField]]?.email || '',
        user_avatar: userMap[row[userIdField]]?.avatar || null,
    }));
}

module.exports = { enrichWithUserNames };
