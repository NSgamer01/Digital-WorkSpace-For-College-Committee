// ============================================
// utils/validation.js — Input Validation
// ============================================

/**
 * Validate email format.
 */
const validateEmail = (email) => {
    if (!email) return false;
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
};

/**
 * Validate password strength (min 6 chars).
 */
const validatePassword = (password) => {
    return typeof password === 'string' && password.length >= 6;
};

/**
 * Validate filename — no empty, no path traversal.
 */
const validateFileName = (name) => {
    if (!name || typeof name !== 'string' || name.trim().length === 0) return false;
    // Reject path traversal attempts
    if (name.includes('..') || name.includes('/') || name.includes('\\')) return false;
    // Reject null bytes
    if (name.includes('\0')) return false;
    return true;
};

/**
 * Sanitize a string input — trim and remove dangerous characters.
 */
const sanitizeInput = (input) => {
    if (typeof input !== 'string') return '';
    return input
        .trim()
        .replace(/[<>]/g, '')       // strip angle brackets (basic XSS prevention)
        .replace(/\0/g, '');         // strip null bytes
};

module.exports = {
    validateEmail,
    validatePassword,
    validateFileName,
    sanitizeInput,
};
