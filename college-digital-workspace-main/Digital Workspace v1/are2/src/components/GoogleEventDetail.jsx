// ============================================
// src/components/GoogleEventDetail.jsx
// ============================================
// Read-only modal for Google Calendar events.
// Cannot edit or delete — informational only.
// ============================================

import React from 'react';

const GoogleEventDetail = ({ event, onClose }) => {
    if (!event) return null;

    const formatDate = (date) => {
        if (!date) return '';
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
        });
    };

    const formatTime = (date) => {
        if (!date) return '';
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        });
    };

    return (
        <div style={styles.overlay} onClick={onClose}>
            <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div style={styles.header}>
                    <div>
                        <h2 style={styles.title}>{event.title}</h2>
                        <div style={styles.googleBadge}>
                            <span style={styles.googleDot} />
                            Google Calendar
                        </div>
                    </div>
                    <button style={styles.closeBtn} onClick={onClose}>✕</button>
                </div>

                {/* Body */}
                <div style={styles.body}>
                    {/* Date & Time */}
                    <div style={styles.row}>
                        <span style={styles.rowIcon}>📅</span>
                        <div>
                            <div style={styles.rowText}>{formatDate(event.start)}</div>
                            {!event.allDay && (
                                <div style={styles.rowSubtext}>
                                    {formatTime(event.start)} - {formatTime(event.end)}
                                </div>
                            )}
                            {event.allDay && (
                                <div style={styles.rowSubtext}>All day</div>
                            )}
                        </div>
                    </div>

                    {/* Location */}
                    {event.location && (
                        <div style={styles.row}>
                            <span style={styles.rowIcon}>📍</span>
                            <div style={styles.rowText}>{event.location}</div>
                        </div>
                    )}

                    {/* Description */}
                    {event.description && (
                        <div style={styles.row}>
                            <span style={styles.rowIcon}>📝</span>
                            <div style={styles.description}>{event.description}</div>
                        </div>
                    )}

                    {/* Open in Google Calendar */}
                    {event.googleLink && (
                        <a
                            href={event.googleLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={styles.googleLink}
                        >
                            Open in Google Calendar ↗
                        </a>
                    )}

                    {/* Info notice */}
                    <div style={styles.notice}>
                        <span style={styles.noticeIcon}>ℹ️</span>
                        <span style={styles.noticeText}>
                            This event is from your Google Calendar and cannot be edited here.
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ── Styles ──────────────────────────────────────
const styles = {
    overlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
    },
    modal: {
        backgroundColor: 'var(--cardBg)',
        borderRadius: '16px',
        maxWidth: '480px',
        width: '100%',
        boxShadow: '0 24px 48px rgba(0, 0, 0, 0.3)',
        overflow: 'hidden',
    },
    header: {
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        padding: '20px 24px',
        borderBottom: '1px solid var(--border)',
    },
    title: {
        fontSize: '18px',
        fontWeight: '700',
        color: 'var(--textPrimary)',
        margin: '0 0 6px 0',
    },
    googleBadge: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '12px',
        fontWeight: '600',
        color: '#4285f4',
        backgroundColor: 'rgba(66, 133, 244, 0.1)',
        padding: '3px 10px',
        borderRadius: '12px',
    },
    googleDot: {
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        backgroundColor: '#4285f4',
    },
    closeBtn: {
        background: 'none',
        border: 'none',
        color: 'var(--textTertiary)',
        fontSize: '18px',
        cursor: 'pointer',
        padding: '4px',
        lineHeight: 1,
        borderRadius: '6px',
        transition: 'color 0.2s',
    },
    body: {
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
    },
    row: {
        display: 'flex',
        gap: '12px',
        alignItems: 'flex-start',
    },
    rowIcon: {
        fontSize: '16px',
        flexShrink: 0,
        marginTop: '2px',
    },
    rowText: {
        fontSize: '14px',
        color: 'var(--textPrimary)',
        fontWeight: '500',
    },
    rowSubtext: {
        fontSize: '13px',
        color: 'var(--textSecondary)',
        marginTop: '2px',
    },
    description: {
        fontSize: '13px',
        color: 'var(--textSecondary)',
        lineHeight: 1.5,
        whiteSpace: 'pre-wrap',
    },
    googleLink: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '10px 16px',
        borderRadius: '10px',
        backgroundColor: 'rgba(66, 133, 244, 0.1)',
        color: '#4285f4',
        fontSize: '13px',
        fontWeight: '600',
        textDecoration: 'none',
        textAlign: 'center',
        justifyContent: 'center',
        transition: 'background-color 0.2s',
    },
    notice: {
        display: 'flex',
        gap: '8px',
        alignItems: 'flex-start',
        padding: '12px 14px',
        borderRadius: '10px',
        backgroundColor: 'var(--bgTertiary)',
        marginTop: '4px',
    },
    noticeIcon: {
        fontSize: '14px',
        flexShrink: 0,
    },
    noticeText: {
        fontSize: '12px',
        color: 'var(--textTertiary)',
        lineHeight: 1.4,
    },
};

export default GoogleEventDetail;
