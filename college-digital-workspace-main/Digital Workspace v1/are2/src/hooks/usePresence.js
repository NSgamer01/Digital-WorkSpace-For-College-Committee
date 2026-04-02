// ============================================
// src/hooks/usePresence.js — Current User Presence Tracking
// ============================================
// Tracks the current user's online/away/offline status in Firestore.
// Uses user_presence/{userId} collection (userId = PostgreSQL UUID).
// ============================================

import { useEffect, useRef, useCallback } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const PRESENCE_COLLECTION = 'user_presence';

const usePresence = (userId) => {
    const intervalRef = useRef(null);
    const manualStatusRef = useRef(null);

    const updatePresence = useCallback(async (status, extraData = {}) => {
        if (!userId) return;
        try {
            const presenceRef = doc(db, PRESENCE_COLLECTION, userId);
            await setDoc(presenceRef, {
                userId,
                status,
                lastSeen: serverTimestamp(),
                lastActivity: serverTimestamp(),
                currentPage: window.location.pathname,
                isTyping: false,
                typingIn: null,
                activeDevice: {
                    type: 'web',
                    browser: navigator.userAgent.includes('Chrome') ? 'Chrome' :
                        navigator.userAgent.includes('Firefox') ? 'Firefox' :
                            navigator.userAgent.includes('Safari') ? 'Safari' : 'Unknown',
                    lastActive: serverTimestamp(),
                },
                updatedAt: serverTimestamp(),
                ...extraData,
            }, { merge: true });
        } catch (err) {
            console.warn('Presence update failed:', err.message);
        }
    }, [userId]);

    // Set manual status (user explicitly chose a status)
    const setManualStatus = useCallback((status) => {
        manualStatusRef.current = status;
        updatePresence(status);
    }, [updatePresence]);

    useEffect(() => {
        if (!userId) return;

        // Set online on mount
        updatePresence('online');

        // Heartbeat interval — update lastActivity every 30s
        intervalRef.current = setInterval(() => {
            const status = manualStatusRef.current || 'online';
            if (status !== 'offline') {
                updatePresence(status);
            }
        }, HEARTBEAT_INTERVAL);

        // Visibility change — away when hidden, online when visible
        const handleVisibility = () => {
            if (manualStatusRef.current === 'busy' || manualStatusRef.current === 'offline') return;
            if (document.hidden) {
                updatePresence('away');
            } else {
                updatePresence(manualStatusRef.current || 'online');
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);

        // Before unload — mark offline
        const handleUnload = () => {
            if (!userId) return;
            // Use sendBeacon for reliable delivery on page close
            const url = `https://firestore.googleapis.com/v1/projects/${import.meta.env.VITE_FIREBASE_PROJECT_ID}/databases/(default)/documents/user_presence/${userId}`;
            // Fallback: just update directly (may not complete)
            updatePresence('offline');
        };
        window.addEventListener('beforeunload', handleUnload);

        // Cleanup
        return () => {
            clearInterval(intervalRef.current);
            document.removeEventListener('visibilitychange', handleVisibility);
            window.removeEventListener('beforeunload', handleUnload);
            updatePresence('offline');
        };
    }, [userId, updatePresence]);

    return { setManualStatus };
};

export default usePresence;
