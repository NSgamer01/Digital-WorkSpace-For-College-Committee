// ============================================
// src/hooks/useUserPresence.js — Watch Other Users' Presence
// ============================================
// useUserPresence(userId) — single user presence
// useMultiplePresence(userIds) — batch user presence
// Both use Firestore real-time listeners.
// ============================================

import { useState, useEffect } from 'react';
import { doc, onSnapshot, collection, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';

const PRESENCE_COLLECTION = 'user_presence';

/**
 * Watch a single user's presence
 */
export const useUserPresence = (targetUserId) => {
    const [presence, setPresence] = useState({
        status: 'offline',
        lastSeen: null,
        isTyping: false,
        typingIn: null,
        loading: true,
    });

    useEffect(() => {
        if (!targetUserId) {
            setPresence(prev => ({ ...prev, loading: false }));
            return;
        }

        const presenceRef = doc(db, PRESENCE_COLLECTION, targetUserId);
        const unsubscribe = onSnapshot(presenceRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data();
                setPresence({
                    status: data.status || 'offline',
                    lastSeen: data.lastSeen || null,
                    isTyping: data.isTyping || false,
                    typingIn: data.typingIn || null,
                    loading: false,
                });
            } else {
                setPresence({
                    status: 'offline',
                    lastSeen: null,
                    isTyping: false,
                    typingIn: null,
                    loading: false,
                });
            }
        }, (err) => {
            console.warn('Presence listener error:', err.message);
            setPresence(prev => ({ ...prev, loading: false }));
        });

        return () => unsubscribe();
    }, [targetUserId]);

    return presence;
};

/**
 * Watch multiple users' presence
 */
export const useMultiplePresence = (userIds = []) => {
    const [presenceMap, setPresenceMap] = useState(new Map());
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const uniqueIds = [...new Set(userIds.filter(Boolean))];

        if (uniqueIds.length === 0) {
            setPresenceMap(new Map());
            setLoading(false);
            return;
        }

        const unsubscribers = [];

        uniqueIds.forEach((userId) => {
            const presenceRef = doc(db, PRESENCE_COLLECTION, userId);
            const unsub = onSnapshot(presenceRef, (snapshot) => {
                setPresenceMap(prev => {
                    const next = new Map(prev);
                    if (snapshot.exists()) {
                        const data = snapshot.data();
                        next.set(userId, {
                            status: data.status || 'offline',
                            lastSeen: data.lastSeen || null,
                            isTyping: data.isTyping || false,
                            typingIn: data.typingIn || null,
                        });
                    } else {
                        next.set(userId, {
                            status: 'offline',
                            lastSeen: null,
                            isTyping: false,
                            typingIn: null,
                        });
                    }
                    return next;
                });
            });
            unsubscribers.push(unsub);
        });

        setLoading(false);

        return () => {
            unsubscribers.forEach(unsub => unsub());
        };
    }, [JSON.stringify(userIds)]);

    return { presenceMap, loading };
};

export default useUserPresence;
