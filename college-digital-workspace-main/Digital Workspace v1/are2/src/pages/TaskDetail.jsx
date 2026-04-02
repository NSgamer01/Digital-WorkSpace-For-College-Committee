import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { subscribeTask, updateTask, deleteTask } from '../services/taskService';
import DateProperty from '../components/taskDetail/DateProperty';
import BlockEditor from '../components/taskDetail/BlockEditor';
import CommentsSection from '../components/taskDetail/CommentsSection';

const EMOJIS = ['📋', '🎯', '📝', '🚀', '💡', '🔥', '⭐', '💎', '🎨', '📊', '🏆', '✨', '🛠️', '📌', '🧩', '💼', '📚', '🎓', '🌟', '🔮'];

/* ── Status helpers (DB constraint: pending, inprogress, complete) ── */
const statusOptions = [
    { key: 'pending', label: 'Pending', cls: 'not-started', icon: '○' },
    { key: 'inprogress', label: 'In Progress', cls: 'in-progress', icon: '◐' },
    { key: 'complete', label: 'Complete', cls: 'completed', icon: '✓' },
];

const statusDisplay = {};
statusOptions.forEach(s => { statusDisplay[s.key] = s; });

const platformColors = {
    Linkedin: { bg: 'rgba(59,130,246,0.15)', color: '#3b82f6' },
    Twitter: { bg: 'rgba(6,182,212,0.15)', color: '#06b6d4' },
    Facebook: { bg: 'rgba(59,130,246,0.15)', color: '#3b82f6' },
    Instagram: { bg: 'rgba(236,72,153,0.15)', color: '#ec4899' },
    TikTok: { bg: 'rgba(168,85,247,0.15)', color: '#a855f7' },
};

