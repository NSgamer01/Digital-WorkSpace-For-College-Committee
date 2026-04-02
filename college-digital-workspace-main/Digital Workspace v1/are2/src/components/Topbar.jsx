// ============================================
// src/components/Topbar.jsx
// ============================================

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCommittee } from '../contexts/CommitteeContext';
import { useTheme } from '../contexts/ThemeContext';
import { themeOptions } from '../styles/themes';
import { useNotifications } from '../contexts/NotificationContext';
import ThemeToggle from './ThemeToggle';

const Topbar = ({ isSidebarOpen }) => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const { currentCommittee } = useCommittee();
    const { currentTheme, setTheme } = useTheme();
    const { notifications, unreadCount, loading, fetchNotifications, markRead, markAllRead } = useNotifications();

    const [showThemeMenu, setShowThemeMenu] = useState(false);
    const [showNotifPanel, setShowNotifPanel] = useState(false);
    const panelRef = useRef(null);

    // Cycle through themes on click
    const cycleTheme = () => {
        const themeKeys = ['dark', 'light', 'purple', 'ocean', 'auto'];
        const currentIdx = themeKeys.indexOf(currentTheme);
        const nextIdx = (currentIdx + 1) % themeKeys.length;
        setTheme(themeKeys[nextIdx]);
    };

    const themeIcon = currentTheme === 'light' ? '☀️'
        : currentTheme === 'dark' ? '🌙'
            : currentTheme === 'purple' ? '💜'
                : currentTheme === 'ocean' ? '🌊'
                    : '🔄';

    // Close notification panel on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (panelRef.current && !panelRef.current.contains(e.target)) {
                setShowNotifPanel(false);
            }
        };
        if (showNotifPanel) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showNotifPanel]);

    // Fetch full list when opening panel
    const toggleNotifPanel = () => {
        if (!showNotifPanel) fetchNotifications();
        setShowNotifPanel(prev => !prev);
    };

    // Handle notification click
    const handleNotifClick = (notif) => {
        if (!notif.is_read) markRead(notif.id);
        if (notif.link) navigate(notif.link);
        setShowNotifPanel(false);
    };

    // Notification type → icon mapping
    const typeIcon = (type) => {
        switch (type) {
            case 'task_assigned': return '✅';
            case 'meeting_invite': return '📅';
            case 'task_updated': return '📝';
            case 'mention': return '💬';
            case 'announcement': return '📢';
            default: return '🔔';
        }
    };

    // Time ago formatter
    const timeAgo = (dateStr) => {
        const now = new Date();
        const d = new Date(dateStr);
        const diff = Math.floor((now - d) / 1000);
        if (diff < 60) return 'just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
        return d.toLocaleDateString();
    };

    return (
        <div className="topbar-wrapper">
            {/* Committee name + user email */}
            <div className="flex-1 flex items-center gap-3">
                {currentCommittee && (
                    <span
                        style={{
                            color: currentCommittee.color,
                            fontWeight: 600,
                            fontSize: '14px',
                        }}
                    >
                        {currentCommittee.name}
                    </span>
                )}
                <span className="topbar-email">
                    {user?.email || 'Loading...'}
                </span>
            </div>

            {/* Right Side */}
            <div className="flex items-center space-x-3 ml-6">
                {/* Animated Theme Toggle */}
                <ThemeToggle />

                {/* 🔔 Notification bell with badge */}
                <div style={{ position: 'relative' }} ref={panelRef}>
                    <button
                        className="topbar-btn"
                        onClick={toggleNotifPanel}
                        style={{ position: 'relative' }}
                        title="Notifications"
                    >
                        🔔
                        {unreadCount > 0 && (
                            <span style={{
                                position: 'absolute',
                                top: 2,
                                right: 2,
                                width: unreadCount > 9 ? 20 : 16,
                                height: 16,
                                borderRadius: 8,
                                background: '#ef4444',
                                color: '#fff',
                                fontSize: 10,
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                lineHeight: 1,
                                border: '2px solid var(--bgPrimary, #09090b)',
                            }}>
                                {unreadCount > 99 ? '99+' : unreadCount}
                            </span>
                        )}
                    </button>

                    {/* Notification dropdown panel */}
                    {showNotifPanel && (
                        <div
                            style={{
                                position: 'absolute',
                                top: '100%',
                                right: 0,
                                marginTop: 8,
                                width: 380,
                                maxHeight: 480,
                                background: 'var(--bgSecondary, #18181b)',
                                border: '1px solid var(--border, rgba(255,255,255,0.1))',
                                borderRadius: 14,
                                boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
                                zIndex: 200,
                                display: 'flex',
                                flexDirection: 'column',
                                overflow: 'hidden',
                                animation: 'dropdownFadeIn 0.15s ease-out',
                            }}
                        >
                            {/* Header */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '14px 16px 10px',
                                borderBottom: '1px solid rgba(255,255,255,0.06)',
                            }}>
                                <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--textPrimary, #fff)' }}>
                                    Notifications
                                </span>
                                {unreadCount > 0 && (
                                    <button
                                        onClick={markAllRead}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            color: '#6366f1',
                                            fontSize: 12,
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            padding: '2px 6px',
                                            borderRadius: 4,
                                        }}
                                    >
                                        Mark all as read
                                    </button>
                                )}
                            </div>

                            {/* List */}
                            <div style={{
                                flex: 1,
                                overflowY: 'auto',
                                padding: '4px 0',
                            }} className="custom-scroll">
                                {loading ? (
                                    <div style={{ padding: 32, textAlign: 'center' }}>
                                        <div style={{
                                            width: 24, height: 24,
                                            border: '2px solid #27272a', borderTopColor: '#6366f1',
                                            borderRadius: '50%', animation: 'spinnerRotate 0.7s linear infinite',
                                            margin: '0 auto',
                                        }} />
                                    </div>
                                ) : notifications.length === 0 ? (
                                    <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                                        <span style={{ fontSize: 32, display: 'block', marginBottom: 8 }}>🔔</span>
                                        <p style={{ color: '#71717a', fontSize: 13 }}>No notifications yet</p>
                                    </div>
                                ) : (
                                    notifications.map(notif => (
                                        <div
                                            key={notif.id}
                                            onClick={() => handleNotifClick(notif)}
                                            style={{
                                                display: 'flex',
                                                gap: 10,
                                                padding: '10px 16px',
                                                cursor: 'pointer',
                                                background: notif.is_read ? 'transparent' : 'rgba(99,102,241,0.06)',
                                                borderLeft: notif.is_read ? '3px solid transparent' : '3px solid #6366f1',
                                                transition: 'background 0.15s',
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                                            onMouseLeave={e => e.currentTarget.style.background = notif.is_read ? 'transparent' : 'rgba(99,102,241,0.06)'}
                                        >
                                            <span style={{ fontSize: 18, flexShrink: 0, marginTop: 2 }}>
                                                {typeIcon(notif.type)}
                                            </span>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <p style={{
                                                    fontSize: 13,
                                                    fontWeight: notif.is_read ? 400 : 600,
                                                    color: 'var(--textPrimary, #fff)',
                                                    margin: 0,
                                                    lineHeight: 1.3,
                                                }}>
                                                    {notif.title}
                                                </p>
                                                <p style={{
                                                    fontSize: 12,
                                                    color: '#a1a1aa',
                                                    margin: '3px 0 0',
                                                    lineHeight: 1.4,
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                }}>
                                                    {notif.message}
                                                </p>
                                                <span style={{
                                                    fontSize: 11,
                                                    color: '#52525b',
                                                    marginTop: 2,
                                                    display: 'block',
                                                }}>
                                                    {timeAgo(notif.created_at)}
                                                </span>
                                            </div>
                                            {!notif.is_read && (
                                                <span style={{
                                                    width: 8, height: 8,
                                                    borderRadius: '50%',
                                                    background: '#6366f1',
                                                    flexShrink: 0,
                                                    marginTop: 6,
                                                }} />
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <button onClick={() => navigate('/settings')} className="topbar-btn cursor-pointer" title="Settings">
                    ⚙️
                </button>

                <button
                    onClick={async () => {
                        try {
                            await logout();
                            navigate('/login');
                        } catch (err) {
                            console.error('Logout error:', err);
                        }
                    }}
                    className="topbar-btn cursor-pointer"
                    title="Sign Out"
                >
                    🚪
                </button>
            </div>
        </div>
    );
};

export default Topbar;
