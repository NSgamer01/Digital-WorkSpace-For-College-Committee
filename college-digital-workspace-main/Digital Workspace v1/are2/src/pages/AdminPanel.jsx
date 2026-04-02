// ============================================
// pages/AdminPanel.jsx — Admin User Management
// ============================================
import React, { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import RoleBadge from '../components/RoleBadge';
import { ROLES, ROLE_LABELS, ROLE_HIERARCHY } from '../constants/roles';

// Global roles matching the DB CHECK constraint: superadmin, admin, user
const GLOBAL_ROLES = [
    { value: 'superadmin', label: 'Super Admin', color: '#ef4444', icon: '🔴' },
    { value: 'admin', label: 'Admin', color: '#f59e0b', icon: '🟡' },
    { value: 'user', label: 'User', color: '#6b7280', icon: '⚪' },
];

const AdminPanel = () => {
    const { user } = useAuth();
    const [users, setUsers] = useState([]);
    const [committees, setCommittees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [modal, setModal] = useState(null);
    const [selectedCommittee, setSelectedCommittee] = useState('');
    const [selectedRole, setSelectedRole] = useState('member');
    const [feedback, setFeedback] = useState(null);

    // Fetch users
    const fetchUsers = useCallback(async () => {
        try {
            setLoading(true);
            const data = await api.get('/api/admin/users', { search });
            setUsers(data.users || []);
        } catch (err) {
            console.error('Failed to fetch users:', err);
        } finally {
            setLoading(false);
        }
    }, [search]);

    // Fetch committees
    const fetchCommittees = useCallback(async () => {
        try {
            const data = await api.get('/api/admin/committees');
            setCommittees(data.committees || []);
        } catch (err) {
            console.error('Failed to fetch committees:', err);
        }
    }, []);

    useEffect(() => {
        fetchUsers();
        fetchCommittees();
    }, [fetchUsers, fetchCommittees]);

    // Show feedback toast
    const showFeedback = (message, type = 'success') => {
        setFeedback({ message, type });
        setTimeout(() => setFeedback(null), 3000);
    };

    // Add user to committee
    const handleAddToCommittee = async () => {
        if (!selectedCommittee || !modal?.userId) return;
        try {
            const data = await api.post(`/api/admin/users/${modal.userId}/committees`, {
                committeeId: selectedCommittee,
                role: selectedRole,
            });
            showFeedback(data.message);
            setModal(null);
            fetchUsers();
        } catch (err) {
            showFeedback(err.message, 'error');
        }
    };

    // Remove user from committee
    const handleRemoveFromCommittee = async (userId, committeeId, committeeName) => {
        if (!confirm(`Remove from ${committeeName}?`)) return;
        try {
            const data = await api.delete(`/api/admin/users/${userId}/committees/${committeeId}`);
            showFeedback(data.message);
            fetchUsers();
        } catch (err) {
            showFeedback(err.message, 'error');
        }
    };

    // Change global role
    const handleChangeGlobalRole = async (userId, newRole) => {
        try {
            const data = await api.patch(`/api/admin/users/${userId}/role`, { role: newRole });
            showFeedback(data.message);
            fetchUsers();
        } catch (err) {
            showFeedback(err.message, 'error');
        }
    };

    // Check admin access — allow both admin and superadmin
    if (user?.globalRole !== 'admin' && user?.globalRole !== 'superadmin') {
        return (
            <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', height: '60vh', textAlign: 'center',
            }}>
                <span style={{ fontSize: 64, marginBottom: 16 }}>🔒</span>
                <h2 style={{ color: 'var(--textPrimary)', fontSize: 20, fontWeight: 600 }}>Access Denied</h2>
                <p style={{ color: 'var(--textTertiary)', marginTop: 8 }}>Admin access required.</p>
            </div>
        );
    }

    // Filtered users
    const filteredUsers = users.filter(u =>
        !search || u.name?.toLowerCase().includes(search.toLowerCase()) ||
        u.email?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div style={{ maxWidth: 1100, margin: '0 auto', width: '100%' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
                <div>
                    <h1 style={{ color: 'var(--textPrimary)', fontSize: 24, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 28 }}>🛡️</span> Admin Panel
                    </h1>
                    <p style={{ color: 'var(--textTertiary)', fontSize: 14, marginTop: 4 }}>
                        Manage users and committee memberships
                    </p>
                </div>
                <div style={{ fontSize: 13, color: 'var(--textTertiary)', background: 'var(--bgSecondary)', padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)' }}>
                    {users.length} users registered
                </div>
            </div>

            {/* Search */}
            <div style={{ marginBottom: 20 }}>
                <div style={{ position: 'relative', maxWidth: 400 }}>
                    <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14 }}>🔍</span>
                    <input
                        type="text"
                        placeholder="Search users by name or email..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{
                            width: '100%', padding: '10px 12px 10px 36px', fontSize: 14,
                            background: 'var(--inputBg)', border: '1px solid var(--inputBorder)',
                            borderRadius: 10, color: 'var(--textPrimary)', outline: 'none',
                            boxSizing: 'border-box',
                        }}
                    />
                </div>
            </div>

            {/* Users Table */}
            <div style={{
                background: 'var(--bgSecondary)', border: '1px solid var(--border)',
                borderRadius: 12, overflow: 'hidden',
            }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                            <th style={thStyle}>User</th>
                            <th style={thStyle}>Global Role</th>
                            <th style={thStyle}>Committees</th>
                            <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="4" style={tdCenter}>Loading users...</td></tr>
                        ) : filteredUsers.length === 0 ? (
                            <tr><td colSpan="4" style={tdCenter}>No users found</td></tr>
                        ) : (
                            filteredUsers.map(u => (
                                <tr key={u.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}>
                                    {/* User info */}
                                    <td style={tdStyle}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <div style={{
                                                width: 36, height: 36, borderRadius: '50%',
                                                background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                color: 'white', fontWeight: 700, fontSize: 14, flexShrink: 0,
                                            }}>
                                                {u.name?.[0]?.toUpperCase() || '?'}
                                            </div>
                                            <div>
                                                <p style={{ color: 'var(--textPrimary)', fontWeight: 500, fontSize: 14, margin: 0 }}>
                                                    {u.name || 'Unnamed'}
                                                </p>
                                                <p style={{ color: 'var(--textTertiary)', fontSize: 12, margin: 0 }}>
                                                    {u.email}
                                                </p>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Global Role dropdown */}
                                    <td style={tdStyle}>
                                        <select
                                            value={u.globalRole || u.global_role || 'user'}
                                            onChange={e => handleChangeGlobalRole(u.id, e.target.value)}
                                            style={{
                                                background: 'var(--bgTertiary)', border: '1px solid var(--border)',
                                                borderRadius: 6, padding: '4px 8px', fontSize: 12,
                                                fontWeight: 600, cursor: 'pointer', outline: 'none',
                                                color: GLOBAL_ROLES.find(r => r.value === (u.globalRole || u.global_role || 'user'))?.color || 'var(--textPrimary)',
                                            }}
                                        >
                                            {GLOBAL_ROLES.map(r => (
                                                <option key={r.value} value={r.value}>
                                                    {r.icon} {r.label}
                                                </option>
                                            ))}
                                        </select>
                                    </td>

                                    {/* Committees */}
                                    <td style={tdStyle}>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                            {(!u.committees || u.committees.length === 0) ? (
                                                <span style={{ color: 'var(--textTertiary)', fontSize: 13 }}>None</span>
                                            ) : (
                                                u.committees.map(c => (
                                                    <span
                                                        key={c.committeeId}
                                                        style={{
                                                            display: 'inline-flex', alignItems: 'center', gap: 4,
                                                            padding: '3px 10px', borderRadius: 20,
                                                            fontSize: 11, fontWeight: 500,
                                                            background: `${c.color || '#3b82f6'}15`,
                                                            color: c.color || '#3b82f6',
                                                            border: `1px solid ${c.color || '#3b82f6'}30`,
                                                        }}
                                                    >
                                                        {c.committeeName}
                                                        <span style={{ opacity: 0.6, fontSize: 10 }}>({c.role})</span>
                                                        <button
                                                            onClick={() => handleRemoveFromCommittee(u.id, c.committeeId, c.committeeName)}
                                                            style={{
                                                                background: 'none', border: 'none', cursor: 'pointer',
                                                                color: 'inherit', fontSize: 11, padding: '0 0 0 2px',
                                                                opacity: 0.6,
                                                            }}
                                                            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                                                            onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}
                                                            title="Remove from committee"
                                                        >✕</button>
                                                    </span>
                                                ))
                                            )}
                                        </div>
                                    </td>

                                    {/* Actions */}
                                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                                        <button
                                            onClick={() => {
                                                setModal({ type: 'addCommittee', userId: u.id, userName: u.name });
                                                setSelectedCommittee('');
                                                setSelectedRole('member');
                                            }}
                                            style={{
                                                padding: '6px 14px', fontSize: 12, fontWeight: 600,
                                                background: 'var(--accent)', color: 'white',
                                                border: 'none', borderRadius: 8, cursor: 'pointer',
                                                transition: 'opacity 0.15s',
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                                            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                                        >
                                            + Committee
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Add to Committee Modal */}
            {modal?.type === 'addCommittee' && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 50,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
                }}>
                    <div
                        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
                        onClick={() => setModal(null)}
                    />
                    <div style={{
                        position: 'relative', width: '100%', maxWidth: 440,
                        background: 'var(--cardBg)', border: '1px solid var(--border)',
                        borderRadius: 16, boxShadow: '0 25px 50px rgba(0,0,0,0.3)', padding: 24,
                    }}>
                        <h3 style={{ color: 'var(--textPrimary)', fontSize: 18, fontWeight: 600, marginBottom: 4 }}>
                            Add to Committee
                        </h3>
                        <p style={{ color: 'var(--textTertiary)', fontSize: 13, marginBottom: 20 }}>
                            Adding <span style={{ color: 'var(--textPrimary)', fontWeight: 500 }}>{modal.userName}</span> to a committee
                        </p>

                        {/* Committee select */}
                        <div style={{ marginBottom: 14 }}>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--textSecondary)', marginBottom: 6 }}>Committee</label>
                            <select
                                value={selectedCommittee}
                                onChange={e => setSelectedCommittee(e.target.value)}
                                style={{
                                    width: '100%', padding: '8px 12px', fontSize: 14,
                                    background: 'var(--inputBg)', border: '1px solid var(--inputBorder)',
                                    borderRadius: 8, color: 'var(--textPrimary)', outline: 'none',
                                    boxSizing: 'border-box',
                                }}
                            >
                                <option value="">Select committee...</option>
                                {committees.map(c => (
                                    <option key={c.id} value={c.id}>{c.name} ({c.slug})</option>
                                ))}
                            </select>
                        </div>

                        {/* Role select — uses all 8 committee roles from roles.js */}
                        <div style={{ marginBottom: 20 }}>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--textSecondary)', marginBottom: 6 }}>Role</label>
                            <select
                                value={selectedRole}
                                onChange={e => setSelectedRole(e.target.value)}
                                style={{
                                    width: '100%', padding: '8px 12px', fontSize: 14,
                                    background: 'var(--inputBg)', border: '1px solid var(--inputBorder)',
                                    borderRadius: 8, color: 'var(--textPrimary)', outline: 'none',
                                    boxSizing: 'border-box',
                                }}
                            >
                                {ROLE_HIERARCHY.map(r => (
                                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                                ))}
                            </select>
                        </div>

                        {/* Preview badge */}
                        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 12, color: 'var(--textTertiary)' }}>Preview:</span>
                            <RoleBadge role={selectedRole} size="medium" />
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setModal(null)}
                                style={{
                                    padding: '8px 16px', fontSize: 13, fontWeight: 500,
                                    background: 'var(--bgTertiary)', color: 'var(--textSecondary)',
                                    border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer',
                                }}
                            >Cancel</button>
                            <button
                                onClick={handleAddToCommittee}
                                disabled={!selectedCommittee}
                                style={{
                                    padding: '8px 16px', fontSize: 13, fontWeight: 600,
                                    background: selectedCommittee ? 'var(--accent)' : 'var(--bgTertiary)',
                                    color: selectedCommittee ? 'white' : 'var(--textTertiary)',
                                    border: 'none', borderRadius: 8,
                                    cursor: selectedCommittee ? 'pointer' : 'not-allowed',
                                }}
                            >Add Member</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Feedback Toast */}
            {feedback && (
                <div style={{
                    position: 'fixed', bottom: 24, right: 24, zIndex: 1000,
                    padding: '10px 20px', borderRadius: 10,
                    background: feedback.type === 'error' ? '#ef4444' : '#22c55e',
                    color: 'white', fontSize: 14, fontWeight: 500,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                }}>
                    {feedback.message}
                </div>
            )}
        </div>
    );
};

// ── Table cell styles ──
const thStyle = {
    textAlign: 'left', padding: '12px 20px',
    fontSize: 12, fontWeight: 600, color: 'var(--textTertiary)',
    textTransform: 'uppercase', letterSpacing: '0.5px',
};
const tdStyle = {
    padding: '12px 20px', verticalAlign: 'middle',
};
const tdCenter = {
    padding: '40px 20px', textAlign: 'center', color: 'var(--textTertiary)',
};

export default AdminPanel;
