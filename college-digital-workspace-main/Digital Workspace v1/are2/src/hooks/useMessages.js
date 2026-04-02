// ============================================
// src/hooks/useMessages.js — Messages with Polling
// ============================================
// 3-second incremental polling, optimistic send,
// edit/delete, and load-more pagination.
// ============================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useCommittee } from '../contexts/CommitteeContext';
import api from '../utils/api';

export default function useMessages(channelId) {
    const { currentUser } = useAuth();
    const { committeeRole } = useCommittee();

    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState(null);
    const [hasMore, setHasMore] = useState(false);

    const latestTimestampRef = useRef(null);
    const pollingRef = useRef(null);
    const channelIdRef = useRef(channelId);

    // Update ref when channelId changes
    useEffect(() => {
        channelIdRef.current = channelId;
    }, [channelId]);

    // ═══ MAIN EFFECT: Load messages + start polling ═══
    useEffect(() => {
        // Clear previous state
        setMessages([]);
        setLoading(true);
        setError(null);
        setHasMore(false);
        latestTimestampRef.current = null;

        // Clear previous polling
        if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
        }

        if (!channelId) {
            setLoading(false);
            return;
        }

        let cancelled = false;

        // ═══ INITIAL FETCH ═══
        const loadInitial = async () => {
            try {
                const data = await api.get(`/api/chat/${channelId}`, { limit: 50 });

                if (cancelled) return;

                if (data.success) {
                    setMessages(data.messages || []);
                    setHasMore(data.hasMore || false);

                    // Set latest timestamp for polling
                    if (data.messages && data.messages.length > 0) {
                        latestTimestampRef.current = data.messages[data.messages.length - 1].created_at;
                    } else {
                        latestTimestampRef.current = new Date().toISOString();
                    }
                }
            } catch (err) {
                if (!cancelled) {
                    console.error('Failed to load messages:', err.message);
                    setError(err.message || 'Failed to load messages');
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        loadInitial();

        // ═══ START POLLING (every 3 seconds) ═══
        pollingRef.current = setInterval(async () => {
            if (!latestTimestampRef.current || !channelIdRef.current) return;

            try {
                const data = await api.get(`/api/chat/${channelIdRef.current}`, {
                    after: latestTimestampRef.current,
                    limit: 50,
                });

                if (data.success && data.messages && data.messages.length > 0) {
                    setMessages(prev => {
                        const existingIds = new Set(prev.map(m => m.id));
                        const newMsgs = data.messages.filter(m => !existingIds.has(m.id));
                        if (newMsgs.length === 0) return prev; // No change — don't trigger re-render
                        return [...prev, ...newMsgs];
                    });

                    // Update latest timestamp
                    latestTimestampRef.current = data.messages[data.messages.length - 1].created_at;
                }
            } catch (err) {
                // Polling errors are silent
                console.warn('Poll failed:', err.message);
            }
        }, 3000);

        // ═══ CLEANUP ═══
        return () => {
            cancelled = true;
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
            }
        };
    }, [channelId]);

    // ═══ SEND MESSAGE (with optimistic update) ═══
    const sendMessage = useCallback(async (text) => {
        if (!text || !text.trim() || sending || !channelId) return;

        setSending(true);
        setError(null);

        // Optimistic message
        const optimisticId = 'temp-' + Date.now();
        const optimisticMessage = {
            id: optimisticId,
            channel_id: channelId,
            user_id: currentUser?.id,
            user_name: currentUser?.name || 'You',
            user_role: committeeRole || 'member',
            text: text.trim(),
            is_edited: false,
            is_deleted: false,
            created_at: new Date().toISOString(),
            _optimistic: true,
        };

        setMessages(prev => [...prev, optimisticMessage]);

        try {
            const data = await api.post(`/api/chat/${channelId}`, { text: text.trim() });

            if (data.success && data.message) {
                // Replace optimistic with real
                setMessages(prev =>
                    prev.map(m => m.id === optimisticId ? data.message : m)
                );

                // Update latest timestamp
                latestTimestampRef.current = data.message.created_at;
            }
        } catch (err) {
            // Remove optimistic on failure
            setMessages(prev => prev.filter(m => m.id !== optimisticId));
            setError(err.message || 'Failed to send message');
            throw err;
        } finally {
            setSending(false);
        }
    }, [channelId, sending, currentUser, committeeRole]);

    // ═══ EDIT MESSAGE ═══
    const editMessage = useCallback(async (messageId, newText) => {
        try {
            setError(null);
            const data = await api.patch(`/api/chat/${channelId}/${messageId}`, { text: newText });

            if (data.success && data.message) {
                setMessages(prev => prev.map(m => m.id === messageId ? data.message : m));
            }
        } catch (err) {
            setError(err.message || 'Failed to edit message');
            throw err;
        }
    }, [channelId]);

    // ═══ DELETE MESSAGE ═══
    const deleteMessage = useCallback(async (messageId) => {
        // Optimistic removal
        const previousMessages = [...messages];
        setMessages(prev => prev.filter(m => m.id !== messageId));

        try {
            await api.delete(`/api/chat/${channelId}/${messageId}`);
        } catch (err) {
            // Revert on failure
            setMessages(previousMessages);
            setError(err.message || 'Failed to delete message');
        }
    }, [channelId, messages]);

    // ═══ LOAD MORE (older messages) ═══
    const loadMore = useCallback(async () => {
        if (!hasMore || messages.length === 0 || !channelId) return;

        const oldestTimestamp = messages[0].created_at;

        try {
            const data = await api.get(`/api/chat/${channelId}`, {
                before: oldestTimestamp,
                limit: 50,
            });

            if (data.success && data.messages && data.messages.length > 0) {
                setMessages(prev => [...data.messages, ...prev]);
            }
            setHasMore(data.hasMore || false);
        } catch (err) {
            console.error('Load more failed:', err.message);
        }
    }, [channelId, hasMore, messages]);

    return {
        messages,
        loading,
        sending,
        error,
        hasMore,
        sendMessage,
        editMessage,
        deleteMessage,
        loadMore,
    };
}
