// ============================================
// src/components/CommitteeSwitcher.jsx
// ============================================
// Header dropdown for switching between committees.
// Styled with the current committee's color.
// All inline styles, no external CSS.
// ============================================

import React, { useState, useRef, useEffect } from 'react';
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

function getIcon(iconField) {
    return ICON_MAP[iconField] || '🏢';
}

export default function CommitteeSwitcher() {
    const navigate = useNavigate();
    const { committees, currentCommittee, committeeRole, switchCommittee } = useCommittee();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (!currentCommittee) return null;

    const color = currentCommittee.color || '#3b82f6';

    const handleSwitch = async (committee) => {
        if (committee.slug === currentCommittee.slug) {
            setIsOpen(false);
            return;
        }
        const success = await switchCommittee(committee);
        if (success) {
            setIsOpen(false);
            navigate('/dashboard');
            window.location.reload();
        }
    };

    return (
        <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 14px',
                    border: `2px solid ${color}`,
                    borderRadius: '10px',
                    backgroundColor: `${color}10`,
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#1e293b',
                    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                    transition: 'all 0.2s ease',
                    outline: 'none',
                }}
            >
                <span style={{ fontSize: '18px' }}>
                    {getIcon(currentCommittee.icon)}
                </span>
                <span>{currentCommittee.name}</span>
                <span style={{
                    fontSize: '10px',
                    marginLeft: '2px',
                    transition: 'transform 0.2s ease',
                    transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                }}>
                    ▼
                </span>
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    left: '0',
                    minWidth: '280px',
                    backgroundColor: '#ffffff',
                    borderRadius: '12px',
                    boxShadow: '0 12px 40px rgba(0,0,0,0.15), 0 4px 12px rgba(0,0,0,0.08)',
                    border: '1px solid #e5e7eb',
                    zIndex: 1000,
                    overflow: 'hidden',
                }}>
                    {/* Header */}
                    <div style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid #f1f5f9',
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#94a3b8',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                    }}>
                        Switch Committee
                    </div>

                    {/* Committee List */}
                    <div style={{ padding: '6px 0' }}>
                        {committees.map((committee) => {
                            const isActive = committee.slug === currentCommittee.slug;

                            return (
                                <div
                                    key={committee.id}
                                    onClick={() => handleSwitch(committee)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        padding: '10px 16px',
                                        cursor: 'pointer',
                                        backgroundColor: isActive ? '#f8fafc' : 'transparent',
                                        borderLeft: `3px solid ${isActive ? committee.color : 'transparent'}`,
                                        transition: 'all 0.15s ease',
                                        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!isActive) {
                                            e.currentTarget.style.backgroundColor = '#f8fafc';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!isActive) {
                                            e.currentTarget.style.backgroundColor = 'transparent';
                                        }
                                    }}
                                >
                                    <span style={{ fontSize: '20px', lineHeight: 1 }}>
                                        {getIcon(committee.icon)}
                                    </span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{
                                            fontSize: '14px',
                                            fontWeight: '600',
                                            color: '#1e293b',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                        }}>
                                            {committee.name}
                                        </div>
                                        <div style={{
                                            fontSize: '11px',
                                            color: '#94a3b8',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                        }}>
                                            {committee.fullName}
                                        </div>
                                    </div>
                                    {isActive && (
                                        <span style={{
                                            color: committee.color,
                                            fontSize: '16px',
                                            fontWeight: '700',
                                        }}>
                                            ✓
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
