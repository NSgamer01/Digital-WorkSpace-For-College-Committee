// ============================================
// server.js — Multi-Committee Express Server
// ============================================
// College Workspace Backend with multi-database architecture.
//
// • Master DB for auth & committee registry
// • Per-committee database via committeeDbManager
// • Committee middleware resolves slug → DB pool
// ============================================

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Import database connections
const masterDb = require('./config/masterDb');
const committeeDbManager = require('./config/committeeDbManager');

// Import middleware
const authMiddleware = require('./middleware/auth');
const { committeeMiddleware } = require('./middleware/committee');

// Import routes
const authRoutes = require('./routes/auth');
const committeeRoutes = require('./routes/committees');
const driveRoutes = require('./routes/files');
const taskRoutes = require('./routes/tasks');
const channelRoutes = require('./routes/channels');
const chatRoutes = require('./routes/chat');
const meetingRoutes = require('./routes/meetings');
const announcementRoutes = require('./routes/announcements');
const activityRoutes = require('./routes/activity');
const adminRoutes = require('./routes/admin');
const settingsRoutes = require('./routes/settings');
const notificationRoutes = require('./routes/notifications');
const gcalendarRoutes = require('./routes/gcalendar');
const adminMiddleware = require('./middleware/admin');

// ── App instance ────────────────────────────────
const app = express();
const PORT = process.env.PORT || 5000;

// ═══════════════════════════════════════════════
//  BODY PARSING & CORS
// ═══════════════════════════════════════════════

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// CORS configuration
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Committee-Slug', 'X-Committee-ID'],
}));

