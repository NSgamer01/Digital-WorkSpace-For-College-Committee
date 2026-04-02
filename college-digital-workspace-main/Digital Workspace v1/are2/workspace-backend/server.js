// ============================================
// server.js — Main Express Application
// ============================================
// Multi-committee workspace backend with PostgreSQL.
//
//  • Firebase for authentication ONLY
//  • PostgreSQL for ALL data storage
//  • Separate database per committee
// ============================================

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Database & infrastructure
const masterDb = require('./config/masterDb');
const committeeDbManager = require('./config/committeeDbManager');

// Middleware
const firebaseAuth = require('./middleware/firebaseAuth');
const { committeeMiddleware } = require('./middleware/committee');

// ── App instance ────────────────────────────────
const app = express();
const PORT = process.env.PORT || 3001;

// ═══════════════════════════════════════════════
//  MIDDLEWARE
// ═══════════════════════════════════════════════

// ── CORS ────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

app.use(
    cors({
        origin: (origin, callback) => {
            // Allow requests with no origin (Postman, curl, server-to-server)
            if (!origin) return callback(null, true);
            if (allowedOrigins.includes(origin)) {
                return callback(null, true);
            }
            return callback(new Error(`Origin ${origin} not allowed by CORS`));
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Committee-Slug', 'X-Committee-ID'],
    })
);

// ── Body parsers ────────────────────────────────
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ── Static files ────────────────────────────────
const uploadsDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log(`  📁 Created uploads directory: ${uploadsDir}`);
}
app.use('/uploads', express.static(uploadsDir));

// ═══════════════════════════════════════════════
//  HEALTH CHECK
// ═══════════════════════════════════════════════
app.get('/api/health', async (_req, res) => {
    const health = {
        status: 'ok',
        masterDb: 'unknown',
        committeeDbs: {},
        timestamp: new Date().toISOString(),
    };

    // Check master database
    try {
        await masterDb.query('SELECT 1');
        health.masterDb = 'connected';
    } catch (err) {
        health.masterDb = 'error: ' + err.message;
        health.status = 'degraded';
    }

    // Check each committee database
    const slugs = committeeDbManager.getRegisteredSlugs();
    for (const slug of slugs) {
        try {
            const pool = committeeDbManager.getPool(slug);
            await pool.query('SELECT 1');
            health.committeeDbs[slug] = 'connected';
        } catch (err) {
            health.committeeDbs[slug] = 'error: ' + err.message;
            health.status = 'degraded';
        }
    }

    const statusCode = health.status === 'ok' ? 200 : 503;
    res.status(statusCode).json(health);
});

// ═══════════════════════════════════════════════
//  ROUTES — WITHOUT COMMITTEE CONTEXT
// ═══════════════════════════════════════════════
app.use('/api/auth', require('./routes/auth'));
app.use('/api/committees', require('./routes/committees'));

// ═══════════════════════════════════════════════
//  ROUTES — WITH FIREBASE AUTH + COMMITTEE CONTEXT
// ═══════════════════════════════════════════════
app.use('/api/drive', firebaseAuth, committeeMiddleware, require('./routes/files'));
app.use('/api/tasks', firebaseAuth, committeeMiddleware, require('./routes/tasks'));
app.use('/api/chat', firebaseAuth, committeeMiddleware, require('./routes/chat'));
app.use('/api/meetings', firebaseAuth, committeeMiddleware, require('./routes/meetings'));
app.use('/api/announcements', firebaseAuth, committeeMiddleware, require('./routes/announcements'));
app.use('/api/activity', firebaseAuth, committeeMiddleware, require('./routes/activity'));
app.use('/api/email', firebaseAuth, require('./routes/email').router);

// ═══════════════════════════════════════════════
//  GLOBAL ERROR HANDLER
// ═══════════════════════════════════════════════
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
    console.error('  🔥 Unhandled error:', err);

    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
            error: `File too large. Maximum size is ${Math.round(
                (process.env.MAX_FILE_SIZE || 104857600) / 1024 / 1024
            )} MB.`,
        });
    }

    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(415).json({ error: 'File type not allowed.' });
    }

    if (err.message && err.message.includes('not allowed by CORS')) {
        return res.status(403).json({ error: err.message });
    }

    res.status(err.status || 500).json({
        error: err.message || 'Internal server error.',
    });
});

// ── 404 handler ─────────────────────────────────
app.use((_req, res) => {
    res.status(404).json({ error: 'Route not found.' });
});

// ═══════════════════════════════════════════════
//  GRACEFUL SHUTDOWN
// ═══════════════════════════════════════════════
async function gracefulShutdown(signal) {
    console.log(`\n  ⚠️  Received ${signal}. Shutting down gracefully...`);
    try {
        await masterDb.end();
        console.log('  🔴 Master DB pool closed');
    } catch (err) {
        console.error('  ❌ Error closing master pool:', err.message);
    }
    try {
        await committeeDbManager.closeAll();
        console.log('  🔴 All committee DB pools closed');
    } catch (err) {
        console.error('  ❌ Error closing committee pools:', err.message);
    }
    process.exit(0);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// ═══════════════════════════════════════════════
//  START SERVER
// ═══════════════════════════════════════════════
app.listen(PORT, () => {
    console.log('');
    console.log('══════════════════════════════════════════════════════');
    console.log('  🚀  Workspace Backend — Multi-Committee Server');
    console.log(`  📍  http://localhost:${PORT}`);
    console.log(`  🔧  Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('══════════════════════════════════════════════════════');
    console.log('');
    console.log('  Databases:');
    console.log('    🗄️  Master:  workspace_master');
    console.log('    🗄️  DLLE:    workspace_dlle');
    console.log('    🗄️  GYK:     workspace_gyk');
    console.log('    🗄️  NSS:     workspace_nss');
    console.log('');
    console.log('  API Routes:');
    console.log('    /api/health             → Health check (all DBs)');
    console.log('    /api/auth/*             → Authentication');
    console.log('    /api/committees/*       → Committee management');
    console.log('    /api/drive/*            → File & folder operations');
    console.log('    /api/tasks/*            → Task management');
    console.log('    /api/chat/*             → Chat rooms & messages');
    console.log('    /api/meetings/*         → Calendar & meetings');
    console.log('    /api/announcements/*    → Announcements');
    console.log('    /api/activity/*         → Activity log');
    console.log('');
    console.log(`  📁 Uploads: ${uploadsDir}`);
    console.log('');
});
