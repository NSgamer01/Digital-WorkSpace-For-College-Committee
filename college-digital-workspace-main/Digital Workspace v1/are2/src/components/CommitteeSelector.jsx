// ============================================
// src/components/CommitteeSelector.jsx
// ============================================
// Full-page committee selector shown after login.
// Dark gradient background with animated committee cards.
// ============================================

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCommittee } from '../contexts/CommitteeContext';

// Icon mapping
const ICON_MAP = {
    'fa-graduation-cap': '🎓',
    'fa-trophy': '🏆',
    'fa-hands-helping': '🤝',
    'fa-building': '🏢',
    'fa-users': '👥',
    'fa-book': '📚',
    'fa-star': '⭐',
};

// Role badge colors
const ROLE_COLORS = {
    head: { bg: '#fef2f2', text: '#ef4444', border: '#fecaca' },
    faculty: { bg: '#f5f3ff', text: '#8b5cf6', border: '#ddd6fe' },
    admin: { bg: '#fffbeb', text: '#f59e0b', border: '#fde68a' },
    coordinator: { bg: '#eff6ff', text: '#3b82f6', border: '#bfdbfe' },
    secretary: { bg: '#ecfeff', text: '#06b6d4', border: '#a5f3fc' },
    treasurer: { bg: '#ecfdf5', text: '#10b981', border: '#a7f3d0' },
    volunteer: { bg: '#eef2ff', text: '#6366f1', border: '#c7d2fe' },
    member: { bg: '#f8fafc', text: '#64748b', border: '#e2e8f0' },
};

function getIcon(iconField) {
    return ICON_MAP[iconField] || '🏢';
}

function getRoleBadge(role) {
    const colors = ROLE_COLORS[role] || ROLE_COLORS.member;
    return colors;
}

export default function CommitteeSelector() {
    const navigate = useNavigate();
    const { committees, loading, switchCommittee } = useCommittee();
    const [hoveredId, setHoveredId] = useState(null);
    const [selecting, setSelecting] = useState(false);

    const handleSelect = async (committee) => {
        if (selecting) return;
        setSelecting(true);
        const success = await switchCommittee(committee);
        if (success) {
            navigate('/dashboard');
        }
        setSelecting(false);
    };

    // Loading state
    if (loading) {
        return (
            <div style={styles.container}>
                <div style={styles.content}>
                    <div style={styles.spinner}></div>
                    <p style={styles.loadingText}>Loading your committees...</p>
                </div>
            </div>
        );
    }

    // Empty state
    if (committees.length === 0) {
        return (
            <div style={styles.container}>
                <div style={styles.content}>
                    <div style={styles.emptyIcon}>🏛️</div>
                    <h1 style={styles.emptyTitle}>No Committees Yet</h1>
                    <p style={styles.emptyText}>
                        You haven't been added to any committees yet.
                        Please contact your administrator to get added to a committee.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            <div style={styles.content}>
                <h1 style={styles.title}>Select Your Committee</h1>
                <p style={styles.subtitle}>Choose a committee workspace to continue</p>

                <div style={styles.grid}>
                    {committees.map((committee) => {
                        const isHovered = hoveredId === committee.id;
                        const roleColors = getRoleBadge(committee.role);

                        return (
                            <div
                                key={committee.id}
                                style={{
                                    ...styles.card,
                                    transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
                                    boxShadow: isHovered
                                        ? `0 20px 40px ${committee.color}30, 0 8px 16px rgba(0,0,0,0.1)`
                                        : '0 4px 12px rgba(0,0,0,0.08)',
                                    borderColor: isHovered ? committee.color : '#e5e7eb',
                                }}
                                onMouseEnter={() => setHoveredId(committee.id)}
                                onMouseLeave={() => setHoveredId(null)}
                                onClick={() => handleSelect(committee)}
                            >
                                <div style={styles.cardHeader}>
                                    <div style={{
                                        ...styles.iconCircle,
                                        backgroundColor: `${committee.color}15`,
                                        border: `2px solid ${committee.color}40`,
                                    }}>
                                        <span style={styles.iconEmoji}>{getIcon(committee.icon)}</span>
                                    </div>
                                    <div style={{
                                        ...styles.arrow,
                                        opacity: isHovered ? 1 : 0,
                                        transform: isHovered ? 'translateX(0)' : 'translateX(-8px)',
                                        color: committee.color,
                                    }}>
                                        →
                                    </div>
                                </div>

                                <h2 style={styles.cardName}>{committee.name}</h2>
                                <p style={styles.cardFullName}>{committee.fullName}</p>
                                {committee.description && (
                                    <p style={styles.cardDesc}>{committee.description}</p>
                                )}

                                <div style={styles.cardFooter}>
                                    <span style={{
                                        ...styles.roleBadge,
                                        backgroundColor: roleColors.bg,
                                        color: roleColors.text,
                                        border: `1px solid ${roleColors.border}`,
                                    }}>
                                        {committee.role}
                                    </span>
                                    <span style={styles.memberCount}>
                                        👥 {committee.memberCount} members
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

const styles = {
    container: {
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
        padding: '40px 20px',
    },
    content: {
        maxWidth: '900px',
        width: '100%',
        textAlign: 'center',
    },
    title: {
        fontSize: '32px',
        fontWeight: '700',
        color: '#ffffff',
        marginBottom: '8px',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
    subtitle: {
        fontSize: '16px',
        color: '#94a3b8',
        marginBottom: '40px',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 320px))',
        gap: '24px',
        justifyContent: 'center',
    },
    card: {
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        padding: '28px',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        border: '2px solid #e5e7eb',
        textAlign: 'left',
        position: 'relative',
    },
    cardHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '16px',
    },
    iconCircle: {
        width: '56px',
        height: '56px',
        borderRadius: '14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconEmoji: {
        fontSize: '28px',
    },
    arrow: {
        fontSize: '24px',
        fontWeight: '700',
        transition: 'all 0.3s ease',
    },
    cardName: {
        fontSize: '22px',
        fontWeight: '700',
        color: '#0f172a',
        marginBottom: '4px',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
    cardFullName: {
        fontSize: '13px',
        color: '#64748b',
        marginBottom: '8px',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
    cardDesc: {
        fontSize: '13px',
        color: '#94a3b8',
        lineHeight: '1.5',
        marginBottom: '16px',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
    cardFooter: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: '12px',
        paddingTop: '12px',
        borderTop: '1px solid #f1f5f9',
    },
    roleBadge: {
        fontSize: '12px',
        fontWeight: '600',
        padding: '4px 12px',
        borderRadius: '20px',
        textTransform: 'capitalize',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
    memberCount: {
        fontSize: '12px',
        color: '#94a3b8',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
    spinner: {
        width: '40px',
        height: '40px',
        border: '3px solid rgba(255,255,255,0.2)',
        borderTopColor: '#3b82f6',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
        margin: '0 auto 16px',
    },
    loadingText: {
        color: '#94a3b8',
        fontSize: '16px',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
    emptyIcon: {
        fontSize: '64px',
        marginBottom: '16px',
    },
    emptyTitle: {
        fontSize: '28px',
        fontWeight: '700',
        color: '#ffffff',
        marginBottom: '12px',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
    emptyText: {
        fontSize: '16px',
        color: '#94a3b8',
        maxWidth: '400px',
        margin: '0 auto',
        lineHeight: '1.6',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
};
