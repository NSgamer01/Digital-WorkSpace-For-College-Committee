// ============================================
// src/components/NotificationPermissionBanner.jsx
// ============================================
// Dismissible banner prompting the user to enable
// browser notifications. Shows only when:
//   - Notification API is supported
//   - Permission is 'default' (not yet asked)
//   - User hasn't dismissed via localStorage
// ============================================

import React, { useState, useEffect } from 'react';
import useBrowserNotifications from '../hooks/useBrowserNotifications';

const DISMISSED_KEY = 'notifBannerDismissed';

export default function NotificationPermissionBanner() {
    const { permission, isSupported, requestPermission } = useBrowserNotifications();
    const [visible, setVisible] = useState(false);
    const [granted, setGranted] = useState(false);

    useEffect(() => {
        if (!isSupported) return;
        if (permission !== 'default') return;
        if (localStorage.getItem(DISMISSED_KEY) === 'true') return;
        setVisible(true);
    }, [isSupported, permission]);

    if (!visible) return null;

    // Show brief success message after granting
    if (granted) {
        return (
            <div style={styles.banner}>
                <span style={{ fontSize: 18 }}>✅</span>
                <span style={{ color: 'var(--success, #22c55e)', fontWeight: 600, fontSize: 14 }}>
                    Browser notifications enabled!
                </span>
            </div>
        );
    }

    const handleEnable = async () => {
        const result = await requestPermission();
        if (result === 'granted') {
            setGranted(true);
            setTimeout(() => setVisible(false), 2000);
        } else {
            // Permission denied or dismissed — hide banner
            localStorage.setItem(DISMISSED_KEY, 'true');
            setVisible(false);
        }
    };

    const handleDismiss = () => {
        localStorage.setItem(DISMISSED_KEY, 'true');
        setVisible(false);
    };

    return (
        <div style={styles.banner}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>🔔</span>
            <div style={{ flex: 1, minWidth: 0 }}>
                <p style={styles.title}>Enable browser notifications</p>
                <p style={styles.subtitle}>
                    Get instant alerts for task assignments and meeting invitations.
                </p>
            </div>
            <div style={styles.actions}>
                <button onClick={handleEnable} style={styles.enableBtn}>
                    Enable
                </button>
                <button onClick={handleDismiss} style={styles.dismissBtn}>
                    Maybe Later
                </button>
            </div>
        </div>
    );
}

const styles = {
    banner: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 20px',
        marginBottom: 16,
        background: 'var(--bgSecondary, rgba(99,102,241,0.06))',
        borderLeft: '4px solid var(--accent, #6366f1)',
        borderRadius: 8,
        animation: 'fadeIn 0.3s ease-out',
    },
    title: {
        margin: 0,
        fontSize: 14,
        fontWeight: 600,
        color: 'var(--textPrimary, #fff)',
    },
    subtitle: {
        margin: '2px 0 0',
        fontSize: 13,
        color: 'var(--textSecondary, #a1a1aa)',
        lineHeight: 1.4,
    },
    actions: {
        display: 'flex',
        gap: 8,
        flexShrink: 0,
    },
    enableBtn: {
        padding: '6px 16px',
        background: 'var(--accent, #6366f1)',
        color: '#fff',
        border: 'none',
        borderRadius: 6,
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
    },
    dismissBtn: {
        padding: '6px 12px',
        background: 'transparent',
        color: 'var(--textTertiary, #71717a)',
        border: '1px solid var(--border, rgba(255,255,255,0.1))',
        borderRadius: 6,
        fontSize: 13,
        cursor: 'pointer',
    },
};
