// ============================================
// src/components/MeetingCard.jsx
// ============================================
// Reusable meeting card for UpcomingMeetings.
// Used in Calendar sidebar and Dashboard widget.
// ============================================

import React, { useState, useRef, useEffect } from 'react';

// ── Date formatting helpers ─────────────────────
function isToday(date) {
    const now = new Date();
    return date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate();
}

function isTomorrow(date) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return date.getFullYear() === tomorrow.getFullYear() &&
        date.getMonth() === tomorrow.getMonth() &&
        date.getDate() === tomorrow.getDate();
}

function isThisWeek(date) {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    return date >= startOfWeek && date <= endOfWeek;
}

function formatTime(date) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatMeetingDate(start, end, allDay) {
    if (!start || !end) return '';

    const sameDay = start.getFullYear() === end.getFullYear() &&
        start.getMonth() === end.getMonth() &&
        start.getDate() === end.getDate();

    if (!sameDay) {
        const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return `${startStr} - ${endStr}`;
    }

    let dayPart;
    if (isToday(start)) {
        dayPart = 'Today';
    } else if (isTomorrow(start)) {
        dayPart = 'Tomorrow';
    } else if (isThisWeek(start)) {
        dayPart = start.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
        dayPart = start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }

    if (allDay) {
        return `${dayPart} · All Day`;
    }

    return `${dayPart} · ${formatTime(start)} - ${formatTime(end)}`;
}

