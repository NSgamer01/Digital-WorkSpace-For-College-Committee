import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { useCommittee } from '../contexts/CommitteeContext';
import { createTask } from '../services/taskService';
import DatePickerModal from '../components/DatePickerModal';
import RoleBadge from '../components/RoleBadge';
import { ROLES, ROLE_LABELS, ROLE_COLORS, ROLE_HIERARCHY, hasPermission } from '../constants/roles';

// ── Role section config for grouped display ────────────────
const ROLE_SECTIONS = ROLE_HIERARCHY.map(roleKey => ({
    key: roleKey,
    label: ROLE_LABELS[roleKey] + 's',
    icon: roleKey === 'head' ? '👑' : roleKey === 'faculty' ? '🎓' :
          roleKey === 'admin' ? '🛡️' : roleKey === 'coordinator' ? '📋' :
          roleKey === 'secretary' ? '📝' : roleKey === 'treasurer' ? '💰' :
          roleKey === 'volunteer' ? '🙋' : '👥',
    color: ROLE_COLORS[roleKey],
}));

// ── Avatar gradient palette ─────────────────────────────────
const avatarGradients = [
    'linear-gradient(135deg, #3b82f6, #06b6d4)',
    'linear-gradient(135deg, #8b5cf6, #ec4899)',
    'linear-gradient(135deg, #10b981, #14b8a6)',
    'linear-gradient(135deg, #f59e0b, #f97316)',
    'linear-gradient(135deg, #6366f1, #8b5cf6)',
    'linear-gradient(135deg, #ef4444, #f97316)',
    'linear-gradient(135deg, #06b6d4, #3b82f6)',
];

