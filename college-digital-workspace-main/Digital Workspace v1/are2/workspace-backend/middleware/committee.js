// ============================================
// middleware/committee.js — Committee Resolution
// ============================================
// Resolves the committee from request headers/params,
// verifies membership, and attaches the correct database
// pool to the request.
//
// Exports:
//   committeeMiddleware         — required committee context
//   requireCommitteeRole        — role-based access control
//   optionalCommitteeMiddleware — optional committee context
// ============================================

const masterDb = require('../config/masterDb');
const committeeDbManager = require('../config/committeeDbManager');

/**
 * Main committee middleware.
 * Extracts committee slug, verifies membership, attaches database pool.
 */
async function committeeMiddleware(req, res, next) {
    try {
        // Extract committee slug from multiple sources
        const slug =
            req.headers['x-committee-slug'] ||
            req.headers['x-committee-id'] ||
            req.query.committeeSlug ||
            (req.body && req.body.committeeSlug) ||
            null;

        if (!slug) {
            const validSlugs = committeeDbManager.getRegisteredSlugs();
            return res.status(400).json({
                error: 'Committee slug is required. Set X-Committee-Slug header.',
                validSlugs,
            });
        }

        const normalizedSlug = slug.toLowerCase();

        // Look up committee in master database
        let committee;

        // Try by slug first, then by id
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);

        if (isUUID) {
            const result = await masterDb.query(
                'SELECT * FROM committees WHERE id = $1 AND is_active = true',
                [slug]
            );
            committee = result.rows[0];
        } else {
            const result = await masterDb.query(
                'SELECT * FROM committees WHERE slug = $1 AND is_active = true',
                [normalizedSlug]
            );
            committee = result.rows[0];
        }

        if (!committee) {
            return res.status(404).json({
                error: `Committee "${slug}" not found or is inactive`,
            });
        }

        // Verify user membership
        const memberResult = await masterDb.query(
            `SELECT * FROM committee_members
             WHERE committee_id = $1 AND user_id = $2 AND is_active = true`,
            [committee.id, req.user.id]
        );

        if (memberResult.rows.length === 0) {
            return res.status(403).json({
                error: `You are not a member of ${committee.name}`,
                committee: committee.name,
            });
        }

        const membership = memberResult.rows[0];

        // Get the committee's database pool
        const committeePool = committeeDbManager.getPool(committee.slug);

        // Attach everything to request
        req.committee = committee;
        req.committeeId = committee.id;
        req.committeeSlug = committee.slug;
        req.committeeName = committee.name;
        req.committeeDb = committeePool;
        req.membership = membership;
        req.committeeRole = membership.role;
        req.masterDb = masterDb;

        next();
    } catch (err) {
        console.error('  ❌ Committee middleware error:', err.message);
        return res.status(500).json({ error: 'Failed to resolve committee context' });
    }
}

/**
 * Role-based access control middleware.
 * Must be used AFTER committeeMiddleware.
 *
 * @param  {...string} allowedRoles - Roles that are permitted
 * @returns {Function} Express middleware
 *
 * Usage: requireCommitteeRole('head', 'admin', 'advisor')
 */
function requireCommitteeRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.committeeRole) {
            return res.status(403).json({
                error: 'Committee context not available',
            });
        }

        if (!allowedRoles.includes(req.committeeRole)) {
            return res.status(403).json({
                error: `This action requires one of: ${allowedRoles.join(', ')}`,
                yourRole: req.committeeRole,
                requiredRoles: allowedRoles,
            });
        }

        next();
    };
}

/**
 * Optional committee middleware.
 * Same as committeeMiddleware but never errors — sets null if not resolved.
 */
async function optionalCommitteeMiddleware(req, res, next) {
    try {
        const slug =
            req.headers['x-committee-slug'] ||
            req.headers['x-committee-id'] ||
            req.query.committeeSlug ||
            (req.body && req.body.committeeSlug) ||
            null;

        if (!slug) {
            req.committee = null;
            req.committeeDb = null;
            req.masterDb = masterDb;
            return next();
        }

        const normalizedSlug = slug.toLowerCase();

        const result = await masterDb.query(
            'SELECT * FROM committees WHERE slug = $1 AND is_active = true',
            [normalizedSlug]
        );

        if (result.rows.length === 0) {
            req.committee = null;
            req.committeeDb = null;
            req.masterDb = masterDb;
            return next();
        }

        const committee = result.rows[0];

        // Check membership (optional — don't error)
        const memberResult = await masterDb.query(
            `SELECT * FROM committee_members
             WHERE committee_id = $1 AND user_id = $2 AND is_active = true`,
            [committee.id, req.user.id]
        );

        if (memberResult.rows.length === 0) {
            req.committee = null;
            req.committeeDb = null;
            req.masterDb = masterDb;
            return next();
        }

        const membership = memberResult.rows[0];
        const committeePool = committeeDbManager.getPool(committee.slug);

        req.committee = committee;
        req.committeeId = committee.id;
        req.committeeSlug = committee.slug;
        req.committeeName = committee.name;
        req.committeeDb = committeePool;
        req.membership = membership;
        req.committeeRole = membership.role;
        req.masterDb = masterDb;

        next();
    } catch (err) {
        // Never error — just set null and continue
        req.committee = null;
        req.committeeDb = null;
        req.masterDb = masterDb;
        next();
    }
}

module.exports = {
    committeeMiddleware,
    requireCommitteeRole,
    optionalCommitteeMiddleware,
};
