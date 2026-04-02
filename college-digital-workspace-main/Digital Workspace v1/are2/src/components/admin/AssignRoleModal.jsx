// ============================================
// src/components/admin/AssignRoleModal.jsx
// ============================================
// Modal to assign a new role to a user.
// Shows current user info and 4 selectable role cards.
// ============================================

import React, { useState } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { ROLES, ROLE_LABELS, ROLE_COLORS, ROLE_PERMISSIONS } from '../../constants/roles';

const roleOptions = [
    { key: ROLES.ADMIN, description: 'Full access to all features' },
    { key: ROLES.FACULTY, description: 'Can create announcements, tasks & events' },
    { key: ROLES.HEAD, description: 'Manages committee members & content' },
    { key: ROLES.MEMBER, description: 'Basic access to workspace features' },
];

const AssignRoleModal = ({ user, onClose, onUpdate }) => {
    const [selectedRole, setSelectedRole] = useState(user?.role || ROLES.MEMBER);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    if (!user) return null;

    const handleSave = async () => {
        if (selectedRole === user.role) {
            onClose();
            return;
        }

        setSaving(true);
        setError('');

        try {
            const userRef = doc(db, 'users', user.uid || user.id);
            await updateDoc(userRef, {
                role: selectedRole,
                updatedAt: serverTimestamp(),
            });

            if (onUpdate) {
                onUpdate({ ...user, role: selectedRole });
            }
            onClose();
        } catch (err) {
            console.error('❌ Failed to update role:', err);
            setError('Failed to update role. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const getInitials = (name) => {
        if (!name) return '?';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    return (
        <div className="assign-role-overlay" onClick={onClose}>
            <div className="assign-role-modal" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="assign-role-header">
                    <h2>Assign Role</h2>
                    <button className="assign-role-close" onClick={onClose}>✕</button>
                </div>

                {/* User Info */}
                <div className="assign-role-user-info">
                    <div
                        className="assign-role-avatar"
                        style={{ background: ROLE_COLORS[user.role] || '#6b7280' }}
                    >
                        {user.photoURL ? (
                            <img src={user.photoURL} alt={user.displayName} />
                        ) : (
                            getInitials(user.displayName || user.name)
                        )}
                    </div>
                    <div>
                        <p className="assign-role-name">{user.displayName || user.name}</p>
                        <p className="assign-role-email">{user.email}</p>
                        <span
                            className="assign-role-current-badge"
                            style={{ background: `${ROLE_COLORS[user.role]}20`, color: ROLE_COLORS[user.role] }}
                        >
                            Current: {ROLE_LABELS[user.role] || user.role}
                        </span>
                    </div>
                </div>

                {/* Role Options */}
                <div className="assign-role-options">
                    <p className="assign-role-section-label">Select New Role</p>
                    {roleOptions.map((option) => {
                        const isSelected = selectedRole === option.key;
                        const color = ROLE_COLORS[option.key];

                        return (
                            <button
                                key={option.key}
                                className={`assign-role-card ${isSelected ? 'selected' : ''}`}
                                onClick={() => setSelectedRole(option.key)}
                                style={{
                                    borderColor: isSelected ? color : 'transparent',
                                    background: isSelected ? `${color}10` : undefined,
                                }}
                            >
                                <div
                                    className="assign-role-indicator"
                                    style={{ background: color }}
                                />
                                <div className="assign-role-card-content">
                                    <span className="assign-role-card-label">{ROLE_LABELS[option.key]}</span>
                                    <span className="assign-role-card-desc">{option.description}</span>
                                </div>
                                {isSelected && (
                                    <span className="assign-role-check" style={{ color }}>✓</span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Error */}
                {error && <p className="assign-role-error">{error}</p>}

                {/* Actions */}
                <div className="assign-role-actions">
                    <button className="assign-role-btn-cancel" onClick={onClose} disabled={saving}>
                        Cancel
                    </button>
                    <button
                        className="assign-role-btn-save"
                        onClick={handleSave}
                        disabled={saving || selectedRole === user.role}
                        style={{
                            background: selectedRole !== user.role ? ROLE_COLORS[selectedRole] : undefined,
                        }}
                    >
                        {saving ? 'Saving...' : 'Assign Role'}
                    </button>
                </div>
            </div>

            <style>{`
                .assign-role-overlay {
                    position: fixed; inset: 0; z-index: 9999;
                    background: rgba(0,0,0,0.7); backdrop-filter: blur(4px);
                    display: flex; align-items: center; justify-content: center;
                    animation: fadeIn 0.2s ease-out;
                }
                .assign-role-modal {
                    background: var(--bgSecondary, #18181b); border: 1px solid var(--border, #27272a);
                    border-radius: 16px; width: 440px; max-width: 95vw; padding: 24px;
                    box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
                    animation: slideUp 0.3s ease-out;
                }
                .assign-role-header {
                    display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;
                }
                .assign-role-header h2 {
                    color: var(--textPrimary, #fff); font-size: 18px; font-weight: 600; margin: 0;
                }
                .assign-role-close {
                    background: none; border: none; color: var(--textSecondary, #a1a1aa);
                    font-size: 18px; cursor: pointer; padding: 4px 8px; border-radius: 6px;
                }
                .assign-role-close:hover { background: var(--bgHover, #27272a); color: var(--textPrimary, #fff); }
                .assign-role-user-info {
                    display: flex; align-items: center; gap: 14px;
                    padding: 16px; background: var(--bgTertiary, #09090b);
                    border-radius: 12px; margin-bottom: 20px;
                }
                .assign-role-avatar {
                    width: 48px; height: 48px; border-radius: 50%;
                    display: flex; align-items: center; justify-content: center;
                    color: #fff; font-weight: 700; font-size: 16px; flex-shrink: 0; overflow: hidden;
                }
                .assign-role-avatar img { width: 100%; height: 100%; object-fit: cover; }
                .assign-role-name { color: var(--textPrimary, #fff); font-weight: 600; font-size: 15px; margin: 0; }
                .assign-role-email { color: var(--textSecondary, #a1a1aa); font-size: 13px; margin: 2px 0 6px; }
                .assign-role-current-badge {
                    font-size: 11px; font-weight: 600; padding: 2px 8px;
                    border-radius: 10px; display: inline-block;
                }
                .assign-role-section-label {
                    color: var(--textSecondary, #a1a1aa); font-size: 12px;
                    font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 10px;
                }
                .assign-role-options { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; }
                .assign-role-card {
                    display: flex; align-items: center; gap: 12px; padding: 14px 16px;
                    border-radius: 10px; border: 2px solid transparent; cursor: pointer;
                    background: var(--bgTertiary, #09090b); transition: all 0.2s ease;
                    text-align: left; width: 100%;
                }
                .assign-role-card:hover { border-color: var(--border, #27272a); }
                .assign-role-indicator {
                    width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0;
                }
                .assign-role-card-content { flex: 1; display: flex; flex-direction: column; gap: 2px; }
                .assign-role-card-label { color: var(--textPrimary, #fff); font-weight: 600; font-size: 14px; }
                .assign-role-card-desc { color: var(--textSecondary, #a1a1aa); font-size: 12px; }
                .assign-role-check { font-size: 18px; font-weight: 700; }
                .assign-role-error {
                    color: #ef4444; font-size: 13px; padding: 8px 12px;
                    background: #ef444415; border-radius: 8px; margin-bottom: 16px;
                }
                .assign-role-actions { display: flex; gap: 10px; justify-content: flex-end; }
                .assign-role-btn-cancel {
                    padding: 10px 20px; border-radius: 8px; border: 1px solid var(--border, #27272a);
                    background: transparent; color: var(--textSecondary, #a1a1aa);
                    font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s;
                }
                .assign-role-btn-cancel:hover { background: var(--bgHover, #27272a); color: var(--textPrimary, #fff); }
                .assign-role-btn-save {
                    padding: 10px 24px; border-radius: 8px; border: none;
                    background: #6366f1; color: #fff;
                    font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s;
                }
                .assign-role-btn-save:hover { filter: brightness(1.1); transform: translateY(-1px); }
                .assign-role-btn-save:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </div>
    );
};

export default AssignRoleModal;
