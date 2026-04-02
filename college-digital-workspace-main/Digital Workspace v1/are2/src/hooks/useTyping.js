// ============================================
// src/hooks/useTyping.js — Typing Indicator Logic
// ============================================
// Returns { setTyping } function that updates Firestore
// presence document with typing state.
// Auto-clears after 3 seconds of no typing.
// ============================================

import { useCallback, useRef } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

const TYPING_TIMEOUT = 3000; // 3 seconds
const PRESENCE_COLLECTION = 'user_presence';

const useTyping = (userId) => {
    const timeoutRef = useRef(null);

    const setTyping = useCallback((roomId) => {
        if (!userId) return;

        const presenceRef = doc(db, PRESENCE_COLLECTION, userId);

        // Set typing
        updateDoc(presenceRef, {
            isTyping: true,
            typingIn: roomId,
            updatedAt: serverTimestamp(),
        }).catch(err => {
            console.warn('Failed to update typing status:', err.message);
        });

        // Clear previous timeout
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        // Auto-clear after 3 seconds
        timeoutRef.current = setTimeout(() => {
            updateDoc(presenceRef, {
                isTyping: false,
                typingIn: null,
                updatedAt: serverTimestamp(),
            }).catch(err => {
                console.warn('Failed to clear typing status:', err.message);
            });
        }, TYPING_TIMEOUT);
    }, [userId]);

    const clearTyping = useCallback(() => {
        if (!userId) return;
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        const presenceRef = doc(db, PRESENCE_COLLECTION, userId);
        updateDoc(presenceRef, {
            isTyping: false,
            typingIn: null,
            updatedAt: serverTimestamp(),
        }).catch(err => {
            console.warn('Failed to clear typing status:', err.message);
        });
    }, [userId]);

    return { setTyping, clearTyping };
};

export default useTyping;
