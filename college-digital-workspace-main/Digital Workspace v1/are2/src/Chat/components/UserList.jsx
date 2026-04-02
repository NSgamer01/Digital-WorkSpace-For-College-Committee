import React from 'react';
import { roleBadgeClasses, avatarGradients } from '../data/mockUsers';

// ── Timestamp formatter (same logic as ChatBubble) ──────────────
function formatPreviewTime(date) {
    if (!date) return '';
    if (!(date instanceof Date) || isNaN(date.getTime())) return '';

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (msgDay.getTime() === today.getTime()) {
        return new Intl.DateTimeFormat('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        }).format(date);
    }

    if (msgDay.getTime() === yesterday.getTime()) return 'Yesterday';

    return new Intl.DateTimeFormat('en-GB', {
        day: 'numeric',
        month: 'short',
    }).format(date);
}


// ── User List Component ─────────────────────────────────────────
// Renders the clickable user list for the direct messages view.
// Props:
//   users          — array of { id, name, role, initial }
//   loadingUsers   — boolean indicating if users are being fetched
//   onSelectUser   — callback when a user row is clicked
//   dmChatsMap     — { [userId]: { chatId, lastMessage, lastMessageAt } }
//   unreadCountMap — { [userId]: number }

const UserList = ({ users = [], loadingUsers = false, onSelectUser, dmChatsMap = {}, unreadCountMap = {} }) => (
    <div className="flex-1 flex flex-col h-full">

        {/* Header */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-zinc-800">
            <div className="flex items-center gap-3">
                <span className="text-lg">💬</span>
                <div>
                    <h3 className="text-white font-semibold text-base leading-tight">Direct Messages</h3>
                    <p className="text-zinc-500 text-xs mt-0.5">Select a member to start chatting</p>
                </div>
            </div>
        </div>

        {/* Scrollable user list */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
            {loadingUsers ? (
                /* Loading state */
                <div className="flex flex-col items-center justify-center h-full gap-3">
                    <div
                        className="w-7 h-7 border-2 border-zinc-700 border-t-blue-500 rounded-full"
                        style={{ animation: 'spin 0.8s linear infinite' }}
                    />
                    <p className="text-zinc-500 text-sm">Loading users...</p>
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
            ) : users.length === 0 ? (
                /* Empty state */
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                    <div className="w-16 h-16 rounded-2xl bg-zinc-800/60 border border-zinc-700/40 flex items-center justify-center mb-4">
                        <span className="text-2xl opacity-40">👥</span>
                    </div>
                    <p className="text-white font-medium text-sm mb-1">No members found</p>
                    <p className="text-zinc-500 text-xs">Users will appear here once registered</p>
                </div>
            ) : (
                users.map((user, idx) => {
                    const badge = roleBadgeClasses[user.role] || roleBadgeClasses.Member;
                    const gradient = avatarGradients[idx % avatarGradients.length];
                    const preview = dmChatsMap[String(user.id)];
                    const unread = unreadCountMap[String(user.id)] || 0;

                    return (
                        <button
                            key={user.id}
                            onClick={() => onSelectUser(user)}
                            className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl mb-1 hover:bg-zinc-800/70 transition-colors duration-150 cursor-pointer text-left"
                        >
                            {/* Avatar */}
                            <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
                                {user.initial}
                            </div>

                            {/* Name + role + preview */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-zinc-200 truncate">
                                        {user.name}
                                    </span>
                                    <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md flex-shrink-0 ${badge}`}>
                                        {user.role}
                                    </span>
                                </div>

                                {/* Last message preview */}
                                <div className="flex items-center justify-between mt-0.5">
                                    <span className="text-xs text-zinc-500 truncate mr-2">
                                        {preview?.lastMessage || 'No messages yet'}
                                    </span>
                                    {preview?.lastMessageAt && (
                                        <span className="text-[10px] text-zinc-600 flex-shrink-0">
                                            {formatPreviewTime(preview.lastMessageAt)}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Unread badge */}
                            {unread > 0 && (
                                <div className="flex-shrink-0 min-w-[22px] h-[22px] rounded-full bg-blue-500 flex items-center justify-center">
                                    <span className="text-[10px] font-bold text-white px-1.5">
                                        {unread > 9 ? '9+' : unread}
                                    </span>
                                </div>
                            )}
                        </button>
                    );
                })
            )}
        </div>
    </div>
);

export default UserList;
