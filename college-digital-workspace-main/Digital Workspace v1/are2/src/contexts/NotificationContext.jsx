// ============================================
// src/contexts/NotificationContext.jsx
// ============================================
// Polls the backend for unread notification count,
// fetches full notification list, and fires browser
// notifications for new items.
// ============================================

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import api from '../utils/api';
import { useAuth } from '../contexts/AuthContext';

const NotificationContext = createContext(null);

const POLL_INTERVAL = 30_000; // 30 seconds

export const NotificationProvider = ({ children }) => {
    const { isAuthenticated } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const prevCountRef = useRef(0);
    const browserPermRef = useRef('default');

    // ── Request browser notification permission once ──
    useEffect(() => {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission().then(p => {
                browserPermRef.current = p;
            });
        } else if ('Notification' in window) {
            browserPermRef.current = Notification.permission;
        }
    }, []);

    // ── Fetch unread count ──
    const fetchUnreadCount = useCallback(async () => {
        if (!isAuthenticated) return;
        // Committee slug required — skip if no committee selected yet
        const slug = localStorage.getItem('currentCommitteeSlug');
        if (!slug) return;
        try {
            const res = await api.get('/api/notifications/unread-count');
            if (res.success) {
                const newCount = res.count;
                // Fire browser notification if count increased
                if (newCount > prevCountRef.current && prevCountRef.current >= 0) {
                    const diff = newCount - prevCountRef.current;
                    if (diff > 0 && browserPermRef.current === 'granted') {
                        new Notification('Digital Workspace', {
                            body: `You have ${diff} new notification${diff > 1 ? 's' : ''}`,
                            icon: '/favicon.ico',
                        });
                    }
                }
                prevCountRef.current = newCount;
                setUnreadCount(newCount);
            }
        } catch (err) {
            // Silently fail — user might not have committee selected yet
        }
    }, [isAuthenticated]);

    // ── Fetch notifications list ──
    const fetchNotifications = useCallback(async () => {
        if (!isAuthenticated) return;
        setLoading(true);
        try {
            const res = await api.get('/api/notifications?limit=20');
            if (res.success) {
                setNotifications(res.notifications || []);
            }
        } catch (err) {
            console.error('Failed to fetch notifications:', err);
        } finally {
            setLoading(false);
        }
    }, [isAuthenticated]);

    // ── Mark single read ──
    const markRead = useCallback(async (notifId) => {
        try {
            await api.patch(`/api/notifications/${notifId}/read`);
            setNotifications(prev =>
                prev.map(n => n.id === notifId ? { ...n, is_read: true } : n)
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (err) {
            console.error('Failed to mark notification as read:', err);
        }
    }, []);

    // ── Mark all read ──
    const markAllRead = useCallback(async () => {
        try {
            await api.patch('/api/notifications/read-all');
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            setUnreadCount(0);
        } catch (err) {
            console.error('Failed to mark all as read:', err);
        }
    }, []);

    // ── Polling ──
    useEffect(() => {
        if (!isAuthenticated) return;

        fetchUnreadCount();
        const interval = setInterval(fetchUnreadCount, POLL_INTERVAL);
        return () => clearInterval(interval);
    }, [isAuthenticated, fetchUnreadCount]);

    return (
        <NotificationContext.Provider value={{
            notifications,
            unreadCount,
            loading,
            fetchNotifications,
            fetchUnreadCount,
            markRead,
            markAllRead,
        }}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotifications = () => {
    const ctx = useContext(NotificationContext);
    if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
    return ctx;
};
