// ============================================
// src/contexts/SettingsContext.jsx — Settings State + API Sync
// ============================================
// Fetches user settings from /api/settings on mount.
// Provides settings state, loading indicator, and
// updateSettings(section, data) function.
// ============================================

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import { useAuth } from '../contexts/AuthContext';

const SettingsContext = createContext(null);

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (!context) throw new Error('useSettings must be used within SettingsProvider');
    return context;
};

export const SettingsProvider = ({ children }) => {
    const { isAuthenticated } = useAuth();
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);

    // Fetch settings on mount when authenticated
    const fetchSettings = useCallback(async () => {
        try {
            setLoading(true);
            const data = await api.get('/api/settings');
            if (data.success) {
                setSettings(data.settings);
            }
        } catch (err) {
            console.error('Failed to fetch settings:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isAuthenticated) {
            fetchSettings();
        } else {
            setSettings(null);
            setLoading(false);
        }
    }, [isAuthenticated, fetchSettings]);

    // Update a specific section
    const updateSettings = useCallback(async (section, data) => {
        try {
            const response = await api.patch(`/api/settings/${section}`, data);
            if (response.success) {
                setSettings(prev => ({
                    ...prev,
                    [section]: response[section] || { ...prev[section], ...data },
                }));
                return { success: true };
            }
            return { success: false, error: 'Update failed' };
        } catch (err) {
            console.error(`Failed to update ${section} settings:`, err);
            return { success: false, error: err.message };
        }
    }, []);

    // Upload avatar
    const uploadAvatar = useCallback(async (file) => {
        try {
            const formData = new FormData();
            formData.append('avatar', file);
            const data = await api.upload('/api/settings/avatar', formData);
            if (data.success) {
                setSettings(prev => ({
                    ...prev,
                    profile: { ...prev?.profile, avatar: data.avatarUrl },
                }));
                return { success: true, avatarUrl: data.avatarUrl };
            }
            return { success: false, error: 'Upload failed' };
        } catch (err) {
            console.error('Avatar upload failed:', err);
            return { success: false, error: err.message };
        }
    }, []);

    // Upload cover
    const uploadCover = useCallback(async (file) => {
        try {
            const formData = new FormData();
            formData.append('cover', file);
            const data = await api.upload('/api/settings/cover', formData);
            if (data.success) {
                setSettings(prev => ({
                    ...prev,
                    profile: { ...prev?.profile, coverPhoto: data.coverUrl },
                }));
                return { success: true, coverUrl: data.coverUrl };
            }
            return { success: false, error: 'Upload failed' };
        } catch (err) {
            console.error('Cover upload failed:', err);
            return { success: false, error: err.message };
        }
    }, []);

    const value = {
        settings,
        loading,
        updateSettings,
        uploadAvatar,
        uploadCover,
        refreshSettings: fetchSettings,
    };

    return (
        <SettingsContext.Provider value={value}>
            {children}
        </SettingsContext.Provider>
    );
};

export default SettingsContext;
