// ============================================
// src/components/MessageItem.jsx — Chat Message
// ============================================
// React.memo wrapped message component with avatar,
// role badge, hover actions, and grouped rendering.
// ============================================

import React, { memo, useState } from 'react';
import { ROLE_LABELS, ROLE_COLORS } from '../constants/roles';

// ── Time formatter (OUTSIDE component to avoid recreation) ──
function formatMessageTime(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;

    const days = Math.floor(diff / 86400000);
    if (days === 1) return 'yesterday';
    if (days < 7) {
        return date.toLocaleDateString('en-US', { weekday: 'long' });
    }

    const sameYear = date.getFullYear() === now.getFullYear();
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        ...(sameYear ? {} : { year: 'numeric' }),
    });
}

const MessageItem = memo(({ message, showHeader, isOwnMessage, onEdit, onDelete }) => {
    const [showActions, setShowActions] = useState(false);
    const [editing, setEditing] = useState(false);
    const [editText, setEditText] = useState(message.text);

    const handleEditSubmit = (e) => {
        e.preventDefault();
        if (editText.trim() && editText.trim() !== message.text) {
            onEdit(message.id, editText.trim());
        }
        setEditing(false);
    };

    const handleEditCancel = () => {
        setEditText(message.text);
        setEditing(false);
    };

    const avatarLetter = (message.user_name || 'U').charAt(0).toUpperCase();
    const roleColor = ROLE_COLORS[message.user_role] || '#6b7280';
    const roleLabel = ROLE_LABELS[message.user_role] || message.user_role || 'member';

    return (
        <div
            style={{
                position: 'relative',
                padding: '2px 16px',
                transition: 'background 0.1s',
                background: showActions ? 'var(--bgHover)' : 'transparent',
                borderRadius: '4px',
            }}
            onMouseEnter={() => setShowActions(true)}
            onMouseLeave={() => setShowActions(false)}
        >
            {showHeader && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginTop: '16px',
                    marginBottom: '2px',
                }}>
                    {/* Avatar */}
                    <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        background: isOwnMessage ? 'var(--accent)' : '#6366f1',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '14px',
                        fontWeight: 600,
                        flexShrink: 0,
                    }}>
                        {avatarLetter}
                    </div>

                    {/* Name */}
                    <span style={{
                        fontWeight: 600,
                        fontSize: '14px',
                        color: 'var(--textPrimary)',
                    }}>
                        {message.user_name || 'Unknown User'}
                    </span>

                    {/* Role badge */}
                    <span style={{
                        fontSize: '10px',
                        padding: '1px 6px',
                        borderRadius: '8px',
                        color: 'white',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.3px',
                        backgroundColor: roleColor,
                    }}>
                        {roleLabel}
                    </span>

                    {/* Timestamp */}
                    <span style={{
                        fontSize: '12px',
                        color: 'var(--textTertiary)',
                    }}>
                        {formatMessageTime(message.created_at)}
                    </span>
                </div>
            )}

            <div style={{
                fontSize: '14px',
                lineHeight: 1.5,
                color: 'var(--textPrimary)',
                paddingLeft: showHeader ? '44px' : '44px',
                opacity: message._optimistic ? 0.6 : 1,
            }}>
                {editing ? (
                    <form onSubmit={handleEditSubmit} style={{ display: 'flex', gap: '8px' }}>
                        <input
                            type="text"
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            autoFocus
                            onKeyDown={(e) => { if (e.key === 'Escape') handleEditCancel(); }}
                            style={{
                                flex: 1,
                                padding: '4px 8px',
                                border: '1px solid var(--border)',
                                borderRadius: '4px',
                                background: 'var(--inputBg)',
                                color: 'var(--textPrimary)',
                                fontSize: '14px',
                                outline: 'none',
                            }}
                        />
                        <button type="submit" style={{
                            background: 'var(--accent)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '4px 10px',
                            cursor: 'pointer',
                            fontSize: '12px',
                        }}>Save</button>
                        <button type="button" onClick={handleEditCancel} style={{
                            background: 'transparent',
                            color: 'var(--textSecondary)',
                            border: '1px solid var(--border)',
                            borderRadius: '4px',
                            padding: '4px 10px',
                            cursor: 'pointer',
                            fontSize: '12px',
                        }}>Cancel</button>
                    </form>
                ) : (
                    <>
                        <span style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                            {message.text}
                        </span>
                        {message.is_edited && (
                            <span style={{
                                fontSize: '11px',
                                color: 'var(--textTertiary)',
                                marginLeft: '4px',
                            }}>(edited)</span>
                        )}
                    </>
                )}
            </div>

            {/* Action buttons on hover */}
            {showActions && isOwnMessage && !editing && (
                <div style={{
                    position: 'absolute',
                    right: '16px',
                    top: showHeader ? '16px' : '0px',
                    background: 'var(--cardBg)',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    padding: '2px',
                    display: 'flex',
                    gap: '2px',
                    boxShadow: 'var(--shadow)',
                }}>
                    <button
                        onClick={() => { setEditing(true); setEditText(message.text); }}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '4px 6px',
                            borderRadius: '4px',
                            fontSize: '14px',
                        }}
                        title="Edit"
                    >✏️</button>
                    <button
                        onClick={() => onDelete(message.id)}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '4px 6px',
                            borderRadius: '4px',
                            fontSize: '14px',
                        }}
                        title="Delete"
                    >🗑️</button>
                </div>
            )}
        </div>
    );
});

MessageItem.displayName = 'MessageItem';

export default MessageItem;