// ── Helper: generate initials ───────────────────────────────
function getInitials(name) {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

// ── Sub-components ──────────────────────────────────────────

/* ─── Loading Skeleton ─── */
const SkeletonCard = () => (
    <div style={{
        background: 'var(--bgSecondary)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
    }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--bgTertiary)', animation: 'pulse 1.5s infinite' }} />
        <div style={{ flex: 1 }}>
            <div style={{ height: 14, width: '40%', borderRadius: 6, background: 'var(--bgTertiary)', marginBottom: 8, animation: 'pulse 1.5s infinite' }} />
            <div style={{ height: 10, width: '30%', borderRadius: 6, background: 'var(--bgTertiary)', animation: 'pulse 1.5s infinite' }} />
        </div>
        <div style={{ width: 80, height: 28, borderRadius: 8, background: 'var(--bgTertiary)', animation: 'pulse 1.5s infinite' }} />
    </div>
);

/* ─── Empty State ─── */
const EmptyState = () => (
    <div style={{
        background: 'var(--bgSecondary)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 24px',
        textAlign: 'center',
    }}>
        <div style={{
            width: 80, height: 80, borderRadius: '20px',
            background: 'var(--bgTertiary)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 20, fontSize: 40, opacity: 0.4,
        }}>👥</div>
        <h3 style={{ color: 'var(--textPrimary)', fontWeight: 600, fontSize: 18, marginBottom: 8 }}>
            No members found
        </h3>
        <p style={{ color: 'var(--textTertiary)', fontSize: 14, maxWidth: 280, lineHeight: 1.6 }}>
            Invite members to get started collaborating with your workspace.
        </p>
    </div>
);

/* ─── Member Card ─── */
const MemberCard = ({ member, index, onMessage, onAddTask, canChangeRole, currentUserId, onRoleChange }) => {
    const gradient = avatarGradients[index % avatarGradients.length];
    const [hovered, setHovered] = useState(false);
    const [roleChanging, setRoleChanging] = useState(false);
    const isCurrentUser = member.id === currentUserId;

    const handleRoleChange = async (e) => {
        const newRole = e.target.value;
        if (newRole === member.role) return;
        setRoleChanging(true);
        try {
            await onRoleChange(member.id, newRole);
        } finally {
            setRoleChanging(false);
        }
    };

    return (
        <div
            style={{
                background: hovered ? 'var(--bgHover)' : 'var(--bgSecondary)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '14px 20px',
                transition: 'all 0.2s ease',
                cursor: 'default',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                transform: hovered ? 'translateY(-1px)' : 'none',
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            {/* Avatar */}
            <div style={{
                width: 44, height: 44, borderRadius: '50%',
                background: gradient,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontWeight: 700, fontSize: 14,
                flexShrink: 0,
            }}>
                {member.initials}
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span style={{
                        color: 'var(--textPrimary)', fontWeight: 600, fontSize: 14,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                        {member.name}
                    </span>
                    {isCurrentUser && (
                        <span style={{
                            fontSize: 10, padding: '1px 6px', borderRadius: 6,
                            background: 'var(--accentLight)', color: 'var(--accent)',
                            fontWeight: 600,
                        }}>You</span>
                    )}
                </div>
                <p style={{ color: 'var(--textTertiary)', fontSize: 12, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {member.email}
                </p>
                {member.position && (
                    <p style={{ color: 'var(--textSecondary)', fontSize: 11, margin: '2px 0 0', fontStyle: 'italic' }}>
                        {member.position}
                    </p>
                )}
            </div>

            {/* Role Badge or Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                {canChangeRole && !isCurrentUser ? (
                    <select
                        value={member.role}
                        onChange={handleRoleChange}
                        disabled={roleChanging}
                        style={{
                            background: 'var(--bgTertiary)',
                            border: '1px solid var(--border)',
                            borderRadius: 8,
                            padding: '4px 8px',
                            color: ROLE_COLORS[member.role] || 'var(--textPrimary)',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: roleChanging ? 'wait' : 'pointer',
                            outline: 'none',
                            opacity: roleChanging ? 0.6 : 1,
                            minWidth: 110,
                        }}
                    >
                        {ROLE_HIERARCHY.map(r => (
                            <option key={r} value={r} style={{ color: ROLE_COLORS[r] }}>
                                {ROLE_LABELS[r]}
                            </option>
                        ))}
                    </select>
                ) : (
                    <RoleBadge role={member.role} size="small" />
                )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <button
                    onClick={(e) => { e.stopPropagation(); onMessage(member.id); }}
                    style={{
                        padding: '6px 10px', fontSize: 12, fontWeight: 500,
                        borderRadius: 8, border: '1px solid var(--border)',
                        background: 'var(--bgTertiary)', color: 'var(--textSecondary)',
                        cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--textSecondary)'; }}
                >
                    📨 Message
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); onAddTask(member); }}
                    style={{
                        padding: '6px 10px', fontSize: 12, fontWeight: 500,
                        borderRadius: 8, border: '1px solid var(--border)',
                        background: 'var(--bgTertiary)', color: 'var(--textSecondary)',
                        cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#8b5cf6'; e.currentTarget.style.color = '#8b5cf6'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--textSecondary)'; }}
                >
                    📌 Task
                </button>
            </div>
        </div>
    );
};

/* ─── Create Task Modal ─── */
const CreateTaskModal = ({ isOpen, onClose, member }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [priority, setPriority] = useState('medium');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);

    if (!isOpen || !member) return null;

    const handleSubmit = async () => {
        if (!title.trim() || isSubmitting) return;
        setIsSubmitting(true);
        try {
            await createTask({
                title: title.trim(),
                description: description.trim(),
                dueDate: dueDate ? new Date(dueDate) : '',
                assignedTo: member.id,
                assignedToName: member.name,
                priority,
            }, member.id);
            setTitle(''); setDescription(''); setDueDate(''); setPriority('medium');
            onClose();
        } catch (error) {
            console.error('❌ Error creating task:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCancel = () => {
        setTitle(''); setDescription(''); setDueDate(''); setPriority('medium');
        onClose();
    };

    const priorityOptions = [
        { value: 'low', label: 'Low', color: '#22c55e' },
        { value: 'medium', label: 'Medium', color: '#eab308' },
        { value: 'high', label: 'High', color: '#ef4444' },
    ];

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
            <div style={{
                position: 'absolute', inset: 0,
                background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            }} onClick={handleCancel} />

            <div style={{
                position: 'relative', width: '100%', maxWidth: 480,
                background: 'var(--cardBg)', border: '1px solid var(--border)',
                borderRadius: 16, boxShadow: '0 25px 50px rgba(0,0,0,0.3)',
                overflow: 'hidden',
            }}>
                {/* Header */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '16px 20px', borderBottom: '1px solid var(--border)',
                }}>
                    <div>
                        <h3 style={{ color: 'var(--textPrimary)', fontWeight: 600, fontSize: 16, margin: 0 }}>Create Task</h3>
                        <p style={{ color: 'var(--textTertiary)', fontSize: 12, margin: '2px 0 0' }}>
                            Assigned to: <span style={{ color: '#8b5cf6', fontWeight: 500 }}>{member.name}</span>
                        </p>
                    </div>
                    <button onClick={handleCancel} style={{
                        width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        borderRadius: 8, border: 'none', background: 'var(--bgTertiary)',
                        color: 'var(--textTertiary)', cursor: 'pointer', fontSize: 14,
                    }}>✕</button>
                </div>

                {/* Form */}
                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--textSecondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
                            Task Title <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <input
                            type="text" value={title} onChange={e => setTitle(e.target.value)}
                            placeholder="Enter task title..."
                            style={{
                                width: '100%', padding: '8px 12px', fontSize: 14,
                                background: 'var(--inputBg)', border: '1px solid var(--inputBorder)',
                                borderRadius: 8, color: 'var(--textPrimary)', outline: 'none',
                                boxSizing: 'border-box',
                            }}
                            autoFocus
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--textSecondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
                            Description
                        </label>
                        <textarea
                            value={description} onChange={e => setDescription(e.target.value)}
                            placeholder="Add details about this task..."
                            rows={3}
                            style={{
                                width: '100%', padding: '8px 12px', fontSize: 14,
                                background: 'var(--inputBg)', border: '1px solid var(--inputBorder)',
                                borderRadius: 8, color: 'var(--textPrimary)', outline: 'none',
                                resize: 'none', boxSizing: 'border-box',
                            }}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--textSecondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
                            Due Date
                        </label>
                        <button
                            type="button" onClick={() => setShowDatePicker(true)}
                            style={{
                                width: '100%', padding: '8px 12px', fontSize: 14,
                                background: 'var(--inputBg)', border: '1px solid var(--inputBorder)',
                                borderRadius: 8, color: 'var(--textSecondary)', textAlign: 'left',
                                cursor: 'pointer',
                            }}
                        >
                            📅 {dueDate ? new Date(dueDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Select date'}
                        </button>
                        {showDatePicker && (
                            <DatePickerModal
                                value={dueDate}
                                onConfirm={d => { setDueDate(d); setShowDatePicker(false); }}
                                onClose={() => setShowDatePicker(false)}
                            />
                        )}
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--textSecondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
                            Priority
                        </label>
                        <div style={{ display: 'flex', gap: 8 }}>
                            {priorityOptions.map(opt => (
                                <button
                                    key={opt.value} onClick={() => setPriority(opt.value)}
                                    style={{
                                        flex: 1, padding: '8px', fontSize: 12, fontWeight: 600,
                                        borderRadius: 8, cursor: 'pointer',
                                        border: priority === opt.value ? `2px solid ${opt.color}` : '1px solid var(--border)',
                                        background: priority === opt.value ? `${opt.color}15` : 'var(--bgTertiary)',
                                        color: priority === opt.value ? opt.color : 'var(--textTertiary)',
                                        transition: 'all 0.15s',
                                    }}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10,
                    padding: '12px 20px', borderTop: '1px solid var(--border)',
                }}>
                    <button onClick={handleCancel} style={{
                        padding: '8px 16px', fontSize: 13, fontWeight: 500,
                        background: 'var(--bgTertiary)', color: 'var(--textSecondary)',
                        border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer',
                    }}>Cancel</button>
                    <button onClick={handleSubmit} disabled={!title.trim() || isSubmitting} style={{
                        padding: '8px 16px', fontSize: 13, fontWeight: 600,
                        background: title.trim() && !isSubmitting ? 'var(--accent)' : 'var(--bgTertiary)',
                        color: title.trim() && !isSubmitting ? 'white' : 'var(--textTertiary)',
                        border: 'none', borderRadius: 8,
                        cursor: title.trim() && !isSubmitting ? 'pointer' : 'not-allowed',
                        opacity: title.trim() && !isSubmitting ? 1 : 0.5,
                    }}>
                        {isSubmitting ? 'Creating...' : 'Create Task'}
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
            `}</style>
        </div>
    );
};


// ═══════════════════════════════════════════════════════════════════
//  MAIN MEMBERS PAGE
// ═══════════════════════════════════════════════════════════════════
const Members = () => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const { currentCommittee, committeeRole } = useCommittee();
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [feedback, setFeedback] = useState(null);

    // Can current user change roles?
    const canChangeRole = hasPermission(committeeRole, 'canAssignRoles');

    // ── Fetch members from backend API ───────────────────────────
    const fetchMembers = useCallback(async () => {
        try {
            const data = await api.get('/api/committees/members');
            const raw = (data.members || []).map(m => {
                const name = m.name || m.email || 'Unknown';
                return {
                    id: m.user_id || m.id,
                    name,
                    email: m.email || '',
                    role: (m.role || 'member').toLowerCase(),
                    position: m.position || '',
                    initials: getInitials(name),
                    joinedAt: m.joined_at || m.created_at || null,
                };
            });
            setMembers(raw);
            setLoading(false);
        } catch (error) {
            console.error('❌ Error fetching members:', error);
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchMembers();
        const interval = setInterval(fetchMembers, 30000);
        return () => clearInterval(interval);
    }, [fetchMembers, currentCommittee?.slug]);

    // ── Role change handler ──
    const handleRoleChange = useCallback(async (userId, newRole) => {
        if (!currentCommittee?.slug) return;
        try {
            await api.patch(`/api/committees/${currentCommittee.slug}/members/${userId}`, { role: newRole });
            setFeedback({ message: `Role updated to ${ROLE_LABELS[newRole]}`, type: 'success' });
            setTimeout(() => setFeedback(null), 3000);
            fetchMembers();
        } catch (err) {
            console.error('Role change error:', err);
            setFeedback({ message: err.message || 'Failed to update role', type: 'error' });
            setTimeout(() => setFeedback(null), 3000);
        }
    }, [currentCommittee?.slug, fetchMembers]);

    // ── Task modal state ──
    const [showTaskModal, setShowTaskModal] = useState(false);
    const [selectedMemberForTask, setSelectedMemberForTask] = useState(null);

    // ── Action handlers ──
    const handleMessage = (memberId) => navigate(`/messages?memberId=${memberId}`);
    const handleAddTask = (member) => {
        setSelectedMemberForTask(member);
        setShowTaskModal(true);
    };

    // ── Filter members ──
    const filteredMembers = useMemo(() => {
        return members.filter(m =>
            m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            m.email.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [members, searchQuery]);

    // ── Role distribution stats ──
    const roleStats = useMemo(() => {
        const stats = {};
        members.forEach(m => {
            const r = m.role || 'member';
            stats[r] = (stats[r] || 0) + 1;
        });
        return stats;
    }, [members]);

    return (
        <div>
            {/* ── Page Header ── */}
            <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <h1 style={{ color: 'var(--textPrimary)', fontSize: 28, fontWeight: 700, margin: 0 }}>
                            Members
                        </h1>
                        <p style={{ color: 'var(--textTertiary)', fontSize: 14, marginTop: 4 }}>
                            {currentCommittee?.name || 'Committee'} · {members.length} member{members.length !== 1 ? 's' : ''}
                        </p>
                    </div>
                    {/* Role stats pills */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {ROLE_HIERARCHY.filter(r => roleStats[r]).map(r => (
                            <span key={r} style={{
                                fontSize: 11, fontWeight: 600, padding: '3px 10px',
                                borderRadius: 20, background: `${ROLE_COLORS[r]}15`,
                                color: ROLE_COLORS[r], border: `1px solid ${ROLE_COLORS[r]}25`,
                            }}>
                                {roleStats[r]} {ROLE_LABELS[r]}{roleStats[r] > 1 ? 's' : ''}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Search ── */}
            <div style={{ marginBottom: 20 }}>
                <div style={{ position: 'relative', maxWidth: 400 }}>
                    <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'var(--textTertiary)' }}>🔍</span>
                    <input
                        type="text"
                        placeholder="Search members..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        style={{
                            width: '100%', padding: '10px 12px 10px 36px', fontSize: 14,
                            background: 'var(--bgSecondary)', border: '1px solid var(--border)',
                            borderRadius: 10, color: 'var(--textPrimary)', outline: 'none',
                            boxSizing: 'border-box',
                        }}
                    />
                </div>
            </div>

            {/* ── Members List (grouped by role hierarchy) ── */}
            {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[...Array(5)].map((_, i) => <SkeletonCard key={i} />)}
                </div>
            ) : filteredMembers.length === 0 ? (
                <EmptyState />
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    {ROLE_SECTIONS.map(section => {
                        const sectionMembers = filteredMembers.filter(
                            m => m.role === section.key
                        );
                        if (sectionMembers.length === 0) return null;
                        return (
                            <div key={section.key}>
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    marginBottom: 10, paddingBottom: 6,
                                    borderBottom: `2px solid ${section.color}20`,
                                }}>
                                    <span style={{ fontSize: 16 }}>{section.icon}</span>
                                    <h3 style={{
                                        fontSize: 13, fontWeight: 700, color: section.color,
                                        textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0,
                                    }}>
                                        {section.label}
                                    </h3>
                                    <span style={{
                                        fontSize: 11, color: 'var(--textTertiary)',
                                        background: 'var(--bgTertiary)',
                                        padding: '1px 8px', borderRadius: 10,
                                    }}>
                                        {sectionMembers.length}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {sectionMembers.map((member, idx) => (
                                        <MemberCard
                                            key={member.id}
                                            member={member}
                                            index={idx}
                                            onMessage={handleMessage}
                                            onAddTask={handleAddTask}
                                            canChangeRole={canChangeRole}
                                            currentUserId={currentUser?.id}
                                            onRoleChange={handleRoleChange}
                                        />
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                    {/* Members with unrecognized roles */}
                    {(() => {
                        const otherMembers = filteredMembers.filter(m => !ROLE_HIERARCHY.includes(m.role));
                        if (otherMembers.length === 0) return null;
                        return (
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, paddingBottom: 6, borderBottom: '2px solid var(--border)' }}>
                                    <span style={{ fontSize: 16 }}>👥</span>
                                    <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--textTertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>Other</h3>
                                    <span style={{ fontSize: 11, color: 'var(--textTertiary)', background: 'var(--bgTertiary)', padding: '1px 8px', borderRadius: 10 }}>{otherMembers.length}</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {otherMembers.map((member, idx) => (
                                        <MemberCard key={member.id} member={member} index={idx} onMessage={handleMessage} onAddTask={handleAddTask} canChangeRole={canChangeRole} currentUserId={currentUser?.id} onRoleChange={handleRoleChange} />
                                    ))}
                                </div>
                            </div>
                        );
                    })()}
                </div>
            )}

            {/* ── Create Task Modal ── */}
            <CreateTaskModal
                isOpen={showTaskModal}
                onClose={() => { setShowTaskModal(false); setSelectedMemberForTask(null); }}
                member={selectedMemberForTask}
            />

            {/* ── Feedback Toast ── */}
            {feedback && (
                <div style={{
                    position: 'fixed', bottom: 24, right: 24, zIndex: 1000,
                    padding: '10px 20px', borderRadius: 10,
                    background: feedback.type === 'error' ? '#ef4444' : '#22c55e',
                    color: 'white', fontSize: 14, fontWeight: 500,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                    animation: 'fadeIn 0.2s ease',
                }}>
                    {feedback.message}
                </div>
            )}

            <style>{`
                @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
            `}</style>
        </div>
    );
};

export default Members;
