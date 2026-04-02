// ============================================
// middleware/committee.js
// ============================================
// Committee resolution middleware. Reads committee
// slug/id from headers, verifies membership, and
// attaches the correct DB pool to the request.
// ============================================

const masterDb = require('../config/masterDb');
const committeeDbManager = require('../config/committeeDbManager');

/**
 * committeeMiddleware
 *
 * Extracts committee identifier from request, looks it up in the master DB,
 * verifies user membership, and attaches the committee-specific DB pool.
 *
 * Attaches to req:
 *   - committee       (full committee row)
 *   - committeeId     (UUID)
 *   - committeeSlug   (string)
 *   - committeeName   (string)
 *   - committeeDb     (pg.Pool for the committee's database)
 *   - membership      (full committee_members row)
 *   - committeeRole   (string: 'head', 'admin', etc.)
 *   - masterDb        (pg.Pool for workspace_master)
 */
const committeeMiddleware = async (req, res, next) => {
    try {
        // Extract committee identifier from multiple sources
        const slug = req.headers['x-committee-slug']
            || req.query.committeeSlug
            || req.body?.committeeSlug;

        const committeeId = req.headers['x-committee-id']
            || req.query.committeeId
            || req.body?.committeeId;

        if (!slug && !committeeId) {
            const validSlugs = committeeDbManager.getRegisteredSlugs();
            return res.status(400).json({
                error: 'Committee identifier is required. Provide X-Committee-Slug header, X-Committee-ID header, or query/body parameter.',
                validSlugs,
            });
        }

        // Look up committee in master DB
        let committeeRow;
        if (slug) {
            const result = await masterDb.query(
                `SELECT * FROM committees WHERE slug = $1 AND is_active = true`,
                [slug.toLowerCase()]
            );
            committeeRow = result.rows[0];
        } else {
            const result = await masterDb.query(
                `SELECT * FROM committees WHERE id = $1 AND is_active = true`,
                [committeeId]
            );
            committeeRow = result.rows[0];
        }

        if (!committeeRow) {
            return res.status(404).json({
                error: `Committee not found${slug ? `: "${slug}"` : ''}.`,
                validSlugs: committeeDbManager.getRegisteredSlugs(),
            });
        }

        // Verify user membership
        const memberResult = await masterDb.query(
            `SELECT * FROM committee_members
       WHERE committee_id = $1 AND user_id = $2 AND is_active = true`,
            [committeeRow.id, req.user.userId]
        );

        if (memberResult.rowCount === 0) {
            return res.status(403).json({
                error: `You are not a member of the ${committeeRow.name} committee.`,
                code: 'NOT_A_MEMBER',
            });
        }

        const membership = memberResult.rows[0];

        // Get committee DB pool
        const committeePool = committeeDbManager.getPool(committeeRow.slug);

        // Attach everything to req
        req.committee = committeeRow;
        req.committeeId = committeeRow.id;
        req.committeeSlug = committeeRow.slug;
        req.committeeName = committeeRow.name;
        req.committeeDb = committeePool;
        req.membership = membership;
        req.committeeRole = membership.role;
        req.masterDb = masterDb;

        next();
    } catch (err) {
        console.error('Committee middleware error:', err.message);
        return res.status(500).json({
            error: 'Failed to resolve committee context.',
        });
    }
};

/**
 * requireCommitteeRole(...allowedRoles)
 *
 * Returns middleware that checks req.committeeRole against the provided roles.
 * Must be used AFTER committeeMiddleware.
 *
 * @param  {...string} allowedRoles - Roles that are allowed access
 * @returns {Function} Express middleware
 */
const requireCommitteeRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.committeeRole) {
            return res.status(403).json({
                error: 'Committee role not found. Ensure committeeMiddleware runs before this.',
            });
        }

        if (!allowedRoles.includes(req.committeeRole)) {
            return res.status(403).json({
                error: `Access denied. Your role "${req.committeeRole}" does not have permission for this action.`,
                yourRole: req.committeeRole,
                requiredRoles: allowedRoles,
            });
        }

        next();
    };
};

/**
 * optionalCommitteeMiddleware
 *
 * Same as committeeMiddleware but doesn't fail if committee is not provided.
 * Sets req.committee/committeeDb to null if not provided or invalid.
 */
const optionalCommitteeMiddleware = async (req, res, next) => {
    try {
        const slug = req.headers['x-committee-slug']
            || req.query.committeeSlug
            || req.body?.committeeSlug;

        const committeeId = req.headers['x-committee-id']
            || req.query.committeeId
            || req.body?.committeeId;

        if (!slug && !committeeId) {
            req.committee = null;
            req.committeeDb = null;
            req.committeeSlug = null;
            req.committeeRole = null;
            req.masterDb = masterDb;
            return next();
        }

        // Look up committee
        let committeeRow;
        if (slug) {
            const result = await masterDb.query(
                `SELECT * FROM committees WHERE slug = $1 AND is_active = true`,
                [slug.toLowerCase()]
            );
            committeeRow = result.rows[0];
        } else {
            const result = await masterDb.query(
                `SELECT * FROM committees WHERE id = $1 AND is_active = true`,
                [committeeId]
            );
            committeeRow = result.rows[0];
        }

        if (!committeeRow) {
            req.committee = null;
            req.committeeDb = null;
            req.committeeSlug = null;
            req.committeeRole = null;
            req.masterDb = masterDb;
            return next();
        }

        // Check membership (optional — don't block)
        const memberResult = await masterDb.query(
            `SELECT * FROM committee_members
       WHERE committee_id = $1 AND user_id = $2 AND is_active = true`,
            [committeeRow.id, req.user.userId]
        );

        if (memberResult.rowCount === 0) {
            req.committee = committeeRow;
            req.committeeDb = null;
            req.committeeSlug = committeeRow.slug;
            req.committeeRole = null;
            req.masterDb = masterDb;
            return next();
        }

        const membership = memberResult.rows[0];
        const committeePool = committeeDbManager.getPool(committeeRow.slug);

        req.committee = committeeRow;
        req.committeeId = committeeRow.id;
        req.committeeSlug = committeeRow.slug;
        req.committeeName = committeeRow.name;
        req.committeeDb = committeePool;
        req.membership = membership;
        req.committeeRole = membership.role;
        req.masterDb = masterDb;

        next();
    } catch (err) {
        console.error('Optional committee middleware error:', err.message);
        req.committee = null;
        req.committeeDb = null;
        req.committeeSlug = null;
        req.committeeRole = null;
        req.masterDb = masterDb;
        next();
    }
};

module.exports = {
    committeeMiddleware,
    requireCommitteeRole,
    optionalCommitteeMiddleware,
};