// ═══════════════════════════════════════════════
//  REQUEST LOGGER (development only)
// ═══════════════════════════════════════════════
if (process.env.NODE_ENV === 'development') {
    app.use((req, _res, next) => {
        const committee = req.headers['x-committee-slug'] || '-';
        console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url} [committee: ${committee}]`);
        next();
    });
}

// ═══════════════════════════════════════════════
//  STATIC FILES
// ═══════════════════════════════════════════════

const uploadBasePath = path.resolve(__dirname, process.env.UPLOAD_BASE_DIR || '../workspace Drive/Uploads');
app.use('/uploads', express.static(uploadBasePath));

// ═══════════════════════════════════════════════
//  HEALTH CHECK
// ═══════════════════════════════════════════════

app.get('/api/health', async (_req, res) => {
    const status = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: Math.round(process.uptime()),
        databases: {},
    };

    // Check master DB
    try {
        await masterDb.query('SELECT 1');
        status.databases.master = { name: 'workspace_master', status: 'connected' };
    } catch (err) {
        status.databases.master = { name: 'workspace_master', status: 'error', error: err.message };
        status.status = 'degraded';
    }

    // Check each committee DB
    const slugs = committeeDbManager.getRegisteredSlugs();
    for (const slug of slugs) {
        try {
            await committeeDbManager.query(slug, 'SELECT 1');
            status.databases[slug] = { name: `workspace_${slug}`, status: 'connected' };
        } catch (err) {
            status.databases[slug] = { name: `workspace_${slug}`, status: 'error', error: err.message };
            status.status = 'degraded';
        }
    }

    const httpStatus = status.status === 'ok' ? 200 : 503;
    res.status(httpStatus).json(status);
});

// ═══════════════════════════════════════════════
//  API ROUTES — No committee context needed
// ═══════════════════════════════════════════════

app.use('/api/auth', authRoutes);
app.use('/api/committees', authMiddleware, committeeRoutes);
app.use('/api/admin', authMiddleware, adminMiddleware, adminRoutes);
app.use('/api/settings', authMiddleware, settingsRoutes);

// ═══════════════════════════════════════════════
//  SSE ENDPOINT — Tasks real-time (before middleware chain)
// ═══════════════════════════════════════════════
// EventSource can't send custom headers, so token + slug
// come via query params. Auth is verified inline.
const firebaseAdmin = require('./config/firebaseAdmin');

app.get('/api/tasks/events', async (req, res) => {
    const { token, committeeSlug } = req.query;

    if (!token || !committeeSlug) {
        return res.status(400).json({ error: 'Token and committeeSlug are required.' });
    }

    // Verify Firebase token
    try {
        await firebaseAdmin.auth().verifyIdToken(token);
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token.' });
    }

    // Set up SSE
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
    });

    res.write(`event: connected\ndata: ${JSON.stringify({ status: 'connected' })}\n\n`);

    // Heartbeat to keep connection alive
    const heartbeat = setInterval(() => {
        res.write(`: heartbeat\n\n`);
    }, 30000);

    req.on('close', () => {
        clearInterval(heartbeat);
    });
});

app.use('/api/drive', authMiddleware, committeeMiddleware, driveRoutes);
app.use('/api/tasks', authMiddleware, committeeMiddleware, taskRoutes);
app.use('/api/channels', authMiddleware, committeeMiddleware, channelRoutes);
app.use('/api/chat', authMiddleware, committeeMiddleware, chatRoutes);
app.use('/api/meetings', authMiddleware, committeeMiddleware, meetingRoutes);
app.use('/api/announcements', authMiddleware, committeeMiddleware, announcementRoutes);
app.use('/api/activity', authMiddleware, committeeMiddleware, activityRoutes);
app.use('/api/notifications', authMiddleware, committeeMiddleware, notificationRoutes);
app.use('/api/gcalendar', authMiddleware, gcalendarRoutes);

// ═══════════════════════════════════════════════
//  SERVE REACT FRONTEND (Production)
// ═══════════════════════════════════════════════
const clientDistPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(clientDistPath)) {
    app.use(express.static(clientDistPath));

    app.get('*', (req, res) => {
        if (req.path.startsWith('/api')) {
            return res.status(404).json({ error: 'API route not found' });
        }
        res.sendFile(path.join(clientDistPath, 'index.html'));
    });
}

// ═══════════════════════════════════════════════
//  ERROR HANDLING
// ═══════════════════════════════════════════════

// Global error handler
app.use((err, _req, res, _next) => {
    console.error('Unhandled error:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error',
    });
});

// 404 handler
app.use((_req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// ═══════════════════════════════════════════════
//  CREATE UPLOAD DIRECTORIES
// ═══════════════════════════════════════════════
if (!fs.existsSync(uploadBasePath)) {
    fs.mkdirSync(uploadBasePath, { recursive: true });
    console.log(`📁 Created uploads base directory: ${uploadBasePath}`);
}

// ═══════════════════════════════════════════════
//  START SERVER
// ═══════════════════════════════════════════════
const server = app.listen(PORT, () => {
    console.log('');
    console.log('══════════════════════════════════════════════════');
    console.log('  🚀  College Workspace — Multi-Committee Server');
    console.log(`  📍  http://localhost:${PORT}`);
    console.log(`  🔧  Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('══════════════════════════════════════════════════');
    console.log('');
    console.log('  Databases:');
    console.log('    🗄️  Master:   workspace_master');
    const slugs = committeeDbManager.getRegisteredSlugs();
    for (const slug of slugs) {
        console.log(`    🗄️  ${slug.toUpperCase().padEnd(8)} workspace_${slug}`);
    }
    console.log('');
    console.log('  API Routes:');
    console.log('    /api/health           → Health check (all DBs)');
    console.log('    /api/auth/*           → Authentication');
    console.log('    /api/committees/*     → Committee management');
    console.log('    /api/drive/*          → File & folder operations');
    console.log('    /api/tasks/*          → Task management');
    console.log('    /api/channels/*       → Channel management');
    console.log('    /api/chat/*           → Chat messages');
    console.log('    /api/meetings/*       → Calendar & meetings');
    console.log('    /api/announcements/*  → Announcements');
    console.log('    /api/activity/*       → Activity log');
    console.log('');
    console.log(`  📁 Uploads: ${uploadBasePath}`);
    console.log('');
});

// ═══════════════════════════════════════════════
//  GRACEFUL SHUTDOWN
// ═══════════════════════════════════════════════
const gracefulShutdown = async (signal) => {
    console.log(`\n🛑 ${signal} received. Shutting down gracefully...`);
    server.close(async () => {
        console.log('   HTTP server closed');
        try {
            await masterDb.end();
            console.log('   Master DB pool closed');
        } catch (err) {
            console.error('   Error closing master DB pool:', err.message);
        }
        try {
            await committeeDbManager.closeAll();
            console.log('   All committee DB pools closed');
        } catch (err) {
            console.error('   Error closing committee DB pools:', err.message);
        }
        console.log('   Goodbye! 👋');
        process.exit(0);
    });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
