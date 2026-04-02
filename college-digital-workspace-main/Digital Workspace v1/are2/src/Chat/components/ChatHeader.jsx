import React from 'react';
import { roleBadgeClasses } from '../data/mockUsers';

// ── Chat Header Component ───────────────────────────────────────
// Renders the header bar for a direct message chat screen.
// Shows back button, user avatar, name, role badge, and online status.
// Props:
//   user     — { id, name, role, initial }
//   onBack   — callback to return to user list
//   isOnline — boolean indicating if the other user is online

const ChatHeader = ({ user, onBack, isOnline = false }) => (
    <div className="flex-shrink-0 px-6 py-4 border-b border-zinc-800">
        <div className="flex items-center gap-3">
            {/* Back button */}
            <button
                onClick={onBack}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer flex-shrink-0"
            >
                ←
            </button>

            {/* User info */}
            <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                    {user.initial}
                </div>
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <h3 className="text-white font-semibold text-sm truncate">{user.name}</h3>
                        <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md flex-shrink-0 ${roleBadgeClasses[user.role] || ''}`}>
                            {user.role}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                        {isOnline ? (
                            <>
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                <span className="text-[11px] text-green-400">Online</span>
                            </>
                        ) : (
                            <>
                                <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                                <span className="text-[11px] text-zinc-500">Last seen recently</span>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    </div>
);

export default ChatHeader;
