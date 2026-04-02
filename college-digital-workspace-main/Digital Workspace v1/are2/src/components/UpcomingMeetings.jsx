// ============================================
// src/components/UpcomingMeetings.jsx
// ============================================
// Upcoming meetings list. Used in two places:
// 1. Calendar page — right sidebar
// 2. Dashboard page — widget card
// ============================================

import React from 'react';
import { useNavigate } from 'react-router-dom';
import MeetingCard from './MeetingCard';

const UpcomingMeetings = ({
    meetings = [],
    loading = false,
    error = null,
    onEdit,
    onDelete,
    onCreate,
    maxItems = 5,
    title = 'Upcoming Meetings',
    showViewAll = false,
    compact = false,
}) => {
    const navigate = useNavigate();
    const displayMeetings = meetings.slice(0, maxItems);

    // ── Loading state ─────────────────────────────
    if (loading) {
        return (
            <div style={styles.container}>
                <div style={styles.header}>
                    <div style={styles.headerLeft}>
                        <span style={styles.headerIcon}>📅</span>
                        <h3 style={styles.headerTitle}>{title}</h3>
                    </div>
                </div>
                <div style={styles.body}>
                    {[1, 2, 3].map((i) => (
                        <div key={i} style={styles.skeleton}>
                            <div style={{ ...styles.skeletonLine, width: '60%' }} />
                            <div style={{ ...styles.skeletonLine, width: '80%', height: '10px' }} />
                            <div style={{ ...styles.skeletonLine, width: '40%', height: '10px' }} />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // ── Error state ───────────────────────────────
    if (error) {
        return (
            <div style={styles.container}>
                <div style={styles.header}>
                    <div style={styles.headerLeft}>
                        <span style={styles.headerIcon}>📅</span>
                        <h3 style={styles.headerTitle}>{title}</h3>
                    </div>
                </div>
                <div style={styles.emptyBody}>
                    <span style={styles.errorIcon}>⚠️</span>
                    <p style={styles.errorText}>{error}</p>
                    <button style={styles.retryButton} onClick={onCreate}>
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    // ── Empty state ───────────────────────────────
    if (displayMeetings.length === 0) {
        return (
            <div style={styles.container}>
                <div style={styles.header}>
                    <div style={styles.headerLeft}>
                        <span style={styles.headerIcon}>📅</span>
                        <h3 style={styles.headerTitle}>{title}</h3>
                    </div>
                    {onCreate && (
                        <button style={styles.createBtn} onClick={onCreate} title="Create Meeting">
                            +
                        </button>
                    )}
                </div>
                <div style={styles.emptyBody}>
                    <span style={styles.emptyIcon}>📭</span>
                    <p style={styles.emptyTitle}>No upcoming meetings</p>
                    <p style={styles.emptySubtitle}>Schedule a meeting to get started</p>
                    {onCreate && (
                        <button style={styles.createMeetingBtn} onClick={onCreate}>
                            Create Meeting
                        </button>
                    )}
                </div>
            </div>
        );
    }

    // ── Normal render ─────────────────────────────
    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <div style={styles.headerLeft}>
                    <span style={styles.headerIcon}>📅</span>
                    <h3 style={styles.headerTitle}>{title}</h3>
                    <span style={styles.badge}>{meetings.length} scheduled</span>
                </div>
                {onCreate && (
                    <button style={styles.createBtn} onClick={onCreate} title="Create Meeting">
                        +
                    </button>
                )}
            </div>
            <div style={styles.body}>
                {displayMeetings.map((meeting, idx) => (
                    <React.Fragment key={meeting.id}>
                        <MeetingCard
                            meeting={meeting}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            compact={compact}
                            showActions={true}
                        />
                        {idx < displayMeetings.length - 1 && <div style={styles.divider} />}
                    </React.Fragment>
                ))}
            </div>
            {showViewAll && (
                <div style={styles.footer}>
                    <button
                        style={styles.viewAllBtn}
                        onClick={() => navigate('/calendar')}
                    >
                        View All Meetings →
                    </button>
                </div>
            )}
        </div>
    );
};

// ── Styles ──────────────────────────────────────
const styles = {
    container: {
        backgroundColor: 'var(--cardBg)',
        border: '1px solid var(--cardBorder, var(--border))',
        borderRadius: '16px',
        overflow: 'hidden',
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 18px 12px',
        borderBottom: '1px solid var(--border)',
    },
    headerLeft: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    headerIcon: {
        fontSize: '16px',
    },
    headerTitle: {
        fontSize: '15px',
        fontWeight: '700',
        color: 'var(--textPrimary)',
        margin: 0,
    },
    badge: {
        fontSize: '11px',
        fontWeight: '600',
        color: 'var(--accent)',
        backgroundColor: 'rgba(99, 102, 241, 0.12)',
        padding: '2px 8px',
        borderRadius: '10px',
    },
    createBtn: {
        width: '28px',
        height: '28px',
        borderRadius: '8px',
        border: '1px solid var(--border)',
        backgroundColor: 'transparent',
        color: 'var(--accent)',
        fontSize: '18px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        lineHeight: 1,
        transition: 'background-color 0.2s',
    },
    body: {
        padding: '8px 10px',
        maxHeight: '400px',
        overflowY: 'auto',
    },
    divider: {
        height: '1px',
        backgroundColor: 'var(--borderLight, var(--border))',
        margin: '2px 8px',
        opacity: 0.5,
    },
    footer: {
        padding: '10px 18px 14px',
        borderTop: '1px solid var(--border)',
        textAlign: 'center',
    },
    viewAllBtn: {
        background: 'none',
        border: 'none',
        color: 'var(--accent)',
        fontSize: '13px',
        fontWeight: '600',
        cursor: 'pointer',
        padding: '4px 0',
        transition: 'opacity 0.2s',
    },
    emptyBody: {
        padding: '32px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
    },
    emptyIcon: {
        fontSize: '32px',
        marginBottom: '4px',
    },
    emptyTitle: {
        fontSize: '14px',
        fontWeight: '600',
        color: 'var(--textPrimary)',
        margin: 0,
    },
    emptySubtitle: {
        fontSize: '13px',
        color: 'var(--textTertiary)',
        margin: 0,
    },
    createMeetingBtn: {
        marginTop: '8px',
        padding: '8px 20px',
        borderRadius: '8px',
        border: 'none',
        backgroundColor: 'var(--accent)',
        color: '#fff',
        fontSize: '13px',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'background-color 0.2s',
    },
    errorIcon: {
        fontSize: '28px',
        marginBottom: '4px',
    },
    errorText: {
        fontSize: '13px',
        color: 'var(--error)',
        margin: 0,
        textAlign: 'center',
    },
    retryButton: {
        marginTop: '8px',
        padding: '6px 16px',
        borderRadius: '8px',
        border: '1px solid var(--border)',
        backgroundColor: 'transparent',
        color: 'var(--textPrimary)',
        fontSize: '13px',
        cursor: 'pointer',
        transition: 'background-color 0.2s',
    },
    skeleton: {
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
    },
    skeletonLine: {
        height: '14px',
        borderRadius: '4px',
        backgroundColor: 'var(--bgTertiary)',
        animation: 'pulse 1.5s ease-in-out infinite',
    },
};

export default UpcomingMeetings;
