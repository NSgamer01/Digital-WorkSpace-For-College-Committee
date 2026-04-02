// ============================================
// middleware/admin.js — Admin-Only Guard
// ============================================
// Checks if the authenticated user has global_role = 'admin'.
// Must be used AFTER authMiddleware.
// ============================================

const adminMiddleware = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated.' });
    }

    if (req.user.globalRole !== 'admin' && req.user.globalRole !== 'superadmin') {
        return res.status(403).json({ error: 'Admin access required.' });
    }

    next();
};

module.exports = adminMiddleware;
