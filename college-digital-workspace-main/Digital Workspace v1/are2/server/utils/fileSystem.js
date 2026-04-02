// ============================================
// utils/fileSystem.js — File System Utilities
// ============================================

const fs = require('fs');
const path = require('path');

/**
 * Create directory recursively if it doesn't exist.
 */
const ensureDirectory = (dirPath) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
    return dirPath;
};

/**
 * Delete a file from disk.
 * Returns true if deleted, false if not found.
 */
const deleteFileFromDisk = (filePath) => {
    try {
        const resolved = path.resolve(filePath);
        if (fs.existsSync(resolved)) {
            fs.unlinkSync(resolved);
            return true;
        }
        return false;
    } catch (error) {
        console.error('Delete file error:', error.message);
        return false;
    }
};

/**
 * Extract file extension (lowercase, no dot).
 */
const getFileExtension = (filename) => {
    const ext = path.extname(filename || '').slice(1).toLowerCase();
    return ext;
};

/**
 * Check if extension is in allowed list.
 */
const isAllowedFileType = (extension) => {
    const allowed = (process.env.ALLOWED_EXTENSIONS || '').split(',').map((e) => e.trim().toLowerCase());
    if (allowed.length === 0 || allowed[0] === '') return true;
    return allowed.includes(extension.toLowerCase());
};

/**
 * Convert bytes to human-readable format.
 */
const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
};

/**
 * Build the storage path for a file.
 */
const getStoragePath = (userId, filename) => {
    const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
    return path.join(uploadDir, userId, filename);
};

/**
 * Sanitize a filename — remove dangerous characters.
 */
const sanitizeFilename = (filename) => {
    return filename
        .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')  // remove path-dangerous chars
        .replace(/\.{2,}/g, '.')                     // no double dots
        .trim();
};

module.exports = {
    ensureDirectory,
    deleteFileFromDisk,
    getFileExtension,
    isAllowedFileType,
    formatFileSize,
    getStoragePath,
    sanitizeFilename,
};
