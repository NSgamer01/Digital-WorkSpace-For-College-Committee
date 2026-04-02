// ============================================
// src/utils/formatLastSeen.js — Time Formatter
// ============================================
// Converts a Firestore Timestamp to a human-readable
// "last seen" string.
// ============================================

/**
 * @param {import('firebase/firestore').Timestamp | Date | null} timestamp
 * @returns {string}
 */
export function formatLastSeen(timestamp) {
    if (!timestamp) return '';

    const date = typeof timestamp.toDate === 'function'
        ? timestamp.toDate()
        : new Date(timestamp);

    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay === 1) return 'yesterday';
    if (diffDay < 7) return `${diffDay} days ago`;

    return date.toLocaleDateString();
}

export default formatLastSeen;
