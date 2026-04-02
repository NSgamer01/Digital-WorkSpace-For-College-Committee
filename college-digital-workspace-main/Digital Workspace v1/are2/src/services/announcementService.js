// ============================================
// services/announcementService.js — Announcements via PostgreSQL API
// ============================================
// Replaces Firestore with PostgreSQL backend API calls.
// ============================================

import api from '../utils/api';

// ── Ensure announcement chat exists (no-op) ─────────────────────
export async function ensureAnnouncementChat() {
    // Backend handles this during database initialization
    return;
}

// ── Publish an announcement ─────────────────────────────────────
/**
 * Create a new announcement.
 */
export async function publishAnnouncement(data) {
    const result = await api.post('/api/announcements', {
        title: data.title,
        content: data.description || '',
        priority: data.pinned ? 'critical' : (data.category === 'urgent' ? 'high' : 'normal'),
        is_pinned: data.pinned || false,
        expires_at: null,
    });
    return result.announcement || result;
}

// ── Subscribe to announcements (polling) ────────────────────────
/**
 * @param {Function} callback - Receives array of announcement objects
 * @param {number} [limitCount] - Optional limit
 * @returns {Function} Unsubscribe function
 */
export function subscribeAnnouncements(callback, limitCount) {
    let active = true;

    const fetchAnnouncements = async () => {
        try {
            const data = await api.get('/api/announcements');
            if (active) {
                let items = (data.announcements || []).map(ann => ({
                    id: ann.id,
                    title: ann.title || '',
                    description: ann.content || '',
                    sender: ann.author_name || 'Unknown',
                    senderName: ann.author_name || 'Unknown',
                    senderId: ann.created_by || '',
                    category: ann.priority === 'critical' ? 'urgent' : 'general',
                    pinned: ann.is_pinned || false,
                    eventDate: null,
                    eventTime: null,
                    mediaUrl: null,
                    mediaFileName: null,
                    mediaType: null,
                    timestamp: ann.created_at ? new Date(ann.created_at) : null,
                    createdAt: ann.created_at ? { toDate: () => new Date(ann.created_at) } : null,
                    edited: false,
                    deleted: false,
                    type: 'announcement',
                    fileUrl: null,
                    fileName: null,
                    fileType: null,
                    acknowledged: [],
                    reactions: [],
                }));

                if (limitCount) {
                    items = items.slice(0, limitCount);
                }

                callback(items);
            }
        } catch (error) {
            console.error('Error fetching announcements:', error);
            if (active) callback([]);
        }
    };

    fetchAnnouncements();
    const interval = setInterval(fetchAnnouncements, 15000);

    return () => {
        active = false;
        clearInterval(interval);
    };
}

// ── Acknowledge an announcement ─────────────────────────────────
export async function toggleAcknowledge(announcementId, userId, isAcknowledged) {
    // Not implemented in backend yet — no-op
    console.warn('Acknowledge not yet implemented in backend');
}

// ── Reactions on announcements ──────────────────────────────────
export async function toggleReaction(announcementId, emoji, userId) {
    // Not implemented in backend yet — no-op
    console.warn('Reactions not yet implemented in backend');
}

// ── Edit an announcement ────────────────────────────────────────
export async function editAnnouncement(announcementId, updates) {
    try {
        await api.patch(`/api/announcements/${announcementId}`, updates);
    } catch (error) {
        console.error('Edit announcement error:', error);
    }
}

// ── Delete an announcement ──────────────────────────────────────
export async function deleteAnnouncement(announcementId) {
    try {
        await api.delete(`/api/announcements/${announcementId}`);
    } catch (error) {
        console.error('Delete announcement error:', error);
    }
}
