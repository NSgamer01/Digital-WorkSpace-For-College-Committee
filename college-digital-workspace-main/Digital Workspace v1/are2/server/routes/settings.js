// ============================================
// routes/settings.js — User Settings CRUD API
// ============================================
// All settings are per-user, stored in workspace_master.user_settings.
// These routes use masterDb directly (no committee middleware).
// All routes require firebaseAuth (auth) middleware (mounted in server.js).
// ============================================

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const masterDb = require('../config/masterDb');

// ── Multer config for avatar & cover uploads ────────────────────
const uploadBase = path.resolve(__dirname, '..', process.env.UPLOAD_BASE_DIR || '../workspace Drive/Uploads');

const avatarStorage = multer.diskStorage({
    destination: (req, _file, cb) => {
        const dir = path.join(uploadBase, 'avatars', req.user.userId);
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${uuidv4()}${ext}`);
    },
});

const coverStorage = multer.diskStorage({
    destination: (req, _file, cb) => {
        const dir = path.join(uploadBase, 'covers', req.user.userId);
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${uuidv4()}${ext}`);
    },
});

const uploadAvatar = multer({
    storage: avatarStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif|webp/;
        const ok = allowed.test(path.extname(file.originalname).toLowerCase()) && allowed.test(file.mimetype);
        cb(ok ? null : new Error('Only image files are allowed'), ok);
    },
});

const uploadCover = multer({
    storage: coverStorage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif|webp/;
        const ok = allowed.test(path.extname(file.originalname).toLowerCase()) && allowed.test(file.mimetype);
        cb(ok ? null : new Error('Only image files are allowed'), ok);
    },
});

// ── Helper: map flat DB rows → nested response ─────────────────
function mapSettingsToResponse(settingsRow, userRow) {
    return {
        profile: {
            displayName: userRow.name || '',
            email: userRow.email || '',
            phone: userRow.phone || '',
            avatar: userRow.avatar || null,
            bio: settingsRow.bio || '',
            coverPhoto: settingsRow.cover_photo || null,
            location: settingsRow.location || '',
            socialLinkedin: settingsRow.social_linkedin || '',
            socialGithub: settingsRow.social_github || '',
            socialTwitter: settingsRow.social_twitter || '',
            createdAt: userRow.created_at || null,
        },
        notifications: {
            browser: settingsRow.notif_browser,
            email: settingsRow.notif_email,
            taskAssigned: settingsRow.notif_task_assigned,
            taskUpdated: settingsRow.notif_task_updated,
            eventInvitation: settingsRow.notif_event_invitation,
            messageMention: settingsRow.notif_message_mention,
            announcement: settingsRow.notif_announcement,
            deadlineReminder: settingsRow.notif_deadline_reminder,
            digestEmail: settingsRow.notif_digest_email,
            reminderMinutes: settingsRow.notif_reminder_minutes || [15, 60],
        },
        calendar: {
            defaultView: settingsRow.cal_default_view,
            workingHoursStart: settingsRow.cal_working_hours_start,
            workingHoursEnd: settingsRow.cal_working_hours_end,
            weekStartsOn: settingsRow.cal_week_starts_on,
            googleConnected: settingsRow.cal_google_connected,
            syncEnabled: settingsRow.cal_sync_enabled,
        },
        privacy: {
            showOnline: settingsRow.privacy_show_online,
            showLastSeen: settingsRow.privacy_show_last_seen,
            showEmail: settingsRow.privacy_show_email,
            showPhone: settingsRow.privacy_show_phone,
            profileVisibility: settingsRow.privacy_profile_visibility,
            allowDms: settingsRow.privacy_allow_dms,
        },
        appearance: {
            theme: settingsRow.theme,
            accentColor: settingsRow.accent_color,
            compactMode: settingsRow.compact_mode,
            fontSize: settingsRow.font_size,
        },
        accessibility: {
            reduceMotion: settingsRow.reduce_motion,
            highContrast: settingsRow.high_contrast,
            screenReaderMode: settingsRow.screen_reader_mode,
        },
        storage: {
            autoDeleteTrashDays: settingsRow.auto_delete_trash_days,
            downloadQuality: settingsRow.download_quality,
        },
    };
}

