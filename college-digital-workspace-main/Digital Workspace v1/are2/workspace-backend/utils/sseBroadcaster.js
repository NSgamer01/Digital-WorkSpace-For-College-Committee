// ============================================
// utils/sseBroadcaster.js — Server-Sent Events Hub
// ============================================
// Manages SSE connections per committee slug.
// When a task changes, all clients on the same committee get notified.
// ============================================

/**
 * Map of slug → Set<response>
 * Each connected SSE client is stored by its committee slug.
 */
const clients = new Map();

/**
 * Add an SSE client for a given committee slug.
 */
function addClient(slug, res) {
    if (!clients.has(slug)) clients.set(slug, new Set());
    clients.get(slug).add(res);

    // Remove on disconnect
    res.on('close', () => {
        const set = clients.get(slug);
        if (set) {
            set.delete(res);
            if (set.size === 0) clients.delete(slug);
        }
    });
}

/**
 * Broadcast an event to all clients on a committee.
 * @param {string} slug - Committee slug
 * @param {string} event - Event name (e.g. 'task_updated')
 * @param {object} data - Payload
 */
function broadcast(slug, event, data) {
    const set = clients.get(slug);
    if (!set || set.size === 0) return;

    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

    for (const res of set) {
        try {
            res.write(payload);
        } catch {
            set.delete(res);
        }
    }
}

/**
 * Get count of connected clients (for debugging).
 */
function getClientCount(slug) {
    return clients.get(slug)?.size || 0;
}

module.exports = { addClient, broadcast, getClientCount };
