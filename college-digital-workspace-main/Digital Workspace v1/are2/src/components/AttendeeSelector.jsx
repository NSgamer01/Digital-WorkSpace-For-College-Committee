// ============================================
// src/components/AttendeeSelector.jsx
// ============================================
// Committee member picker for meeting attendees.
// CONTROLLED component: parent owns selectedIds,
// this component calls onChange with new array.
// ============================================

import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import api from '../utils/api';

const ROLE_COLORS = {
    head: { bg: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca' },
    faculty: { bg: '#f5f3ff', color: '#8b5cf6', border: '1px solid #ddd6fe' },
    admin: { bg: '#fffbeb', color: '#f59e0b', border: '1px solid #fde68a' },
    coordinator: { bg: '#eff6ff', color: '#3b82f6', border: '1px solid #bfdbfe' },
    secretary: { bg: '#ecfeff', color: '#06b6d4', border: '1px solid #a5f3fc' },
    treasurer: { bg: '#ecfdf5', color: '#10b981', border: '1px solid #a7f3d0' },
    volunteer: { bg: '#eef2ff', color: '#6366f1', border: '1px solid #c7d2fe' },
    member: { bg: 'var(--bgTertiary)', color: 'var(--textSecondary)', border: '1px solid var(--border)' },
};

const AttendeeSelector = forwardRef(({ selectedIds = [], onChange, committeeSlug }, ref) => {
    const [members, setMembers] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Expose members to parent (MeetingModal needs emails for Google Calendar sync)
    useImperativeHandle(ref, () => ({
        getMembers: () => members,
        getMemberEmails: (ids) => {
            return ids
                .map(id => members.find(m => m.id === id))
                .filter(Boolean)
                .map(m => m.email)
                .filter(Boolean);
        },
    }));

    // ── Fetch committee members ───────────────────
    useEffect(() => {
        if (!committeeSlug) return;

        const fetchMembers = async () => {
            setLoading(true);
            setError(null);
            try {
                // api.js uses raw API_BASE + path (no /api prefix auto-added)
                const data = await api.get(`/api/committees/${committeeSlug}/details`);
                setMembers(data.members || []);
            } catch (err) {
                console.error('Failed to fetch committee members:', err);
                setError(err.message || 'Failed to load members');
                setMembers([]);
            } finally {
                setLoading(false);
            }
        };

        fetchMembers();
    }, [committeeSlug]);

    // ── Filter members by search ──────────────────
    const filteredMembers = members.filter((m) => {
        const q = search.toLowerCase();
        return (m.name || '').toLowerCase().includes(q) ||
            (m.email || '').toLowerCase().includes(q);
    });

    // ── Toggle selection ──────────────────────────
    const toggleMember = (userId) => {
        let newIds;
        if (selectedIds.includes(userId)) {
            newIds = selectedIds.filter((id) => id !== userId);
        } else {
            newIds = [...selectedIds, userId];
        }
        onChange(newIds);
    };

    // ── Select All / Clear ────────────────────────
    const selectAll = () => {
        onChange(members.map(m => m.id));
    };

    const clearAll = () => {
        onChange([]);
    };

    // ── Remove from chips ─────────────────────────
    const removeMember = (userId) => {
        onChange(selectedIds.filter((id) => id !== userId));
    };

    // ── Get member by ID ──────────────────────────
    const getMember = (id) => members.find((m) => m.id === id);

    const roleStyle = (role) => ROLE_COLORS[role?.toLowerCase()] || ROLE_COLORS.member;

    return (
        <div style={styles.container}>
            {/* Header with Select All / Clear */}
            <div style={styles.headerRow}>
                <span style={styles.headerLabel}>Attendees</span>
                <div style={styles.headerActions}>
                    <button type="button" onClick={selectAll} style={styles.headerBtn} disabled={loading || members.length === 0}>
                        Select All
                    </button>
                    <button type="button" onClick={clearAll} style={styles.headerBtn} disabled={selectedIds.length === 0}>
                        Clear
                    </button>
                </div>
            </div>

            {/* Selected chips */}
            {selectedIds.length > 0 && (
                <div style={styles.chipsRow}>
                    {selectedIds.map((id) => {
                        const member = getMember(id);
                        if (!member) return null;
                        return (
                            <div key={id} style={styles.chip}>
                                <div style={styles.chipAvatar}>
                                    {member.avatar
                                        ? <img src={member.avatar} alt={member.name} style={styles.chipAvatarImg} />
                                        : <span style={styles.chipAvatarInitial}>{(member.name || '?')[0].toUpperCase()}</span>
                                    }
                                </div>
                                <span style={styles.chipName}>{(member.name || '').split(' ')[0]}</span>
                                <button
                                    style={styles.chipRemove}
                                    onClick={() => removeMember(id)}
                                    type="button"
                                >
                                    ✕
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Search */}
            <div style={styles.searchContainer}>
                <span style={styles.searchIcon}>🔍</span>
                <input
                    type="text"
                    placeholder="Search members..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={styles.searchInput}
                />
            </div>

            {/* Member list */}
            <div style={styles.memberList}>
                {loading ? (
                    <div style={styles.statusText}>
                        <div style={styles.spinner} />
                        Loading members...
                    </div>
                ) : error ? (
                    <div style={styles.errorBox}>
                        <span>⚠️ {error}</span>
                        <button
                            type="button"
                            onClick={() => {
                                setError(null);
                                setLoading(true);
                                api.get(`/api/committees/${committeeSlug}/details`)
                                    .then(data => setMembers(data.members || []))
                                    .catch(err => setError(err.message))
                                    .finally(() => setLoading(false));
                            }}
                            style={styles.retryBtn}
                        >
                            Retry
                        </button>
                    </div>
                ) : filteredMembers.length === 0 ? (
                    <div style={styles.statusText}>
                        {search ? 'No members match your search' : 'No members found in this committee'}
                    </div>
                ) : (
                    filteredMembers.map((member) => {
                        const isSelected = selectedIds.includes(member.id);
                        const rs = roleStyle(member.role);
                        return (
                            <div
                                key={member.id}
                                style={{
                                    ...styles.memberRow,
                                    backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                                }}
                                onClick={() => toggleMember(member.id)}
                            >
                                <div style={styles.checkbox}>
                                    {isSelected ? (
                                        <div style={styles.checkedBox}>✓</div>
                                    ) : (
                                        <div style={styles.uncheckedBox} />
                                    )}
                                </div>
                                <div style={styles.memberAvatar}>
                                    {member.avatar
                                        ? <img src={member.avatar} alt={member.name} style={styles.memberAvatarImg} />
                                        : <span style={styles.memberAvatarInitial}>{(member.name || '?')[0].toUpperCase()}</span>
                                    }
                                </div>
                                <div style={styles.memberInfo}>
                                    <div style={styles.memberNameRow}>
                                        <span style={styles.memberName}>{member.name}</span>
                                        <span style={{
                                            ...styles.roleBadge,
                                            backgroundColor: rs.bg,
                                            color: rs.color,
                                            border: rs.border,
                                        }}>
                                            {(member.role || 'member').charAt(0).toUpperCase() + (member.role || 'member').slice(1)}
                                        </span>
                                    </div>
                                    {member.email && (
                                        <span style={styles.memberEmail}>{member.email}</span>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Count */}
            <div style={styles.count}>
                {selectedIds.length} of {members.length} selected
            </div>
        </div>
    );
});

AttendeeSelector.displayName = 'AttendeeSelector';

// ── Styles ──────────────────────────────────────
const styles = {
    container: {
        border: '1px solid var(--border)',
        borderRadius: '10px',
        overflow: 'hidden',
    },
    headerRow: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        borderBottom: '1px solid var(--border)',
        backgroundColor: 'var(--bgTertiary)',
    },
    headerLabel: {
        fontSize: '12px',
        fontWeight: '600',
        color: 'var(--textSecondary)',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
    },
    headerActions: {
        display: 'flex',
        gap: '6px',
    },
    headerBtn: {
        padding: '3px 8px',
        fontSize: '11px',
        fontWeight: '500',
        color: 'var(--accent)',
        background: 'none',
        border: '1px solid var(--border)',
        borderRadius: '4px',
        cursor: 'pointer',
        transition: 'background-color 0.15s',
    },
    chipsRow: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '6px',
        padding: '10px 12px',
        borderBottom: '1px solid var(--border)',
    },
    chip: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        backgroundColor: 'var(--bgTertiary)',
        borderRadius: '16px',
        padding: '4px 10px 4px 4px',
    },
    chipAvatar: {
        width: '20px',
        height: '20px',
        borderRadius: '50%',
        backgroundColor: 'var(--bgHover)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    chipAvatarImg: {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        borderRadius: '50%',
    },
    chipAvatarInitial: {
        fontSize: '10px',
        fontWeight: '600',
        color: 'var(--textSecondary)',
    },
    chipName: {
        fontSize: '12px',
        color: 'var(--textPrimary)',
        fontWeight: '500',
    },
    chipRemove: {
        background: 'none',
        border: 'none',
        color: 'var(--textTertiary)',
        cursor: 'pointer',
        fontSize: '11px',
        padding: '0 2px',
        lineHeight: 1,
    },
    searchContainer: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 12px',
        borderBottom: '1px solid var(--border)',
    },
    searchIcon: {
        fontSize: '14px',
        opacity: 0.6,
    },
    searchInput: {
        flex: 1,
        border: 'none',
        background: 'transparent',
        color: 'var(--textPrimary)',
        fontSize: '13px',
        outline: 'none',
    },
    memberList: {
        maxHeight: '250px',
        overflowY: 'auto',
    },
    memberRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '8px 12px',
        cursor: 'pointer',
        transition: 'background-color 0.15s',
    },
    checkbox: {
        flexShrink: 0,
    },
    checkedBox: {
        width: '18px',
        height: '18px',
        borderRadius: '4px',
        backgroundColor: 'var(--accent)',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '12px',
        fontWeight: '700',
    },
    uncheckedBox: {
        width: '18px',
        height: '18px',
        borderRadius: '4px',
        border: '2px solid var(--border)',
    },
    memberAvatar: {
        width: '28px',
        height: '28px',
        borderRadius: '50%',
        backgroundColor: 'var(--bgTertiary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        flexShrink: 0,
    },
    memberAvatarImg: {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        borderRadius: '50%',
    },
    memberAvatarInitial: {
        fontSize: '12px',
        fontWeight: '600',
        color: 'var(--textSecondary)',
    },
    memberInfo: {
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        flex: 1,
        minWidth: 0,
    },
    memberNameRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    memberName: {
        fontSize: '13px',
        fontWeight: '500',
        color: 'var(--textPrimary)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
    memberEmail: {
        fontSize: '11px',
        color: 'var(--textTertiary)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
    roleBadge: {
        fontSize: '10px',
        fontWeight: '600',
        padding: '2px 6px',
        borderRadius: '4px',
        flexShrink: 0,
    },
    count: {
        padding: '8px 12px',
        fontSize: '12px',
        color: 'var(--textTertiary)',
        borderTop: '1px solid var(--border)',
        textAlign: 'right',
    },
    statusText: {
        padding: '20px',
        textAlign: 'center',
        fontSize: '13px',
        color: 'var(--textTertiary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
    },
    spinner: {
        width: '14px',
        height: '14px',
        border: '2px solid var(--border)',
        borderTopColor: 'var(--accent)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
        display: 'inline-block',
    },
    errorBox: {
        padding: '16px',
        textAlign: 'center',
        fontSize: '13px',
        color: 'var(--error, #ef4444)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
    },
    retryBtn: {
        padding: '4px 12px',
        fontSize: '12px',
        fontWeight: '500',
        color: 'var(--accent)',
        background: 'none',
        border: '1px solid var(--accent)',
        borderRadius: '6px',
        cursor: 'pointer',
    },
};

export default AttendeeSelector;
