import React from 'react';

// ── Category styles ─────────────────────────────────────────────
const CATEGORY_STYLES = {
    general: { badge: 'bg-blue-500/15 text-blue-400 border-blue-500/20', dot: 'bg-blue-400' },
    event: { badge: 'bg-purple-500/15 text-purple-400 border-purple-500/20', dot: 'bg-purple-400' },
    urgent: { badge: 'bg-red-500/15 text-red-400 border-red-500/20', dot: 'bg-red-400' },
};

// ═══════════════════════════════════════════════════════════════════
//  DASHBOARD ANNOUNCEMENT CARD — Premium preview variant
//  Bigger padding, larger text, richer hover, scoped to Dashboard only
// ═══════════════════════════════════════════════════════════════════
const DashboardAnnouncementCard = ({ announcement }) => {
    const a = announcement;
    const cat = CATEGORY_STYLES[a.category] || CATEGORY_STYLES.general;

    return (
        <div className="bg-zinc-800/50 border border-zinc-700/40 rounded-2xl px-6 py-5 min-h-[160px] flex flex-col hover:bg-zinc-800/80 hover:border-zinc-600/50 hover:border-l-purple-500/60 hover:border-l-2 transition-all duration-200 group">

            {/* Title + Category badge row */}
            <div className="flex items-start justify-between gap-3 mb-2.5">
                <h4 className="text-base font-semibold text-white leading-snug line-clamp-1 group-hover:text-purple-200 transition-colors">
                    {a.title || 'Untitled'}
                </h4>
                <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
                    {a.pinned && <span className="text-sm" title="Pinned">📌</span>}
                    <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border ${cat.badge}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cat.dot}`} />
                        {a.category || 'general'}
                    </span>
                </div>
            </div>

            {/* Description (2 lines max) */}
            {a.description && (
                <p className="text-sm text-zinc-400 line-clamp-2 leading-relaxed mb-3">
                    {a.description}
                </p>
            )}

            {/* Metadata row */}
            <div className="flex items-center gap-3 mt-auto pt-1">
                {a.senderName && (
                    <>
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-600/60 to-indigo-600/60 flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">
                            {(a.senderName || 'U').split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <span className="text-xs text-zinc-500 font-medium">{a.senderName}</span>
                        <span className="text-zinc-700">·</span>
                    </>
                )}
                {a.eventDate && (
                    <span className="text-xs text-zinc-500 flex items-center gap-1">
                        📅 {a.eventDate}
                    </span>
                )}
                {a.eventTime && (
                    <span className="text-xs text-zinc-500 flex items-center gap-1">
                        🕐 {a.eventTime}
                    </span>
                )}
                {a.mediaUrl && (
                    <span className="text-xs text-zinc-500">
                        {a.mediaType === 'video' ? '🎬' : '🖼️'} Media
                    </span>
                )}
            </div>
        </div>
    );
};

export default DashboardAnnouncementCard;
