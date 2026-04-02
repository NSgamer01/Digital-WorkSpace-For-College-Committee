import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useLocation } from 'react-router-dom';
import NotificationPermissionBanner from './NotificationPermissionBanner';
import useBrowserNotifications from '../hooks/useBrowserNotifications';
import { useNotifications } from '../contexts/NotificationContext';
import api from '../utils/api';

const Layout = ({ children }) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const location = useLocation();

    const isMessagesPage = location.pathname === '/messages';
    const isDashboard = location.pathname === '/dashboard';

    // Auto-collapse sidebar on Messages page
    useEffect(() => {
        if (isMessagesPage) {
            setIsSidebarOpen(false);
        }
    }, [isMessagesPage]);

    const toggleSidebar = () => {
        // Block expand on Messages page
        if (isMessagesPage) return;
        setIsSidebarOpen((prev) => !prev);
    };

    // ── Browser notification trigger ──────────────────────
    const { unreadCount } = useNotifications();
    const { showNotification, permission } = useBrowserNotifications();
    const prevCountRef = useRef(0);

    useEffect(() => {
        // Only fire for genuinely NEW notifications (count increased)
        if (
            permission === 'granted' &&
            unreadCount > prevCountRef.current &&
            prevCountRef.current >= 0
        ) {
            // Fetch the newest notification to get its content
            api.get('/api/notifications?limit=1')
                .then((data) => {
                    const latest = (data.notifications || [])[0];
                    if (latest && !latest.is_read) {
                        showNotification(latest.title, {
                            body: latest.message,
                            url: latest.link,
                            tag: `notif-${latest.id}`,
                        });
                    }
                })
                .catch(() => { });
        }
        prevCountRef.current = unreadCount;
    }, [unreadCount, permission, showNotification]);

    // Messages page needs edge-to-edge space (no padding)
    const isFullWidth = isMessagesPage;

    return (
        <div className={`h-screen flex flex-col bg-zinc-950 overflow-hidden ${isDashboard ? 'hide-scrollbar' : ''}`}>
            <Sidebar isOpen={isSidebarOpen} toggleSidebar={toggleSidebar} forceCollapsed={isMessagesPage} />

            <div className={`flex-1 flex flex-col min-h-0 transition-all duration-300 ease-in-out ${isSidebarOpen ? 'ml-[260px]' : 'ml-[80px]'}`}>
                <Topbar isSidebarOpen={isSidebarOpen} />

                <main className={`flex-1 min-h-0 flex flex-col ${isFullWidth ? 'p-0 overflow-hidden' : isDashboard ? 'p-8 overflow-y-auto hide-scrollbar' : 'p-8 overflow-y-auto hide-scrollbar'}`}>
                    <NotificationPermissionBanner />
                    {children}
                </main>
            </div>
        </div>
    );
};

export default Layout;

