// ============================================
// src/hooks/useChannels.js — Channel Management Hook
// ============================================
// Fetches channels, splits into public/DM, auto-selects
// general, provides openDm() find-or-create.
// ============================================

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useCommittee } from '../contexts/CommitteeContext';
import api from '../utils/api';

export default function useChannels() {
    const { currentCommittee } = useCommittee();
    const [channels, setChannels] = useState([]);
    const [currentChannel, setCurrentChannel] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const initialLoadDone = useRef(false);

    // Derived: public channels (text + announcement)
    const publicChannels = useMemo(
        () => channels.filter(c => c.type !== 'dm'),
        [channels]
    );

    // Derived: DM channels
    const dmChannels = useMemo(
        () => channels.filter(c => c.type === 'dm'),
        [channels]
    );

    // Fetch channels from API
    const fetchChannels = useCallback(async (preserveSelection = false) => {
        try {
            setError(null);
            const data = await api.get('/api/channels');

            if (data.success && data.channels) {
                setChannels(data.channels);

                // Auto-select general on first load
                if (!preserveSelection && !initialLoadDone.current) {
                    const generalChannel = data.channels.find(c => c.slug === 'general');
                    if (generalChannel) {
                        setCurrentChannel(generalChannel);
                    } else if (data.channels.length > 0) {
                        setCurrentChannel(data.channels[0]);
                    }
                    initialLoadDone.current = true;
                }

                // If preserving selection, update the currentChannel object with fresh data
                if (preserveSelection && currentChannel) {
                    const updated = data.channels.find(c => c.id === currentChannel.id);
                    if (updated) {
                        setCurrentChannel(updated);
                    }
                }
            }
        } catch (err) {
            console.error('Failed to fetch channels:', err.message);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [currentChannel]);

    // Load on mount and when committee changes
    useEffect(() => {
        if (!currentCommittee) return;

        initialLoadDone.current = false;
        setChannels([]);
        setCurrentChannel(null);
        setLoading(true);
        fetchChannels();
    }, [currentCommittee?.slug]);

    // Create a public channel
    const createChannel = useCallback(async ({ name, description, type }) => {
        try {
            setError(null);
            const data = await api.post('/api/channels', { name, description, type });

            if (data.success && data.channel) {
                setChannels(prev => [...prev, data.channel]);
                setCurrentChannel(data.channel);
                return data.channel;
            }
        } catch (err) {
            setError(err.message);
            throw err;
        }
    }, []);

    // Open DM — find-or-create (THE CRITICAL DEDUP FUNCTION)
    const openDm = useCallback(async (userId) => {
        try {
            setError(null);
            const data = await api.post('/api/channels/dm', { userId });

            if (data.success && data.channel) {
                if (data.created) {
                    // New DM channel — add to local array
                    setChannels(prev => [...prev, data.channel]);
                } else {
                    // Existing DM — verify it's in local array
                    setChannels(prev => {
                        const exists = prev.find(c => c.id === data.channel.id);
                        if (!exists) return [...prev, data.channel];
                        return prev;
                    });
                }

                setCurrentChannel(data.channel);
                return data.channel;
            }
        } catch (err) {
            setError(err.message);
            throw err;
        }
    }, []);

    // Delete a channel
    const deleteChannel = useCallback(async (channelId) => {
        try {
            setError(null);
            await api.delete(`/api/channels/${channelId}`);

            setChannels(prev => prev.filter(c => c.id !== channelId));

            // If deleted channel was current, switch to general
            if (currentChannel && currentChannel.id === channelId) {
                const generalChannel = channels.find(c => c.slug === 'general');
                setCurrentChannel(generalChannel || channels[0] || null);
            }
        } catch (err) {
            setError(err.message);
            throw err;
        }
    }, [currentChannel, channels]);

    // Refresh channel list
    const refresh = useCallback(() => {
        fetchChannels(true);
    }, [fetchChannels]);

    return {
        channels,
        publicChannels,
        dmChannels,
        currentChannel,
        setCurrentChannel,
        loading,
        error,
        createChannel,
        openDm,
        deleteChannel,
        refresh,
    };
}
