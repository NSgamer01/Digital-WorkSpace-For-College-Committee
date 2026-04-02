import React, { useState } from 'react';
import { editMessage, deleteMessageForEveryone } from '../../services/chatService';

// ── Timestamp formatter ─────────────────────────────────────────
function formatTimestamp(timestamp) {
    if (!timestamp) return '';
    if (typeof timestamp === 'string') return timestamp;

    const date = typeof timestamp.toDate === 'function'
        ? timestamp.toDate()
        : timestamp instanceof Date
            ? timestamp
            : new Date(timestamp);

    if (!date || isNaN(date.getTime())) return '';

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (msgDay.getTime() === today.getTime()) {
        return new Intl.DateTimeFormat('en-US', {
            hour: 'numeric', minute: '2-digit', hour12: true,
        }).format(date);
    }
    if (msgDay.getTime() === yesterday.getTime()) return 'Yesterday';
    return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(date);
}

// ── Chat Bubble Component ───────────────────────────────────────
const ChatBubble = ({ message, chatId, isSeen = false }) => {
    const isMe = message.isMe;
    const isDeleted = message.deleted === true;
    const isOptimistic = message.optimistic === true;

    const [isEditing, setIsEditing] = useState(false);
    const [editedText, setEditedText] = useState('');
    const [saving, setSaving] = useState(false);

    const handleEdit = () => {
        if (isDeleted || isOptimistic) return;
        setEditedText(message.text);
        setIsEditing(true);
    };

    const handleSaveEdit = async () => {
        const trimmed = editedText.trim();
        if (!trimmed || !chatId || !message.id) return;
        if (trimmed === message.text) { setIsEditing(false); return; }

        setSaving(true);
        try {
            await editMessage(chatId, message.id, trimmed);
            setIsEditing(false);
        } catch (error) {
            console.error('Edit message error:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleCancelEdit = () => {
        setIsEditing(false);
        setEditedText('');
    };

    const handleEditKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveEdit(); }
        else if (e.key === 'Escape') handleCancelEdit();
    };

    const handleDelete = async () => {
        if (isDeleted || isOptimistic || !chatId || !message.id) return;
        try {
            await deleteMessageForEveryone(chatId, message.id);
        } catch (error) {
            console.error('Delete message error:', error);
        }
    };

    return (
        <div
            className={`group flex flex-col max-w-[70%] ${isMe ? 'self-end items-end' : 'self-start items-start'}`}
            style={isOptimistic ? { opacity: 0.7 } : undefined}
        >
            {!isMe && !isDeleted && (
                <span className="text-xs font-medium text-zinc-400 mb-1 ml-1">
                    {message.sender}
                </span>
            )}

            <div className={`flex items-center gap-1.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                <div
                    className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${isDeleted
                        ? 'bg-zinc-800/40 text-zinc-600 italic'
                        : isMe
                            ? 'bg-blue-600/20 text-zinc-200 rounded-br-md'
                            : 'bg-zinc-800/80 text-zinc-300 rounded-bl-md'
                        }`}
                >
                    {isDeleted ? (
                        <span>This message was deleted</span>
                    ) : isEditing ? (
                        <div className="flex flex-col gap-2 min-w-[200px]">
                            <input
                                type="text"
                                value={editedText}
                                onChange={(e) => setEditedText(e.target.value)}
                                onKeyDown={handleEditKeyDown}
                                className="bg-zinc-900/80 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-200 outline-none focus:border-blue-500/60 transition-colors"
                                autoFocus
                                disabled={saving}
                            />
                            <div className="flex items-center gap-2 justify-end">
                                <button onClick={handleCancelEdit} disabled={saving}
                                    className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer">
                                    Cancel
                                </button>
                                <button onClick={handleSaveEdit} disabled={saving || !editedText.trim()}
                                    className="text-[11px] text-blue-400 hover:text-blue-300 font-medium transition-colors cursor-pointer disabled:opacity-40">
                                    {saving ? 'Saving...' : 'Save'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        message.text
                    )}
                </div>

                {isMe && !isDeleted && !isOptimistic && !isEditing && chatId && (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={handleEdit}
                            className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-zinc-800 text-zinc-600 hover:text-zinc-300 transition-colors cursor-pointer"
                            title="Edit">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                        </button>
                        <button onClick={handleDelete}
                            className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-red-900/30 text-zinc-600 hover:text-red-400 transition-colors cursor-pointer"
                            title="Delete">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                        </button>
                    </div>
                )}
            </div>

            {!isEditing && (
                <span className="text-[10px] text-zinc-600 mt-1 mx-1">
                    {formatTimestamp(message.timestamp)}
                    {!isDeleted && message.edited && (
                        <span className="ml-1.5 text-zinc-600">(edited)</span>
                    )}
                    {isMe && isSeen && (
                        <span className="ml-1.5 text-blue-400/70">• Seen</span>
                    )}
                </span>
            )}
        </div>
    );
};

export default ChatBubble;
