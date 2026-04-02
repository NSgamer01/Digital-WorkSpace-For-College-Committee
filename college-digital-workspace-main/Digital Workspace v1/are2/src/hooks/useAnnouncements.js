// ============================================
// src/hooks/useAnnouncements.js — Announcements Hook
// ============================================
// Fetches from /api/announcements, 30s polling,
// create and delete operations.
// ============================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { useCommittee } from '../contexts/CommitteeContext';
import api from '../utils/api';

export default function useAnnouncements() {
    const { currentCommittee } = useCommittee();
    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const pollingRef = useRef(null);

    // Fetch announcements
    const fetchAnnouncements = useCallback(async () => {
        try {
            setError(null);
            const data = await api.get('/api/announcements', { limit: 50 });

            if (data.success && data.announcements) {
                setAnnouncements(data.announcements);
            }
        } catch (err) {
            console.error('Failed to fetch announcements:', err.message);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    // Load on mount and when committee changes
    useEffect(() => {
        if (!currentCommittee) return;

        setLoading(true);
        setAnnouncements([]);
        fetchAnnouncements();

        // Poll every 30 seconds
        pollingRef.current = setInterval(() => {
            fetchAnnouncements();
        }, 30000);

        return () => {
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
            }
        };
    }, [currentCommittee?.slug, fetchAnnouncements]);

    // Create announcement
    const createAnnouncement = useCallback(async ({ title, content, priority }) => {
        try {
            setError(null);
            const data = await api.post('/api/announcements', { title, content, priority });

            if (data.success && data.announcement) {
                setAnnouncements(prev => [data.announcement, ...prev]);
                return data.announcement;
            }
        } catch (err) {
            setError(err.message);
            throw err;
        }
    }, []);

    // Delete announcement
    const deleteAnnouncement = useCallback(async (id) => {
        // Optimistic removal
        const previous = [...announcements];
        setAnnouncements(prev => prev.filter(a => a.id !== id));

        try {
            await api.delete(`/api/announcements/${id}`);
        } catch (err) {
            // Revert on failure
            setAnnouncements(previous);
            setError(err.message);
        }
    }, [announcements]);

    // Manual refresh
    const refresh = useCallback(() => {
        fetchAnnouncements();
    }, [fetchAnnouncements]);

    return {
        announcements,
        loading,
        error,
        createAnnouncement,
        deleteAnnouncement,
        refresh,
    };
}
