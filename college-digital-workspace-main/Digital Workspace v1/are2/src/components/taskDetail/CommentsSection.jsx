import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
    addComment,
    subscribeComments,
    updateComment,
    deleteComment,
    toggleReaction,
} from '../../services/taskService';

const reactionEmojis = ['👍', '❤️', '🎉', '🚀', '👀'];

const timeAgo = (ts) => {
    if (!ts) return '';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const CommentsSection = ({ taskId }) => {
    const [comments, setComments] = useState([]);
    const [input, setInput] = useState('');
    const [expanded, setExpanded] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [editText, setEditText] = useState('');
    const [showReactions, setShowReactions] = useState(null);
    const inputRef = useRef(null);
    const { user } = useAuth();

    useEffect(() => {
        if (!taskId) return;
        const unsub = subscribeComments(taskId, setComments);
        return () => unsub();
    }, [taskId]);

    const handleSubmit = async () => {
        if (!input.trim() || !user) return;
        await addComment(taskId, {
            content: input.trim(),
            authorId: user.id,
            authorEmail: user.email,
            authorName: user.name || user.email?.split('@')[0] || 'User',
        });
        setInput('');
        setExpanded(false);
    };

    const handleEdit = async (commentId) => {
        if (!editText.trim()) return;
        await updateComment(taskId, commentId, { content: editText.trim() });
        setEditingId(null);
        setEditText('');
    };

    const handleDelete = async (commentId) => {
        await deleteComment(taskId, commentId);
    };

    const handleReaction = async (commentId, emoji) => {
        if (!user) return;
        await toggleReaction(taskId, commentId, emoji, user.id);
        setShowReactions(null);
    };

    const getInitials = (email) => (email ? email.substring(0, 2).toUpperCase() : '??');

    return (
        <div>
            {/* Add comment */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'flex-start' }}>
                <div style={{
                    width: 32, height: 32, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'linear-gradient(135deg, var(--accent), var(--status-purple))', fontSize: 12, fontWeight: 700, color: 'white',
                }}>
                    {getInitials(user?.email)}
                </div>
                <div style={{ flex: 1 }}>
                    <textarea
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onFocus={() => setExpanded(true)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit(); }}
                        placeholder="Add a comment..."
                        rows={expanded ? 3 : 1}
                        style={{
                            width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
                            borderRadius: 8, padding: '8px 12px', color: 'white', fontSize: 14, outline: 'none',
                            resize: 'none', transition: 'all 0.2s', lineHeight: 1.5,
                        }}
                    />
                    {expanded && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                            <button
                                onClick={() => { setExpanded(false); setInput(''); }}
                                style={{
                                    padding: '5px 14px', borderRadius: 6, border: 'none', background: 'transparent',
                                    color: 'var(--text-tertiary)', fontSize: 12, cursor: 'pointer',
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={!input.trim()}
                                style={{
                                    padding: '5px 14px', borderRadius: 6, border: 'none',
                                    background: input.trim() ? 'var(--accent)' : 'rgba(99,102,241,0.3)',
                                    color: 'white', fontSize: 12, fontWeight: 600, cursor: input.trim() ? 'pointer' : 'not-allowed',
                                }}
                            >
                                Comment
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Comment list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {comments.map((comment) => (
                    <div key={comment.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <div style={{
                            width: 32, height: 32, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'linear-gradient(135deg, var(--status-blue), #06b6d4)', fontSize: 12, fontWeight: 700, color: 'white',
                        }}>
                            {getInitials(comment.authorEmail)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                                    {comment.authorName || comment.authorEmail?.split('@')[0]}
                                </span>
                                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                                    {timeAgo(comment.createdAt)}
                                </span>
                            </div>

                            {editingId === comment.id ? (
                                <div>
                                    <textarea
                                        value={editText}
                                        onChange={(e) => setEditText(e.target.value)}
                                        rows={2}
                                        style={{
                                            width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(99,102,241,0.4)',
                                            borderRadius: 6, padding: '6px 10px', color: 'white', fontSize: 14, outline: 'none', resize: 'none',
                                        }}
                                    />
                                    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                                        <button onClick={() => handleEdit(comment.id)} style={{ padding: '3px 10px', borderRadius: 4, background: 'var(--accent)', border: 'none', color: 'white', fontSize: 11, cursor: 'pointer' }}>Save</button>
                                        <button onClick={() => setEditingId(null)} style={{ padding: '3px 10px', borderRadius: 4, background: 'transparent', border: 'none', color: 'var(--text-tertiary)', fontSize: 11, cursor: 'pointer' }}>Cancel</button>
                                    </div>
                                </div>
                            ) : (
                                <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0, wordBreak: 'break-word' }}>
                                    {comment.content}
                                </p>
                            )}

                            {/* Reactions */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                                {comment.reactions && Object.entries(comment.reactions).map(([emoji, users]) => (
                                    users.length > 0 && (
                                        <button
                                            key={emoji}
                                            onClick={() => handleReaction(comment.id, emoji)}
                                            style={{
                                                padding: '2px 6px', borderRadius: 10,
                                                background: users.includes(user?.id) ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
                                                border: users.includes(user?.id) ? '1px solid rgba(99,102,241,0.4)' : '1px solid rgba(255,255,255,0.08)',
                                                fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                                                color: 'var(--text-secondary)', transition: 'all 0.15s',
                                            }}
                                        >
                                            {emoji} <span style={{ fontSize: 11 }}>{users.length}</span>
                                        </button>
                                    )
                                ))}

                                {/* Add reaction */}
                                <div style={{ position: 'relative' }}>
                                    <button
                                        onClick={() => setShowReactions(showReactions === comment.id ? null : comment.id)}
                                        style={{
                                            padding: '2px 6px', borderRadius: 10, background: 'transparent',
                                            border: '1px solid rgba(255,255,255,0.06)', fontSize: 12,
                                            cursor: 'pointer', color: 'var(--text-tertiary)',
                                            opacity: 0.5, transition: 'opacity 0.15s',
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                                        onMouseLeave={(e) => e.currentTarget.style.opacity = '0.5'}
                                    >
                                        😊+
                                    </button>
                                    {showReactions === comment.id && (
                                        <div style={{
                                            position: 'absolute', bottom: '100%', left: 0, marginBottom: 4,
                                            display: 'flex', gap: 2, padding: 4, background: 'var(--bg-secondary)',
                                            border: '1px solid var(--border)', borderRadius: 8,
                                            boxShadow: '0 4px 20px rgba(0,0,0,0.4)', zIndex: 50,
                                        }}>
                                            {reactionEmojis.map((emoji) => (
                                                <button
                                                    key={emoji}
                                                    onClick={() => handleReaction(comment.id, emoji)}
                                                    style={{
                                                        padding: '4px 6px', background: 'transparent', border: 'none',
                                                        fontSize: 16, cursor: 'pointer', borderRadius: 4,
                                                        transition: 'background 0.15s',
                                                    }}
                                                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                                >
                                                    {emoji}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Actions on own comments */}
                                {user && comment.authorId === user.id && editingId !== comment.id && (
                                    <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                                        <button
                                            onClick={() => { setEditingId(comment.id); setEditText(comment.content); }}
                                            style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: 11, cursor: 'pointer', padding: '2px 6px' }}
                                            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                                            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-tertiary)'}
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleDelete(comment.id)}
                                            style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: 11, cursor: 'pointer', padding: '2px 6px' }}
                                            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--status-red)'}
                                            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-tertiary)'}
                                        >
                                            Delete
                                        </button>
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {comments.length === 0 && (
                <div style={{ textAlign: 'center', padding: '12px 0', color: 'var(--text-tertiary)', fontSize: 13 }}>
                    No comments yet
                </div>
            )}
        </div>
    );
};

export default CommentsSection;
