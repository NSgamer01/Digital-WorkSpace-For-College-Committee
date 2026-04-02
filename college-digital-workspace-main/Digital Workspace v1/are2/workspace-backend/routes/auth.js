// ============================================
// routes/auth.js — Authentication Routes
// ============================================
// Uses masterDb directly. Firebase handles actual login —
// these routes handle PostgreSQL user profile + committee data.
// ============================================

const express = require('express');
const router = express.Router();
const masterDb = require('../config/masterDb');
const firebaseAuth = require('../middleware/firebaseAuth');

// ═══════════════════════════════════════════════
//  POST /register
// ═══════════════════════════════════════════════
// Body: { firebaseUid, email, name }
// Creates or finds user in PostgreSQL
router.post('/register', async (req, res) => {
    try {
        const { firebaseUid, email, name } = req.body;

        if (!firebaseUid || !email) {
            return res.status(400).json({ error: 'firebaseUid and email are required' });
        }

        const userName = name || email.split('@')[0];

        const result = await masterDb.query(
            `INSERT INTO users (firebase_uid, email, name)
             VALUES ($1, $2, $3)
             ON CONFLICT (firebase_uid) DO UPDATE SET
                email = EXCLUDED.email,
                name = CASE WHEN users.name = '' OR users.name IS NULL THEN EXCLUDED.name ELSE users.name END,
                updated_at = NOW()
             RETURNING *`,
            [firebaseUid, email, userName]
        );

        const user = result.rows[0];

        res.status(201).json({
            success: true,
            user: {
                id: user.id,
                firebaseUid: user.firebase_uid,
                email: user.email,
                name: user.name,
                avatar: user.avatar,
                globalRole: user.global_role,
                createdAt: user.created_at,
            },
            committees: [],
        });
    } catch (err) {
        console.error('  ❌ Register error:', err.message);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// ═══════════════════════════════════════════════
//  POST /login
// ═══════════════════════════════════════════════
// Body: { firebaseUid }
// Returns user profile + their committees
router.post('/login', async (req, res) => {
    try {
        const { firebaseUid } = req.body;

        if (!firebaseUid) {
            return res.status(400).json({ error: 'firebaseUid is required' });
        }

        // Look up user
        const userResult = await masterDb.query(
            'SELECT * FROM users WHERE firebase_uid = $1',
            [firebaseUid]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found. Please register first.' });
        }

        const user = userResult.rows[0];

        // Update last_login
        await masterDb.query(
            'UPDATE users SET last_login = NOW() WHERE id = $1',
            [user.id]
        );

        // Fetch user's committees
        const committeesResult = await masterDb.query(
            `SELECT c.*, cm.role, cm.position, cm.joined_at
             FROM committees c
             JOIN committee_members cm ON c.id = cm.committee_id
             WHERE cm.user_id = $1 AND cm.is_active = true AND c.is_active = true
             ORDER BY c.name`,
            [user.id]
        );

        res.json({
            success: true,
            user: {
                id: user.id,
                firebaseUid: user.firebase_uid,
                email: user.email,
                name: user.name,
                avatar: user.avatar,
                phone: user.phone,
                globalRole: user.global_role,
                lastCommitteeSlug: user.last_committee_slug,
                storageUsed: user.storage_used,
                storageLimit: user.storage_limit,
                lastLogin: user.last_login,
                createdAt: user.created_at,
            },
            committees: committeesResult.rows.map((c) => ({
                id: c.id,
                name: c.name,
                fullName: c.full_name,
                slug: c.slug,
                description: c.description,
                color: c.color,
                icon: c.icon,
                role: c.role,
                position: c.position,
                joinedAt: c.joined_at,
            })),
            lastCommitteeSlug: user.last_committee_slug,
        });
    } catch (err) {
        console.error('  ❌ Login error:', err.message);
        res.status(500).json({ error: 'Login failed' });
    }
});

// ═══════════════════════════════════════════════
//  GET /me — Current user profile
// ═══════════════════════════════════════════════
// Requires Firebase auth
router.get('/me', firebaseAuth, async (req, res) => {
    try {
        // Fetch full user record
        const userResult = await masterDb.query(
            'SELECT * FROM users WHERE id = $1',
            [req.user.id]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = userResult.rows[0];

        // Fetch committees
        const committeesResult = await masterDb.query(
            `SELECT c.*, cm.role, cm.position, cm.joined_at
             FROM committees c
             JOIN committee_members cm ON c.id = cm.committee_id
             WHERE cm.user_id = $1 AND cm.is_active = true AND c.is_active = true
             ORDER BY c.name`,
            [user.id]
        );

        res.json({
            success: true,
            user: {
                id: user.id,
                firebaseUid: user.firebase_uid,
                email: user.email,
                name: user.name,
                avatar: user.avatar,
                phone: user.phone,
                globalRole: user.global_role,
                lastCommitteeSlug: user.last_committee_slug,
                storageUsed: user.storage_used,
                storageLimit: user.storage_limit,
                isActive: user.is_active,
                lastLogin: user.last_login,
                createdAt: user.created_at,
            },
            committees: committeesResult.rows.map((c) => ({
                id: c.id,
                name: c.name,
                fullName: c.full_name,
                slug: c.slug,
                description: c.description,
                color: c.color,
                icon: c.icon,
                role: c.role,
                position: c.position,
                joinedAt: c.joined_at,
            })),
        });
    } catch (err) {
        console.error('  ❌ Get profile error:', err.message);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// ═══════════════════════════════════════════════
//  PATCH /profile — Update profile
// ═══════════════════════════════════════════════
// Requires Firebase auth
router.patch('/profile', firebaseAuth, async (req, res) => {
    try {
        const { name, phone, avatar } = req.body;

        const updates = [];
        const values = [];
        let paramIndex = 1;

        if (name !== undefined) {
            updates.push(`name = $${paramIndex++}`);
            values.push(name);
        }
        if (phone !== undefined) {
            updates.push(`phone = $${paramIndex++}`);
            values.push(phone);
        }
        if (avatar !== undefined) {
            updates.push(`avatar = $${paramIndex++}`);
            values.push(avatar);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        updates.push(`updated_at = NOW()`);
        values.push(req.user.id);

        const result = await masterDb.query(
            `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = result.rows[0];

        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                avatar: user.avatar,
                phone: user.phone,
                globalRole: user.global_role,
                updatedAt: user.updated_at,
            },
        });
    } catch (err) {
        console.error('  ❌ Update profile error:', err.message);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

module.exports = router;
