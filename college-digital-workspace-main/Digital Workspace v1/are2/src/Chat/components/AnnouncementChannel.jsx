import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import AnnouncementForm from '../../components/announcement/AnnouncementForm';
import { subscribeAnnouncements } from '../../services/announcementService';

// ── Timestamp formatter ─────────────────────────────────────────
function formatAnnouncementTime(date) {
    if (!date) return '';
    if (!(date instanceof Date) || isNaN(date.getTime())) return '';

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (msgDay.getTime() === today.getTime()) {
        return (
            'Today at ' +
            new Intl.DateTimeFormat('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
            }).format(date)
        );
    }

    if (msgDay.getTime() === yesterday.getTime()) {
        return (
            'Yesterday at ' +
            new Intl.DateTimeFormat('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
            }).format(date)
        );
    }

    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    }).format(date);
}


// ── Structured Announcement Card ────────────────────────────────
const AnnouncementCard = ({ announcement }) => {
    if (announcement.deleted) {
        return (
            <div className="w-full bg-zinc-800/20 border border-zinc-700/20 rounded-xl px-5 py-4">
                <div className="flex items-center gap-2.5">
                    <span className="text-base opacity-30">🚫</span>
                    <p className="text-sm text-zinc-500 italic">This announcement was removed</p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full bg-zinc-800/40 border border-zinc-700/40 rounded-xl px-5 py-5 hover:bg-zinc-800/60 transition-colors duration-150">
            <h4 className="text-base font-bold text-white leading-snug mb-1.5">
                {announcement.title || 'Untitled'}
            </h4>

            {announcement.description && (
                <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap mb-4">
                    {announcement.description}
                </p>
            )}

            <div className="flex items-center gap-3 pt-3 border-t border-zinc-700/30">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-600/60 to-indigo-600/60 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                    {(announcement.sender || 'U').split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>

                <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-xs font-semibold text-zinc-400 truncate">
                        {announcement.sender}
                    </span>
                    <span className="text-zinc-600">·</span>
                    <span className="text-[11px] text-zinc-500 whitespace-nowrap">
                        {formatAnnouncementTime(announcement.timestamp)}
                    </span>
                    {announcement.edited && (
                        <>
                            <span className="text-zinc-600">·</span>
                            <span className="text-[10px] text-zinc-500 italic">Edited</span>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};


// ═══════════════════════════════════════════════════════════════════
//  MAIN ANNOUNCEMENT CHANNEL COMPONENT
// ═══════════════════════════════════════════════════════════════════
const AnnouncementChannel = () => {
    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const scrollEndRef = useRef(null);

    const { user: authUser } = useAuth();
    // Check multiple places where role might be stored
    const userRole = authUser?.globalRole || authUser?.role || authUser?.position || 'member';

    // Permission check (case-insensitive)
    const normalizedRole = userRole?.toLowerCase().trim();
    const canPost = ['admin', 'faculty', 'head'].includes(normalizedRole);

    // Subscribe to announcements via service
    useEffect(() => {
        const unsubscribe = subscribeAnnouncements((items) => {
            setAnnouncements(items);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // Auto-scroll
    useEffect(() => {
        scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [announcements]);

    return (
        <div className="flex-1 flex flex-col h-full">

            {/* Sticky Channel Header */}
            <div className="flex-shrink-0 px-6 py-4 border-b border-zinc-800">
                <div className="flex items-center gap-3">
                    <span className="text-lg">📢</span>
                    <div>
                        <h3 className="text-white font-semibold text-base leading-tight">Announcements</h3>
                        <p className="text-zinc-500 text-xs mt-0.5">Official workspace announcements</p>
                    </div>
                </div>
            </div>

            {/* Scrollable Announcements List */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3 custom-scroll">
                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-3 min-h-[200px]">
                        <div
                            className="w-7 h-7 border-2 border-zinc-700 border-t-purple-500 rounded-full"
                            style={{ animation: 'spin 0.8s linear infinite' }}
                        />
                        <p className="text-zinc-500 text-sm">Loading announcements...</p>
                        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                    </div>
                ) : announcements.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center min-h-[200px]">
                        <div className="w-16 h-16 rounded-2xl bg-zinc-800/60 border border-zinc-700/40 flex items-center justify-center mb-4">
                            <span className="text-2xl opacity-40">📢</span>
                        </div>
                        <p className="text-white font-medium text-sm mb-1">No announcements yet</p>
                        <p className="text-zinc-500 text-xs">
                            {canPost
                                ? 'Tap the + button to post the first one'
                                : 'Official updates will appear here'
                            }
                        </p>
                    </div>
                ) : (
                    announcements.map(a => (
                        <AnnouncementCard key={a.id} announcement={a} />
                    ))
                )}
                <div ref={scrollEndRef} />
            </div>

            {/* Floating Action Button */}
            {canPost && !showCreateModal && (
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="fixed bottom-6 right-8 max-sm:bottom-4 max-sm:right-4 w-14 h-14 rounded-full bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center text-white text-2xl shadow-lg shadow-purple-500/30 hover:scale-110 hover:shadow-purple-500/50 active:scale-95 transition-all duration-200 cursor-pointer z-40"
                    title="New Announcement"
                    aria-label="New Announcement"
                >
                    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                </button>
            )}

            {/* Announcement Form Modal */}
            <AnnouncementForm
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
            />
        </div>
    );
};

export default AnnouncementChannel;
