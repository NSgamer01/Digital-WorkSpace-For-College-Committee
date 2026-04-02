// ============================================
// src/hooks/useMeetings.js
// ============================================
// Lightweight, reusable hook for fetching and
// mutating meetings via PostgreSQL backend.
// Used by useCalendar (2 instances) and DashboardMeetings.
// ============================================

import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../utils/api';
import { useCommittee } from '../contexts/CommitteeContext';

/**
 * @param {Object} options
 * @param {boolean}  options.upcoming     — if true, fetches future scheduled meetings
 * @param {number}   options.limit        — max results to return
 * @param {string}   options.startDate    — ISO string filter
 * @param {string}   options.endDate      — ISO string filter
 * @param {string}   options.status       — status filter
 * @param {number}   options.autoRefresh  — interval in ms to auto-refetch
 */
export default function useMeetings(options = {}) {
    const [meetings, setMeetings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { currentCommittee } = useCommittee();
    const optionsRef = useRef(options);
    optionsRef.current = options;

    // ── Map backend meeting to frontend format ────────
    const mapMeeting = useCallback((m) => ({
        id: m.id,
        title: m.title,
        description: m.description,
        start: new Date(m.start_time),
        end: new Date(m.end_time),
        allDay: m.is_all_day,
        location: m.location || '',
        meetingLink: m.meeting_link || '',
        status: m.status,
        color: m.color || '#6366f1',
        createdBy: m.created_by,
        creatorName: m.creator_name || '',
        creatorAvatar: m.creator_avatar || '',
        attendees: m.attendee_details || [],
        attachments: m.attachments || [],
        isRecurring: m.is_recurring,
        minutes: m.minutes || '',
        createdAt: m.created_at,
        updatedAt: m.updated_at,
        source: 'postgresql',
        raw: m,
    }), []);

    // ── Fetch meetings ────────────────────────────────
    const fetchMeetings = useCallback(async () => {
        if (!currentCommittee?.slug) return;

        try {
            setLoading(true);
            setError(null);

            const opts = optionsRef.current;
            const params = {};

            if (opts.upcoming) {
                params.startDate = new Date().toISOString();
                params.status = 'scheduled';
            }
            if (opts.startDate && !opts.upcoming) {
                params.startDate = opts.startDate;
            }
            if (opts.endDate) {
                params.endDate = opts.endDate;
            }
            if (opts.status && !opts.upcoming) {
                params.status = opts.status;
            }
            if (opts.limit) {
                params.limit = opts.limit;
            }

            const data = await api.get('/api/meetings', params);
            const mapped = (data.meetings || []).map(mapMeeting);
            setMeetings(mapped);
        } catch (err) {
            console.error('useMeetings fetch error:', err);
            setError(err.message || 'Failed to fetch meetings');
        } finally {
            setLoading(false);
        }
    }, [currentCommittee?.slug, mapMeeting]);

    // ── Refresh on mount / option changes ─────────────
    const optionsKey = JSON.stringify({
        upcoming: options.upcoming,
        limit: options.limit,
        startDate: options.startDate,
        endDate: options.endDate,
        status: options.status,
    });

    useEffect(() => {
        fetchMeetings();
    }, [fetchMeetings, optionsKey]);

    // ── Auto-refresh interval ─────────────────────────
    useEffect(() => {
        if (!options.autoRefresh || typeof options.autoRefresh !== 'number') return;
        const timer = setInterval(fetchMeetings, options.autoRefresh);
        return () => clearInterval(timer);
    }, [options.autoRefresh, fetchMeetings]);

    // ── Create meeting ────────────────────────────────
    const createMeeting = useCallback(async (formData) => {
        const body = {
            title: formData.title,
            description: formData.description || '',
            start_time: formData.startTime instanceof Date
                ? formData.startTime.toISOString()
                : formData.startTime,
            end_time: formData.endTime instanceof Date
                ? formData.endTime.toISOString()
                : formData.endTime,
            is_all_day: formData.allDay || false,
            location: formData.location || '',
            meeting_link: formData.meetingLink || null,
            attendees: formData.attendees || [],
            color: formData.color || '#6366f1',
        };

        const data = await api.post('/api/meetings', body);
        await fetchMeetings();
        return data.meeting;
    }, [fetchMeetings]);

    // ── Update meeting ────────────────────────────────
    const updateMeeting = useCallback(async (id, formData) => {
        const fieldMap = {
            title: 'title',
            description: 'description',
            startTime: 'start_time',
            endTime: 'end_time',
            allDay: 'is_all_day',
            location: 'location',
            meetingLink: 'meeting_link',
            attendees: 'attendees',
            status: 'status',
            color: 'color',
            minutes: 'minutes',
        };

        const updateObj = {};
        for (const [camel, snake] of Object.entries(fieldMap)) {
            if (formData[camel] !== undefined) {
                let val = formData[camel];
                if ((camel === 'startTime' || camel === 'endTime') && val instanceof Date) {
                    val = val.toISOString();
                }
                updateObj[snake] = val;
            }
        }

        const data = await api.patch(`/api/meetings/${id}`, updateObj);
        await fetchMeetings();
        return data.meeting;
    }, [fetchMeetings]);

    // ── Delete meeting ────────────────────────────────
    const deleteMeeting = useCallback(async (id) => {
        await api.delete(`/api/meetings/${id}`);
        await fetchMeetings();
    }, [fetchMeetings]);

    return {
        meetings,
        loading,
        error,
        refresh: fetchMeetings,
        createMeeting,
        updateMeeting,
        deleteMeeting,
    };
}
