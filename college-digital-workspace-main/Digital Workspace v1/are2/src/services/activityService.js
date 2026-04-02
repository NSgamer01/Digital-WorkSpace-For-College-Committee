// ============================================
// services/activityService.js — Activity via PostgreSQL API
// ============================================

import api from '../utils/api';

/**
 * Create a new activity log entry.
 * Activity logging is now handled server-side automatically,
 * but this function can be called explicitly if needed.
 */
export async function createActivity(data) {
    try {
        const result = await api.post('/api/activity', {
            action: data.type || 'general',
            entity_type: data.type || 'general',
            entity_name: data.title || '',
            details: data.description || '',
        });
        return result;
    } catch (error) {
        // Non-critical — don't throw
        console.warn('Activity logging failed:', error.message);
    }
}

/**
 * Fetch recent activity.
 */
export async function getRecentActivity(limit = 20) {
    try {
        const data = await api.get('/api/activity', { limit });
        return data.activities || [];
    } catch (error) {
        console.error('Error fetching activity:', error);
        return [];
    }
}
