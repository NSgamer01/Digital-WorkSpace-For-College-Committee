// ============================================
// middleware/upload.js — Multer Configuration
// ============================================

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || './uploads');
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE, 10) || 104857600; // 100 MB
const ALLOWED_EXTENSIONS = (process.env.ALLOWED_EXTENSIONS || '').split(',').map((e) => e.trim().toLowerCase());

// Multer disk storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Each user gets their own directory
        const userDir = path.join(UPLOAD_DIR, req.user.userId);
        if (!fs.existsSync(userDir)) {
            fs.mkdirSync(userDir, { recursive: true });
        }
        cb(null, userDir);
    },
    filename: (req, file, cb) => {
        // Sanitize original filename and prepend UUID
        const sanitized = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        const uniqueName = `${uuidv4()}_${sanitized}`;
        cb(null, uniqueName);
    },
});

// File type filter
const fileFilter = (req, file, cb) => {
    if (ALLOWED_EXTENSIONS.length === 0 || ALLOWED_EXTENSIONS[0] === '') {
        return cb(null, true); // No filter if not configured
    }

    const ext = path.extname(file.originalname).slice(1).toLowerCase();
    if (ALLOWED_EXTENSIONS.includes(ext)) {
        cb(null, true);
    } else {
        const error = new Error(`File type .${ext} is not allowed`);
        error.code = 'LIMIT_UNEXPECTED_FILE';
        cb(error, false);
    }
};

const upload = multer({
    storage,
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter,
});

module.exports = upload;
