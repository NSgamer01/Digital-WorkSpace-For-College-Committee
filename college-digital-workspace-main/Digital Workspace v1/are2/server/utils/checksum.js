// ============================================
// utils/checksum.js — SHA-256 File Hash
// ============================================

const fs = require('fs');
const crypto = require('crypto');

/**
 * Calculate SHA-256 checksum of a file.
 * Used for duplicate detection.
 *
 * @param {string} filePath — Absolute path to the file
 * @returns {Promise<string>} — Hex string hash
 */
const calculateChecksum = (filePath) => {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);

        stream.on('data', (chunk) => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', (err) => reject(err));
    });
};

module.exports = { calculateChecksum };
