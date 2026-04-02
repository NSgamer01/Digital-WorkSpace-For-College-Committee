// ============================================
// src/hooks/useCalendar.js
// ============================================
// Full calendar hook. Uses useMeetings internally
// + adds Google Calendar overlay + date range logic.
// Uses the modern GIS token-client service.
// ============================================

import { useState, useEffect, useCallback, useRef } from 'react';
import useMeetings from './useMeetings';
import googleCalendar from '../services/googleCalendar';

export default function useCalendar() {
    // ── Date range for main calendar view ──────────
    const [dateRange, setDateRangeState] = useState({
        start: null,
        end: null,
    });

    // Build useMeetings options based on current date range
    const mainOptions = {};
    if (dateRange.start) {
        mainOptions.startDate = dateRange.start instanceof Date
            ? dateRange.start.toISOString()
            : dateRange.start;
    }
    if (dateRange.end) {
        mainOptions.endDate = dateRange.end instanceof Date
            ? dateRange.end.toISOString()
            : dateRange.end;
    }

    // ── Main meetings instance (calendar view range) ─
    const {
        meetings,
        loading,
        error,
        refresh: refreshMain,
        createMeeting: createMeetingMain,
        updateMeeting: updateMeetingMain,
        deleteMeeting: deleteMeetingMain,
    } = useMeetings(mainOptions);

    // ── Upcoming meetings instance (always next 5) ───
    const {
        meetings: upcomingMeetings,
        refresh: refreshUpcoming,
    } = useMeetings({ upcoming: true, limit: 5 });

    // ── Google Calendar state ──────────────────────
    const [googleEvents, setGoogleEvents] = useState([]);
    const [isGoogleConnected, setIsGoogleConnected] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const [googleError, setGoogleError] = useState(null);
    const googleInitialized = useRef(false);

    // ── Initialize Google (GIS) on mount ───────────
    useEffect(() => {
        if (googleInitialized.current) return;
        googleInitialized.current = true;

        googleCalendar.initialize()
            .then(() => {
                setIsGoogleConnected(true);
            })
            .catch(() => {
                // Google not available — calendar works without it
            });
    }, []);

    // ── Fetch Google events when connected or date range changes ─
    const fetchGoogleEvents = useCallback(async () => {
        if (!isGoogleConnected || !googleCalendar.isAuthenticated) return;

        const start = dateRange.start
            ? (dateRange.start instanceof Date ? dateRange.start : new Date(dateRange.start))
            : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const end = dateRange.end
            ? (dateRange.end instanceof Date ? dateRange.end : new Date(dateRange.end))
            : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);

        try {
            const items = await googleCalendar.listEvents(
                start.toISOString(),
                end.toISOString()
            );
            // Map to the shape react-big-calendar expects
            setGoogleEvents(items.map(e => ({
                ...e,
                start: new Date(e.start),
                end: new Date(e.end),
                source: 'google',
            })));
        } catch (err) {
            console.error('Failed to fetch Google events:', err);
            setGoogleError('Failed to load Google Calendar events');
        }
    }, [isGoogleConnected, dateRange.start, dateRange.end]);

    useEffect(() => {
        if (isGoogleConnected) {
            fetchGoogleEvents();
        }
    }, [isGoogleConnected, fetchGoogleEvents]);

    // ── Set date range (called by calendar view change) ─
    const setDateRange = useCallback(({ start, end }) => {
        setDateRangeState({ start, end });
    }, []);

    // ── Connect Google Calendar ────────────────────
    const connectGoogle = useCallback(async () => {
        setIsGoogleLoading(true);
        setGoogleError(null);
        try {
            await googleCalendar.initialize();
            setIsGoogleConnected(true);
        } catch (err) {
            console.error('Google sign-in failed:', err);
            setGoogleError('Failed to connect Google Calendar');
        } finally {
            setIsGoogleLoading(false);
        }
    }, []);

    // ── Disconnect Google Calendar ─────────────────
    const disconnectGoogle = useCallback(() => {
        try {
            googleCalendar.signOut();
            setIsGoogleConnected(false);
            setGoogleEvents([]);
            setGoogleError(null);
        } catch (err) {
            console.error('Google sign-out failed:', err);
        }
    }, []);

    // ── Combined events for calendar ───────────────
    const allEvents = [...meetings, ...googleEvents];

    // ── CRUD wrappers that also refresh upcoming ───
    const createMeeting = useCallback(async (formData) => {
        const result = await createMeetingMain(formData);
        refreshUpcoming();
        return result;
    }, [createMeetingMain, refreshUpcoming]);

    const updateMeeting = useCallback(async (id, formData) => {
        const result = await updateMeetingMain(id, formData);
        refreshUpcoming();
        return result;
    }, [updateMeetingMain, refreshUpcoming]);

    const deleteMeeting = useCallback(async (id) => {
        await deleteMeetingMain(id);
        refreshUpcoming();
    }, [deleteMeetingMain, refreshUpcoming]);

    const refreshMeetings = useCallback(() => {
        refreshMain();
        refreshUpcoming();
    }, [refreshMain, refreshUpcoming]);

    return {
        meetings,
        googleEvents,
        allEvents,
        loading,
        error,
        isGoogleConnected,
        isGoogleLoading,
        googleError,
        connectGoogle,
        disconnectGoogle,
        createMeeting,
        updateMeeting,
        deleteMeeting,
        refreshMeetings,
        setDateRange,
        upcomingMeetings,
    };
}
