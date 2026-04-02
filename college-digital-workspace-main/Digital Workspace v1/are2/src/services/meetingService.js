// ============================================
// services/meetingService.js — Meetings via PostgreSQL API
// ============================================

import api from '../utils/api';

/**
 * Create a new meeting.
 */
export async function createMeeting(meetingData, userId) {
    const data = await api.post('/api/meetings', {
        title: meetingData.title,
        description: meetingData.description || '',
        meeting_date: meetingData.date,
        start_time: meetingData.time || null,
        end_time: meetingData.endTime || null,
        location: meetingData.location || '',
        attendees: meetingData.reminderTo || [],
    });
    return data.meeting || data;
}

/**
 * Fetch all meetings.
 */
export async function getMeetings() {
    const data = await api.get('/api/meetings');
    return data.meetings || [];
}

/**
 * Subscribe to meetings (polling).
 */
export function subscribeMeetings(callback) {
    let active = true;

    const fetchMeetings = async () => {
        try {
            const data = await api.get('/api/meetings');
            if (active) {
                const meetings = (data.meetings || []).map(m => ({
                    id: m.id,
                    title: m.title,
                    description: m.description,
                    date: m.meeting_date,
                    time: m.start_time,
                    endTime: m.end_time,
                    location: m.location,
                    reminderTo: m.attendees || [],
                    createdBy: m.created_by,
                    createdAt: m.created_at ? { toDate: () => new Date(m.created_at) } : null,
                }));
                callback(meetings);
            }
        } catch (error) {
            console.error('Error fetching meetings:', error);
            if (active) callback([]);
        }
    };

    fetchMeetings();
    const interval = setInterval(fetchMeetings, 15000);

    return () => {
        active = false;
        clearInterval(interval);
    };
}

/**
 * Update a meeting.
 */
export async function updateMeeting(meetingId, updates) {
    await api.patch(`/api/meetings/${meetingId}`, updates);
}

/**
 * Delete a meeting.
 */
export async function deleteMeeting(meetingId) {
    await api.delete(`/api/meetings/${meetingId}`);
}