const priorityOptions = [
    { label: 'Low', value: 'low', icon: '⬇️', color: '#71717a', bg: 'rgba(113,113,122,0.15)' },
    { label: 'Medium', value: 'medium', icon: '➡️', color: '#eab308', bg: 'rgba(234,179,8,0.15)' },
    { label: 'High', value: 'high', icon: '⬆️', color: '#f97316', bg: 'rgba(249,115,22,0.15)' },
    { label: 'Urgent', value: 'urgent', icon: '🔥', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
];

const TaskDetail = () => {
    const { taskId } = useParams();
    const navigate = useNavigate();
    const [task, setTask] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [isStarred, setIsStarred] = useState(false);
    const [showMoreMenu, setShowMoreMenu] = useState(false);
    const [urlEditing, setUrlEditing] = useState(false);
    const [urlValue, setUrlValue] = useState('');
    const [statusOpen, setStatusOpen] = useState(false);
    const [platformOpen, setPlatformOpen] = useState(false);
    const [priorityOpen, setPriorityOpen] = useState(false);
    const [ownerOpen, setOwnerOpen] = useState(false);
    const [members, setMembers] = useState([]);
    const ownerRef = useRef(null);
    const titleRef = useRef(null);
    const saveTimer = useRef(null);
    const emojiRef = useRef(null);
    const moreRef = useRef(null);
    const statusRef = useRef(null);
    const platformRef = useRef(null);
    const priorityRef = useRef(null);

    // ── Real-time task listener (skip if unchanged) ──────────
    const lastUpdatedAt = useRef(null);
    useEffect(() => {
        if (!taskId) return;
        const unsub = subscribeTask(taskId, (data) => {
            if (!data) { setTask(null); setLoading(false); return; }
            // Skip re-render if server data hasn't changed
            if (lastUpdatedAt.current && data.updatedAt === lastUpdatedAt.current) return;
            lastUpdatedAt.current = data.updatedAt;
            setTask(data);
            setLoading(false);
        });
        return () => unsub();
    }, [taskId]);

    // ── Fetch workspace members for owner dropdown ───────────
    const fetchMembers = useCallback(async () => {
        try {
            const data = await import('../utils/api').then(m => m.default.get('/api/committees/members'));
            setMembers(data.members || []);
        } catch (e) {
            console.error('Error fetching members:', e);
        }
    }, []);

    // Close owner dropdown on outside click
    useEffect(() => {
        if (!ownerOpen) return;
        const handle = (e) => { if (ownerRef.current && !ownerRef.current.contains(e.target)) setOwnerOpen(false); };
        document.addEventListener('mousedown', handle);
        return () => document.removeEventListener('mousedown', handle);
    }, [ownerOpen]);

    // ── Keyboard shortcuts ──────────────────────────────────
    useEffect(() => {
        const handle = (e) => {
            if (e.key === 'Escape') navigate('/tasks');
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                handleProp('status', 'complete');
            }
        };
        document.addEventListener('keydown', handle);
        return () => document.removeEventListener('keydown', handle);
    }, [navigate, taskId]);

    // ── Close dropdowns on outside click ────────────────────
    useEffect(() => {
        const handle = (e) => {
            if (emojiRef.current && !emojiRef.current.contains(e.target)) setShowEmojiPicker(false);
            if (moreRef.current && !moreRef.current.contains(e.target)) setShowMoreMenu(false);
            if (statusRef.current && !statusRef.current.contains(e.target)) setStatusOpen(false);
            if (platformRef.current && !platformRef.current.contains(e.target)) setPlatformOpen(false);
            if (priorityRef.current && !priorityRef.current.contains(e.target)) setPriorityOpen(false);
        };
        document.addEventListener('mousedown', handle);
        return () => document.removeEventListener('mousedown', handle);
    }, []);

    // ── Helpers ─────────────────────────────────────────────
    const debouncedSave = useCallback((updates) => {
        setSaving(true);
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(async () => {
            try { await updateTask(taskId, updates); } catch (err) { console.error(err); }
            setSaving(false);
        }, 500);
    }, [taskId]);

    // Optimistic update: instantly update local state, then save in background
    const handleProp = useCallback(async (prop, val) => {
        setTask(prev => prev ? { ...prev, [prop]: val } : prev);
        try { await updateTask(taskId, { [prop]: val }); } catch (err) { console.error(err); }
    }, [taskId]);

    const handleTitleBlur = () => {
        if (!titleRef.current) return;
        const t = titleRef.current.textContent.trim() || 'Untitled';
        if (task && t !== task.title) handleProp('title', t);
    };

    const handleContentChange = useCallback((c) => debouncedSave({ content: c }), [debouncedSave]);

    const handleDelete = async () => {
        if (window.confirm('Delete this task permanently?')) {
            await deleteTask(taskId);
            navigate('/tasks');
        }
    };

    const formatDate = (d) => {
        if (!d) return 'Empty';
        let date;
        if (typeof d === 'string') {
            date = d.includes('T') ? new Date(d) : new Date(d + 'T00:00:00');
        } else if (d?.toDate) {
            date = d.toDate();
        } else {
            date = new Date(d);
        }
        if (isNaN(date.getTime())) return 'Empty';
        return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    };

    const togglePlatform = (p) => {
        const curr = task.platform || [];
        const next = curr.includes(p) ? curr.filter((v) => v !== p) : [...curr, p];
        handleProp('platform', next);
    };

    // ── Loading ─────────────────────────────────────────────
    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
                <div style={{ textAlign: 'center' }}>
                    <div className="task-detail-spinner" />
                    <p style={{ color: 'var(--text-tertiary)', marginTop: 16, fontSize: 14 }}>Loading task...</p>
                </div>
            </div>
        );
    }

    // ── Not Found ───────────────────────────────────────────
    if (!task) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
                    <h2 style={{ color: 'white', marginBottom: 8 }}>Task not found</h2>
                    <p style={{ color: 'var(--text-tertiary)', marginBottom: 24 }}>This task may have been deleted.</p>
                    <button onClick={() => navigate('/tasks')} className="td-action-btn" style={{ width: 'auto', padding: '8px 20px', background: 'var(--accent)', color: 'white', fontSize: 13, fontWeight: 600 }}>
                        ← Back to Tasks
                    </button>
                </div>
            </div>
        );
    }

    const st = statusDisplay[task.status] || statusDisplay.pending;
    const platforms = Array.isArray(task.platform) ? task.platform : (task.platform ? [task.platform] : []);
    const pVal = task.priority || 'medium';
    const priorityConfig = priorityOptions.find((p) => p.value === pVal || p.label.toLowerCase() === pVal) || priorityOptions[1];

    return (
        <div className="task-detail-page">

            {/* ═══ Toolbar ═══ */}
            <div className="td-toolbar">
                {/* Breadcrumb */}
                <div className="td-breadcrumb">
                    <button onClick={() => navigate('/tasks')}>📋 Tasks</button>
                    <span style={{ color: 'var(--border)' }}>&gt;</span>
                    <span className="td-crumb-title">{task.title || 'Untitled'}</span>
                </div>
                {/* Actions */}
                <div className="td-actions">
                    {saving && <span className="td-saving">Saving...</span>}
                    <button className="td-action-btn" onClick={() => navigator.clipboard.writeText(window.location.href)} title="Copy link">🔗</button>
                    <button className="td-action-btn" onClick={() => setIsStarred(!isStarred)} title="Star">{isStarred ? '⭐' : '☆'}</button>
                    <div ref={moreRef} style={{ position: 'relative' }}>
                        <button className="td-action-btn" onClick={() => setShowMoreMenu(!showMoreMenu)} title="More">⋯</button>
                        {showMoreMenu && (
                            <div className="td-dropdown">
                                <button className="td-dropdown-item" onClick={() => { setShowMoreMenu(false); }}>📋 Duplicate</button>
                                <button className="td-dropdown-item danger" onClick={() => { setShowMoreMenu(false); handleDelete(); }}>🗑️ Delete</button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ═══ Icon ═══ */}
            <div ref={emojiRef} style={{ position: 'relative', display: 'inline-block' }}>
                <button className="td-icon-btn" onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
                    {task.icon || '📋'}
                </button>
                {showEmojiPicker && (
                    <div className="td-emoji-picker">
                        {EMOJIS.map((e) => (
                            <button
                                key={e}
                                className={`td-emoji-btn ${task.icon === e ? 'selected' : ''}`}
                                onClick={() => { handleProp('icon', e); setShowEmojiPicker(false); }}
                            >
                                {e}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* ═══ Title ═══ */}
            <h1
                ref={titleRef}
                contentEditable
                suppressContentEditableWarning
                onBlur={handleTitleBlur}
                data-placeholder="Untitled"
                className="td-title"
                dangerouslySetInnerHTML={{ __html: task.title || '' }}
            />

            {/* ═══ Properties Row (Notion-style) ═══ */}
            <div className="td-properties-row">
                {/* Status */}
                <div className="td-property" ref={statusRef} onClick={() => setStatusOpen(!statusOpen)}>
                    <span className="td-property-label">⚡ Status</span>
                    <span className={`td-status-badge ${st.cls}`}>
                        {st.icon} {st.label}
                    </span>
                    {statusOpen && (
                        <div className="td-dropdown" style={{ left: 0, right: 'auto', top: '100%' }}>
                            {statusOptions.map((opt) => (
                                <button
                                    key={opt.key}
                                    className="td-dropdown-item"
                                    onClick={(e) => { e.stopPropagation(); handleProp('status', opt.key); setStatusOpen(false); }}
                                >
                                    <span className={`td-status-badge ${opt.cls}`} style={{ fontSize: 11 }}>{opt.icon} {opt.label}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Owner */}
                <div className="td-property" ref={ownerRef} onClick={() => { setOwnerOpen(!ownerOpen); if (!ownerOpen && members.length === 0) fetchMembers(); }} style={{ position: 'relative' }}>
                    <span className="td-property-label">👤 Assigned to</span>
                    <span className="td-property-value" style={{ color: task.assignedTo && task.assignedTo !== 'all' ? 'var(--text-secondary)' : 'var(--text-tertiary)' }}>
                        {task.assignedToName || (task.assignedTo === 'all' ? 'Everyone' : task.assignedTo || 'Empty')}
                    </span>
                    {ownerOpen && (
                        <div className="td-dropdown" style={{ left: 0, right: 'auto', top: '100%', minWidth: 220, maxHeight: 250, overflowY: 'auto' }}>
                            <button className="td-dropdown-item" onClick={(e) => { e.stopPropagation(); handleProp('assignedTo', null); setOwnerOpen(false); }}>
                                <span style={{ color: 'var(--text-tertiary)' }}>✕ Unassign</span>
                            </button>
                            {members.map((m) => (
                                <button
                                    key={m.id}
                                    className="td-dropdown-item"
                                    onClick={(e) => { e.stopPropagation(); handleProp('assignedTo', m.id); setOwnerOpen(false); }}
                                    style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                                >
                                    <span style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#fff', fontWeight: 600, flexShrink: 0 }}>
                                        {(m.name || m.email || '?').charAt(0).toUpperCase()}
                                    </span>
                                    <span style={{ fontSize: 13 }}>{m.name || m.email}</span>
                                </button>
                            ))}
                            {members.length === 0 && <span style={{ padding: '8px 12px', color: 'var(--text-tertiary)', fontSize: 12 }}>Loading members...</span>}
                        </div>
                    )}
                </div>

                {/* Due Date */}
                <DateProperty
                    value={task.dueDate}
                    label="Post date"
                    onChange={(v) => handleProp('dueDate', v)}
                />

                {/* Platform */}
                <div className="td-property" ref={platformRef} onClick={() => setPlatformOpen(!platformOpen)}>
                    <span className="td-property-label">💬 Platform</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                        {platforms.length === 0 ? (
                            <span className="td-property-value" style={{ color: 'var(--text-tertiary)' }}>Empty</span>
                        ) : (
                            <>
                                {platforms.slice(0, 1).map((p) => {
                                    const c = platformColors[p] || { bg: 'rgba(139,92,246,0.15)', color: '#8b5cf6' };
                                    return (
                                        <span key={p} className="td-platform-tag" style={{ background: c.bg, color: c.color }}>{p}</span>
                                    );
                                })}
                                {platforms.length > 1 && (
                                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 500 }}>
                                        + {platforms.length - 1}
                                    </span>
                                )}
                            </>
                        )}
                    </div>
                    {platformOpen && (
                        <div className="td-dropdown" style={{ left: 0, right: 'auto', top: '100%', minWidth: 180 }}>
                            {['Linkedin', 'Twitter', 'Facebook', 'Instagram', 'TikTok'].map((p) => {
                                const selected = platforms.includes(p);
                                const c = platformColors[p] || {};
                                return (
                                    <button
                                        key={p}
                                        className="td-dropdown-item"
                                        onClick={(e) => { e.stopPropagation(); togglePlatform(p); }}
                                    >
                                        <span style={{
                                            width: 15, height: 15, borderRadius: 3, flexShrink: 0,
                                            border: selected ? 'none' : '1.5px solid rgba(255,255,255,0.25)',
                                            background: selected ? 'var(--accent)' : 'transparent',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: 9, color: 'white',
                                        }}>
                                            {selected && '✓'}
                                        </span>
                                        <span className="td-platform-tag" style={{ background: c.bg, color: c.color, fontSize: 12 }}>{p}</span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* More properties button */}
                <div className="td-property" style={{ justifyContent: 'center', paddingTop: 22 }}>
                    <span style={{ fontSize: 16, color: 'var(--text-tertiary)', letterSpacing: 1 }}>⋯</span>
                </div>
            </div>

            {/* ═══ Post URL ═══ */}
            <div className="td-extra-props">
                <div className="td-custom-row">
                    <span className="td-custom-label">🔗 Post URL</span>
                    {urlEditing ? (
                        <input
                            autoFocus
                            value={urlValue}
                            onChange={(e) => setUrlValue(e.target.value)}
                            onBlur={() => { handleProp('postUrl', urlValue); setUrlEditing(false); }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') { handleProp('postUrl', urlValue); setUrlEditing(false); }
                                if (e.key === 'Escape') setUrlEditing(false);
                            }}
                            placeholder="https://..."
                            style={{
                                flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(99,102,241,0.4)',
                                borderRadius: 4, padding: '4px 10px', color: 'white', fontSize: 14, outline: 'none',
                            }}
                        />
                    ) : (
                        <span
                            className="td-custom-value"
                            onClick={() => { setUrlValue(task.postUrl || ''); setUrlEditing(true); }}
                            style={{ cursor: 'pointer' }}
                        >
                            {task.postUrl ? (
                                <a href={task.postUrl.startsWith('http') ? task.postUrl : `https://${task.postUrl}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                                    {task.postUrl}
                                </a>
                            ) : (
                                <span style={{ color: 'var(--text-tertiary)' }}>Empty</span>
                            )}
                        </span>
                    )}
                </div>

                {/* Tags */}
                <div className="td-custom-row">
                    <span className="td-custom-label">🏷️ Tags</span>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {(task.tags || []).map((tag) => {
                            const colors = [
                                { bg: 'rgba(59,130,246,0.15)', color: '#3b82f6' },
                                { bg: 'rgba(139,92,246,0.15)', color: '#8b5cf6' },
                                { bg: 'rgba(34,197,94,0.15)', color: '#22c55e' },
                                { bg: 'rgba(236,72,153,0.15)', color: '#ec4899' },
                                { bg: 'rgba(234,179,8,0.15)', color: '#eab308' },
                                { bg: 'rgba(6,182,212,0.15)', color: '#06b6d4' },
                            ];
                            const c = colors[Math.abs([...tag].reduce((a, ch) => a + ch.charCodeAt(0), 0)) % colors.length];
                            return (
                                <span key={tag} className="td-tag-chip" style={{ background: c.bg, color: c.color }}>
                                    {tag}
                                    <button className="td-tag-remove" onClick={() => handleProp('tags', (task.tags || []).filter(t => t !== tag))}>×</button>
                                </span>
                            );
                        })}
                        <input
                            placeholder="Add tag..."
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && e.target.value.trim()) {
                                    const newTag = e.target.value.trim();
                                    if (!(task.tags || []).includes(newTag)) {
                                        handleProp('tags', [...(task.tags || []), newTag]);
                                    }
                                    e.target.value = '';
                                }
                            }}
                            style={{
                                background: 'transparent', border: 'none', outline: 'none',
                                color: 'white', fontSize: 13, minWidth: 80, padding: '2px 0',
                            }}
                        />
                    </div>
                </div>

                {/* Priority */}
                <div className="td-custom-row" ref={priorityRef} onClick={() => setPriorityOpen(!priorityOpen)} style={{ position: 'relative', cursor: 'pointer' }}>
                    <span className="td-custom-label">⭐ Priority</span>
                    <span className="td-priority-badge" style={{ background: priorityConfig.bg, color: priorityConfig.color }}>
                        {priorityConfig.icon} {priorityConfig.label}
                    </span>
                    {priorityOpen && (
                        <div className="td-dropdown" style={{ left: 90, right: 'auto', top: '100%' }}>
                            {priorityOptions.map((p) => (
                                <button
                                    key={p.label}
                                    className="td-dropdown-item"
                                    onClick={(e) => { e.stopPropagation(); handleProp('priority', p.value); setPriorityOpen(false); }}
                                >
                                    <span className="td-priority-badge" style={{ background: p.bg, color: p.color, fontSize: 11 }}>
                                        {p.icon} {p.label}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ═══ Comments ═══ */}
            <div className="td-comments-section">
                <div className="td-comments-title">💬 Comments</div>
                <CommentsSection taskId={taskId} />
            </div>

            {/* ═══ Content Editor ═══ */}
            <div className="td-section-label">📝 Description</div>
            <div className="td-content-section">
                <BlockEditor
                    value={task.content || []}
                    onChange={handleContentChange}
                    placeholder="Type '/' for commands, or just start writing..."
                />
            </div>
        </div>
    );
};

export default TaskDetail;
