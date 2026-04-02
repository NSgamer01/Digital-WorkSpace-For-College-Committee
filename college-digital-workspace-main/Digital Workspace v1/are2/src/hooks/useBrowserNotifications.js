// ============================================
// src/hooks/useBrowserNotifications.js
// ============================================
// Hook wrapping the browser Notification API.
// Provides permission state, request function,
// and showNotification helper.
// ============================================

import { useState, useCallback, useEffect } from 'react';

export default function useBrowserNotifications() {
    const isSupported = 'Notification' in window;
    const [permission, setPermission] = useState(
        isSupported ? Notification.permission : 'denied'
    );

    // Sync permission state (could change from browser settings)
    useEffect(() => {
        if (!isSupported) return;
        setPermission(Notification.permission);
    }, [isSupported]);

    // Request permission from the user
    const requestPermission = useCallback(async () => {
        if (!isSupported) return 'denied';
        try {
            const result = await Notification.requestPermission();
            setPermission(result);
            return result;
        } catch (err) {
            console.error('Notification permission error:', err);
            return 'denied';
        }
    }, [isSupported]);

    // Show a browser notification
    const showNotification = useCallback((title, options = {}) => {
        if (!isSupported || permission !== 'granted') return;

        try {
            const n = new Notification(title, {
                body: options.body || '',
                icon: options.icon || '/favicon.ico',
                badge: '/favicon.ico',
                tag: options.tag || 'workspace-notification',
                requireInteraction: false,
                silent: false,
            });

            n.onclick = () => {
                window.focus();
                if (options.url) {
                    window.location.href = options.url;
                }
                n.close();
            };

            // Auto-close after 8 seconds
            setTimeout(() => n.close(), 8000);
        } catch (err) {
            console.error('Browser notification error:', err);
        }
    }, [isSupported, permission]);

    return {
        permission,
        isSupported,
        requestPermission,
        showNotification,
    };
}