// ═══════════════════════════════════════════════
//  GET /api/settings — Fetch all settings
// ═══════════════════════════════════════════════
router.get('/', async (req, res) => {
    try {
        const userId = req.user.userId;

        // Ensure settings row exists
        await masterDb.query(
            `INSERT INTO user_settings (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
            [userId]
        );

        // Fetch settings + user profile
        const settingsResult = await masterDb.query(
            `SELECT * FROM user_settings WHERE user_id = $1`,
            [userId]
        );
        const userResult = await masterDb.query(
            `SELECT id, email, name, avatar, phone, global_role, created_at FROM users WHERE id = $1`,
            [userId]
        );

        if (!settingsResult.rows[0] || !userResult.rows[0]) {
            return res.status(404).json({ error: 'Settings not found' });
        }

        const settings = mapSettingsToResponse(settingsResult.rows[0], userResult.rows[0]);
        res.json({ success: true, settings });
    } catch (err) {
        console.error('GET /api/settings error:', err);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

// ═══════════════════════════════════════════════
//  PATCH /api/settings/profile
// ═══════════════════════════════════════════════
router.patch('/profile', async (req, res) => {
    const client = await masterDb.connect();
    try {
        const userId = req.user.userId;
        const {
            displayName, bio, phone, location, coverPhoto,
            socialLinkedin, socialGithub, socialTwitter,
        } = req.body;

        await client.query('BEGIN');

        // Update users table
        if (displayName !== undefined || phone !== undefined) {
            const fields = [];
            const values = [];
            let idx = 1;

            if (displayName !== undefined) { fields.push(`name = $${idx++}`); values.push(displayName); }
            if (phone !== undefined) { fields.push(`phone = $${idx++}`); values.push(phone); }
            fields.push(`updated_at = NOW()`);
            values.push(userId);

            await client.query(
                `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx}`,
                values
            );
        }

        // Update user_settings table
        const settingsFields = [];
        const settingsValues = [];
        let sIdx = 1;

        if (bio !== undefined) { settingsFields.push(`bio = $${sIdx++}`); settingsValues.push(bio); }
        if (location !== undefined) { settingsFields.push(`location = $${sIdx++}`); settingsValues.push(location); }
        if (coverPhoto !== undefined) { settingsFields.push(`cover_photo = $${sIdx++}`); settingsValues.push(coverPhoto); }
        if (socialLinkedin !== undefined) { settingsFields.push(`social_linkedin = $${sIdx++}`); settingsValues.push(socialLinkedin); }
        if (socialGithub !== undefined) { settingsFields.push(`social_github = $${sIdx++}`); settingsValues.push(socialGithub); }
        if (socialTwitter !== undefined) { settingsFields.push(`social_twitter = $${sIdx++}`); settingsValues.push(socialTwitter); }

        if (settingsFields.length > 0) {
            settingsFields.push(`updated_at = NOW()`);
            settingsValues.push(userId);
            await client.query(
                `UPDATE user_settings SET ${settingsFields.join(', ')} WHERE user_id = $${sIdx}`,
                settingsValues
            );
        }

        await client.query('COMMIT');

        // Fetch updated data
        const settingsResult = await masterDb.query(`SELECT * FROM user_settings WHERE user_id = $1`, [userId]);
        const userResult = await masterDb.query(`SELECT id, email, name, avatar, phone, global_role, created_at FROM users WHERE id = $1`, [userId]);

        const settings = mapSettingsToResponse(settingsResult.rows[0], userResult.rows[0]);
        res.json({ success: true, profile: settings.profile });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('PATCH /api/settings/profile error:', err);
        res.status(500).json({ error: 'Failed to update profile' });
    } finally {
        client.release();
    }
});

// ═══════════════════════════════════════════════
//  Generic section PATCH helper
// ═══════════════════════════════════════════════
function createSectionPatchRoute(sectionName, fieldMap) {
    router.patch(`/${sectionName}`, async (req, res) => {
        try {
            const userId = req.user.userId;
            const fields = [];
            const values = [];
            let idx = 1;

            for (const [bodyKey, dbCol] of Object.entries(fieldMap)) {
                if (req.body[bodyKey] !== undefined) {
                    fields.push(`${dbCol} = $${idx++}`);
                    values.push(req.body[bodyKey]);
                }
            }

            if (fields.length === 0) {
                return res.status(400).json({ error: 'No fields to update' });
            }

            fields.push(`updated_at = NOW()`);
            values.push(userId);

            await masterDb.query(
                `UPDATE user_settings SET ${fields.join(', ')} WHERE user_id = $${idx}`,
                values
            );

            // Fetch updated
            const result = await masterDb.query(`SELECT * FROM user_settings WHERE user_id = $1`, [userId]);
            const userResult = await masterDb.query(`SELECT id, email, name, avatar, phone, global_role, created_at FROM users WHERE id = $1`, [userId]);
            const settings = mapSettingsToResponse(result.rows[0], userResult.rows[0]);

            res.json({ success: true, [sectionName]: settings[sectionName] });
        } catch (err) {
            console.error(`PATCH /api/settings/${sectionName} error:`, err);
            res.status(500).json({ error: `Failed to update ${sectionName}` });
        }
    });
}

// ── Notification settings ───────────────────────
createSectionPatchRoute('notifications', {
    browser: 'notif_browser',
    email: 'notif_email',
    taskAssigned: 'notif_task_assigned',
    taskUpdated: 'notif_task_updated',
    eventInvitation: 'notif_event_invitation',
    messageMention: 'notif_message_mention',
    announcement: 'notif_announcement',
    deadlineReminder: 'notif_deadline_reminder',
    digestEmail: 'notif_digest_email',
    reminderMinutes: 'notif_reminder_minutes',
});

// ── Calendar settings ───────────────────────────
createSectionPatchRoute('calendar', {
    defaultView: 'cal_default_view',
    workingHoursStart: 'cal_working_hours_start',
    workingHoursEnd: 'cal_working_hours_end',
    weekStartsOn: 'cal_week_starts_on',
    googleConnected: 'cal_google_connected',
    syncEnabled: 'cal_sync_enabled',
});

// ── Privacy settings ────────────────────────────
createSectionPatchRoute('privacy', {
    showOnline: 'privacy_show_online',
    showLastSeen: 'privacy_show_last_seen',
    showEmail: 'privacy_show_email',
    showPhone: 'privacy_show_phone',
    profileVisibility: 'privacy_profile_visibility',
    allowDms: 'privacy_allow_dms',
});

// ── Appearance settings ─────────────────────────
createSectionPatchRoute('appearance', {
    theme: 'theme',
    accentColor: 'accent_color',
    compactMode: 'compact_mode',
    fontSize: 'font_size',
});

// ── Accessibility settings ──────────────────────
createSectionPatchRoute('accessibility', {
    reduceMotion: 'reduce_motion',
    highContrast: 'high_contrast',
    screenReaderMode: 'screen_reader_mode',
});

// ── Storage settings ────────────────────────────
createSectionPatchRoute('storage', {
    autoDeleteTrashDays: 'auto_delete_trash_days',
    downloadQuality: 'download_quality',
});

// ═══════════════════════════════════════════════
//  POST /api/settings/avatar — Upload avatar
// ═══════════════════════════════════════════════
router.post('/avatar', uploadAvatar.single('avatar'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const userId = req.user.userId;
        const relativePath = `/uploads/avatars/${userId}/${req.file.filename}`;

        await masterDb.query(
            `UPDATE users SET avatar = $1, updated_at = NOW() WHERE id = $2`,
            [relativePath, userId]
        );

        res.json({ success: true, avatarUrl: relativePath });
    } catch (err) {
        console.error('POST /api/settings/avatar error:', err);
        res.status(500).json({ error: 'Failed to upload avatar' });
    }
});

// ═══════════════════════════════════════════════
//  POST /api/settings/cover — Upload cover photo
// ═══════════════════════════════════════════════
router.post('/cover', uploadCover.single('cover'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const userId = req.user.userId;
        const relativePath = `/uploads/covers/${userId}/${req.file.filename}`;

        await masterDb.query(
            `UPDATE user_settings SET cover_photo = $1, updated_at = NOW() WHERE user_id = $2`,
            [relativePath, userId]
        );

        res.json({ success: true, coverUrl: relativePath });
    } catch (err) {
        console.error('POST /api/settings/cover error:', err);
        res.status(500).json({ error: 'Failed to upload cover photo' });
    }
});

module.exports = router;