// ── Status badge config ─────────────────────────
const STATUS_STYLES = {
    scheduled: { bg: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', label: 'Scheduled' },
    ongoing: { bg: 'rgba(16, 185, 129, 0.15)', color: '#34d399', label: 'Ongoing' },
    completed: { bg: 'rgba(161, 161, 170, 0.15)', color: '#a1a1aa', label: 'Completed' },
    cancelled: { bg: 'rgba(239, 68, 68, 0.15)', color: '#f87171', label: 'Cancelled' },
};

// ── Component ───────────────────────────────────
const MeetingCard = ({ meeting, onEdit, onDelete, compact = false, showActions = true }) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef(null);

    // Close menu on outside click
    useEffect(() => {
        if (!menuOpen) return;
        const handleClick = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [menuOpen]);

    const statusStyle = STATUS_STYLES[meeting.status] || STATUS_STYLES.scheduled;
    const isCancelled = meeting.status === 'cancelled';

    const handleCardClick = (e) => {
        // Don't trigger if clicking the menu
        if (e.target.closest('[data-menu]')) return;
        if (onEdit) onEdit(meeting);
    };

    const handleCopyLink = () => {
        if (meeting.meetingLink) {
            navigator.clipboard.writeText(meeting.meetingLink);
        }
        setMenuOpen(false);
    };

    const handleOpenLink = () => {
        if (meeting.meetingLink) {
            window.open(meeting.meetingLink, '_blank');
        }
        setMenuOpen(false);
    };

    const handleDelete = () => {
        setMenuOpen(false);
        if (window.confirm('Are you sure you want to delete this meeting?')) {
            onDelete(meeting.id);
        }
    };

    const handleEdit = () => {
        setMenuOpen(false);
        if (onEdit) onEdit(meeting);
    };

    // ── Compact render ────────────────────────────
    if (compact) {
        return (
            <div style={styles.compactCard} onClick={handleCardClick}>
                <div style={styles.compactContent}>
                    <div style={styles.compactHeader}>
                        <div style={{ ...styles.colorDot, backgroundColor: meeting.color || '#6366f1' }} />
                        <span style={{
                            ...styles.compactTitle,
                            ...(isCancelled ? styles.cancelledTitle : {}),
                        }}>
                            {meeting.title}
                        </span>
                        {showActions && (
                            <div ref={menuRef} data-menu style={styles.menuContainer}>
                                <button
                                    style={styles.menuButton}
                                    onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
                                >
                                    ⋯
                                </button>
                                {menuOpen && (
                                    <div style={styles.dropdown}>
                                        <button style={styles.dropdownItem} onClick={handleEdit}>✏️ Edit</button>
                                        <button style={styles.dropdownItem} onClick={handleDelete}>🗑️ Delete</button>
                                        {meeting.meetingLink && (
                                            <>
                                                <button style={styles.dropdownItem} onClick={handleCopyLink}>📋 Copy Link</button>
                                                <button style={styles.dropdownItem} onClick={handleOpenLink}>🔗 Open Link</button>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    <div style={styles.compactMeta}>
                        <span style={styles.compactDate}>
                            📅 {formatMeetingDate(meeting.start, meeting.end, meeting.allDay)}
                        </span>
                    </div>
                    <div style={styles.compactFooter}>
                        {meeting.location && (
                            <span style={styles.compactLocation}>📍 {meeting.location}</span>
                        )}
                        {meeting.attendees && meeting.attendees.length > 0 && (
                            <span style={styles.compactAttendees}>👥 {meeting.attendees.length}</span>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // ── Full render ───────────────────────────────
    return (
        <div style={styles.card} onClick={handleCardClick}>
            {/* Header */}
            <div style={styles.header}>
                <div style={styles.headerLeft}>
                    <div style={{ ...styles.colorDot, backgroundColor: meeting.color || '#6366f1' }} />
                    <span style={{
                        ...styles.title,
                        ...(isCancelled ? styles.cancelledTitle : {}),
                    }}>
                        {meeting.title}
                    </span>
                </div>
                {showActions && (
                    <div ref={menuRef} data-menu style={styles.menuContainer}>
                        <button
                            style={styles.menuButton}
                            onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
                        >
                            ⋯
                        </button>
                        {menuOpen && (
                            <div style={styles.dropdown}>
                                <button style={styles.dropdownItem} onClick={handleEdit}>✏️ Edit Meeting</button>
                                <button style={{ ...styles.dropdownItem, color: '#f87171' }} onClick={handleDelete}>🗑️ Delete Meeting</button>
                                {meeting.meetingLink && (
                                    <>
                                        <div style={styles.dropdownDivider} />
                                        <button style={styles.dropdownItem} onClick={handleCopyLink}>📋 Copy Meeting Link</button>
                                        <button style={styles.dropdownItem} onClick={handleOpenLink}>🔗 Open Meeting Link</button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Date/time */}
            <div style={styles.meta}>
                <span>📅 {formatMeetingDate(meeting.start, meeting.end, meeting.allDay)}</span>
            </div>

            {/* Location */}
            {meeting.location && (
                <div style={styles.meta}>
                    <span>📍 {meeting.location}</span>
                </div>
            )}

            {/* Meeting Link */}
            {meeting.meetingLink && (
                <div style={styles.meta}>
                    <a
                        href={meeting.meetingLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={styles.link}
                        onClick={(e) => e.stopPropagation()}
                    >
                        🔗 {meeting.meetingLink.length > 40
                            ? meeting.meetingLink.substring(0, 40) + '...'
                            : meeting.meetingLink}
                    </a>
                </div>
            )}

            {/* Attendees */}
            {meeting.attendees && meeting.attendees.length > 0 && (
                <div style={styles.attendeesRow}>
                    <span style={styles.attendeeLabel}>👥 {meeting.attendees.length} attendee{meeting.attendees.length !== 1 ? 's' : ''}</span>
                    <div style={styles.avatarRow}>
                        {meeting.attendees.slice(0, 3).map((a, i) => (
                            <div key={a.id || i} style={{
                                ...styles.avatar,
                                marginLeft: i > 0 ? '-6px' : '0',
                                zIndex: 3 - i,
                            }} title={a.name}>
                                {a.avatar
                                    ? <img src={a.avatar} alt={a.name} style={styles.avatarImg} />
                                    : <span style={styles.avatarInitial}>{(a.name || '?')[0].toUpperCase()}</span>
                                }
                            </div>
                        ))}
                        {meeting.attendees.length > 3 && (
                            <div style={{ ...styles.avatar, marginLeft: '-6px', zIndex: 0 }}>
                                <span style={styles.avatarInitial}>+{meeting.attendees.length - 3}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Footer */}
            <div style={styles.footer}>
                <span style={{
                    ...styles.statusBadge,
                    backgroundColor: statusStyle.bg,
                    color: statusStyle.color,
                }}>
                    {statusStyle.label}
                </span>
                {meeting.creatorName && (
                    <span style={styles.creator}>by {meeting.creatorName}</span>
                )}
            </div>
        </div>
    );
};

// ── Styles ──────────────────────────────────────
const styles = {
    card: {
        backgroundColor: 'var(--cardBg)',
        border: '1px solid var(--cardBorder, var(--border))',
        borderRadius: '12px',
        padding: '14px 16px',
        cursor: 'pointer',
        transition: 'background-color 0.2s, transform 0.15s',
    },
    compactCard: {
        padding: '10px 12px',
        cursor: 'pointer',
        borderRadius: '8px',
        transition: 'background-color 0.2s',
    },
    compactContent: {
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
    },
    compactHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    compactTitle: {
        fontSize: '13px',
        fontWeight: '600',
        color: 'var(--textPrimary)',
        flex: 1,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
    compactMeta: {
        paddingLeft: '16px',
    },
    compactDate: {
        fontSize: '12px',
        color: 'var(--textTertiary)',
    },
    compactFooter: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        paddingLeft: '16px',
    },
    compactLocation: {
        fontSize: '11px',
        color: 'var(--textTertiary)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        maxWidth: '150px',
    },
    compactAttendees: {
        fontSize: '11px',
        color: 'var(--textTertiary)',
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '8px',
    },
    headerLeft: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        flex: 1,
        minWidth: 0,
    },
    colorDot: {
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        flexShrink: 0,
    },
    title: {
        fontSize: '14px',
        fontWeight: '600',
        color: 'var(--textPrimary)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
    cancelledTitle: {
        textDecoration: 'line-through',
        opacity: 0.6,
    },
    menuContainer: {
        position: 'relative',
        flexShrink: 0,
    },
    menuButton: {
        background: 'none',
        border: 'none',
        color: 'var(--textTertiary)',
        cursor: 'pointer',
        fontSize: '16px',
        padding: '4px 6px',
        borderRadius: '6px',
        lineHeight: 1,
        transition: 'background-color 0.2s',
    },
    dropdown: {
        position: 'absolute',
        right: 0,
        top: '100%',
        backgroundColor: 'var(--cardBg)',
        border: '1px solid var(--border)',
        borderRadius: '10px',
        boxShadow: '0 8px 24px var(--shadowMedium)',
        zIndex: 100,
        minWidth: '180px',
        padding: '4px',
        marginTop: '4px',
    },
    dropdownItem: {
        display: 'block',
        width: '100%',
        padding: '8px 12px',
        background: 'none',
        border: 'none',
        color: 'var(--textPrimary)',
        fontSize: '13px',
        textAlign: 'left',
        cursor: 'pointer',
        borderRadius: '6px',
        transition: 'background-color 0.15s',
    },
    dropdownDivider: {
        height: '1px',
        backgroundColor: 'var(--border)',
        margin: '4px 8px',
    },
    meta: {
        fontSize: '13px',
        color: 'var(--textSecondary)',
        marginBottom: '4px',
        paddingLeft: '16px',
    },
    link: {
        color: 'var(--accent)',
        textDecoration: 'none',
        fontSize: '13px',
    },
    attendeesRow: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: '8px',
        paddingLeft: '16px',
    },
    attendeeLabel: {
        fontSize: '12px',
        color: 'var(--textTertiary)',
    },
    avatarRow: {
        display: 'flex',
        alignItems: 'center',
    },
    avatar: {
        width: '24px',
        height: '24px',
        borderRadius: '50%',
        backgroundColor: 'var(--bgTertiary)',
        border: '2px solid var(--cardBg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        position: 'relative',
    },
    avatarImg: {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        borderRadius: '50%',
    },
    avatarInitial: {
        fontSize: '10px',
        fontWeight: '600',
        color: 'var(--textSecondary)',
    },
    footer: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: '10px',
        paddingLeft: '16px',
    },
    statusBadge: {
        fontSize: '11px',
        fontWeight: '600',
        padding: '3px 8px',
        borderRadius: '6px',
    },
    creator: {
        fontSize: '11px',
        color: 'var(--textTertiary)',
    },
};

export default MeetingCard;
