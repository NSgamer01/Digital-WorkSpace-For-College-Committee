// ============================================
// middleware/errorHandler.js — Global Error Handler
// ============================================

const errorHandler = (err, req, res, _next) => {
    console.error(`🔥 [${new Date().toISOString()}] Error:`, err.message || err);

    // Multer errors
    if (err.code === 'LIMIT_FILE_SIZE') {
        const maxMB = Math.round((process.env.MAX_FILE_SIZE || 104857600) / 1024 / 1024);
        return res.status(413).json({
            error: `File too large. Maximum size is ${maxMB} MB`,
        });
    }

    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(415).json({
            error: err.message || 'File type not allowed',
        });
    }

    if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({
            error: 'Too many files. Maximum 20 files per upload.',
        });
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Invalid token' });
    }
    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired' });
    }

    // Validation errors
    if (err.name === 'ValidationError') {
        return res.status(400).json({ error: err.message });
    }

    // CORS errors
    if (err.message && err.message.includes('not allowed by CORS')) {
        return res.status(403).json({ error: err.message });
    }

    // PostgreSQL constraint errors
    if (err.code === '23505') { // unique_violation
        return res.status(409).json({ error: 'Resource already exists' });
    }
    if (err.code === '23503') { // foreign_key_violation
        return res.status(400).json({ error: 'Referenced resource not found' });
    }

    // Custom errors with statusCode
    if (err.statusCode) {
        return res.status(err.statusCode).json({ error: err.message });
    }

    // Generic fallback
    const isDev = process.env.NODE_ENV === 'development';
    res.status(500).json({
        error: 'Internal server error',
        ...(isDev && { details: err.message, stack: err.stack }),
    });
};

module.exports = errorHandler;
