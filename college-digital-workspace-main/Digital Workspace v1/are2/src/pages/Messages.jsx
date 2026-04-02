// ============================================
// src/pages/Messages.jsx — Full Messaging Page
// ============================================
// Channel sidebar (public + DMs), chat area with
// incremental polling, announcements view, modals
// for channel creation and DM initiation.
// ============================================

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCommittee } from '../contexts/CommitteeContext';
import useChannels from '../hooks/useChannels';
import useMessages from '../hooks/useMessages';
import useAnnouncements from '../hooks/useAnnouncements';
import MessageItem from '../components/MessageItem';
import { ROLE_LABELS, ROLE_COLORS } from '../constants/roles';
import api from '../utils/api';

// ── Relative time helper ──
function formatRelativeTime(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    const days = Math.floor(diff / 86400000);
    if (days < 7) return `${days}d`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Styles ──
const S = {
    page: {
        display: 'flex',
        flex: 1,
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
        background: 'var(--bgPrimary)',
    },
    sidebar: {
        width: '280px',
        flexShrink: 0,
        borderRight: '1px solid var(--border)',
        background: 'var(--bgSecondary)',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
    },
    sidebarHeader: {
        padding: '16px 16px 8px',
        fontSize: '18px',
        fontWeight: 700,
        color: 'var(--textPrimary)',
        borderBottom: '1px solid var(--borderLight)',
    },
    sectionLabel: {
        fontSize: '11px',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        color: 'var(--textTertiary)',
        padding: '16px 16px 4px',
    },
    channelItem: (isActive) => ({
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 12px',
        cursor: 'pointer',
        borderRadius: '6px',
        margin: '1px 8px',
        transition: 'background 0.15s',
        background: isActive ? 'var(--bgHover)' : 'transparent',
        borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
    }),
    channelIcon: {
        fontSize: '16px',
        flexShrink: 0,
        width: '20px',
        textAlign: 'center',
    },
    channelName: {
        flex: 1,
        fontSize: '14px',
        fontWeight: 500,
        color: 'var(--textPrimary)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
    dmItem: (isActive) => ({
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '8px 12px',
        cursor: 'pointer',
        borderRadius: '6px',
        margin: '1px 8px',
        transition: 'background 0.15s',
        background: isActive ? 'var(--bgHover)' : 'transparent',
        borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
    }),
    dmAvatar: {
        width: '28px',
        height: '28px',
        borderRadius: '50%',
        background: '#6366f1',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '12px',
        fontWeight: 600,
        flexShrink: 0,
    },
    dmInfo: {
        flex: 1,
        minWidth: 0,
    },
    dmName: {
        fontSize: '14px',
        fontWeight: 500,
        color: 'var(--textPrimary)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
    dmPreview: {
        fontSize: '12px',
        color: 'var(--textTertiary)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
    dmTime: {
        fontSize: '11px',
        color: 'var(--textTertiary)',
        flexShrink: 0,
    },
    chatArea: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
    },
    chatHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '12px 20px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bgSecondary)',
        flexShrink: 0,
        height: '56px',
    },
    chatHeaderTitle: {
        fontSize: '16px',
        fontWeight: 600,
        color: 'var(--textPrimary)',
    },
    chatHeaderSub: {
        fontSize: '12px',
        color: 'var(--textTertiary)',
    },
    messagesArea: {
        flex: 1,
        overflowY: 'auto',
        padding: '8px 0',
    },
    inputBar: {
        padding: '12px 16px',
        borderTop: '1px solid var(--border)',
        background: 'var(--bgPrimary)',
        flexShrink: 0,
    },
    inputForm: {
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
    },
    inputField: {
        flex: 1,
        padding: '10px 14px',
        border: '1px solid var(--inputBorder)',
        borderRadius: '8px',
        background: 'var(--inputBg)',
        color: 'var(--textPrimary)',
        fontSize: '14px',
        outline: 'none',
    },
    sendBtn: (disabled) => ({
        padding: '10px 16px',
        background: disabled ? 'var(--bgTertiary)' : 'var(--accent)',
        color: disabled ? 'var(--textTertiary)' : 'white',
        border: 'none',
        borderRadius: '8px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: '14px',
        fontWeight: 600,
        transition: 'background 0.15s',
        flexShrink: 0,
    }),
    emptyState: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: 'var(--textTertiary)',
        gap: '12px',
        padding: '40px',
        textAlign: 'center',
    },
    loadMoreBtn: {
        display: 'block',
        margin: '8px auto',
        padding: '6px 16px',
        background: 'var(--bgTertiary)',
        color: 'var(--textSecondary)',
        border: '1px solid var(--border)',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '12px',
    },
    modal: {
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
    },
    modalOverlay: {
        position: 'absolute',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
    },
    modalCard: {
        position: 'relative',
        width: '100%',
        maxWidth: '440px',
        background: 'var(--cardBg)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        boxShadow: 'var(--shadowLarge)',
        overflow: 'hidden',
    },
    modalHeader: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 20px',
        borderBottom: '1px solid var(--border)',
    },
    modalTitle: {
        fontSize: '16px',
        fontWeight: 600,
        color: 'var(--textPrimary)',
    },
    modalClose: {
        background: 'none',
        border: 'none',
        color: 'var(--textTertiary)',
        cursor: 'pointer',
        fontSize: '18px',
        padding: '4px',
    },
    modalBody: {
        padding: '16px 20px',
    },
    modalFooter: {
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '8px',
        padding: '12px 20px',
        borderTop: '1px solid var(--border)',
    },
    formLabel: {
        display: 'block',
        fontSize: '12px',
        fontWeight: 600,
        color: 'var(--textSecondary)',
        marginBottom: '4px',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
    },
    formInput: {
        width: '100%',
        padding: '8px 12px',
        border: '1px solid var(--inputBorder)',
        borderRadius: '8px',
        background: 'var(--inputBg)',
        color: 'var(--textPrimary)',
        fontSize: '14px',
        outline: 'none',
        boxSizing: 'border-box',
    },
    primaryBtn: (disabled) => ({
        padding: '8px 16px',
        background: disabled ? 'var(--bgTertiary)' : 'var(--accent)',
        color: disabled ? 'var(--textTertiary)' : 'white',
        border: 'none',
        borderRadius: '8px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: '13px',
        fontWeight: 600,
    }),
    secondaryBtn: {
        padding: '8px 16px',
        background: 'var(--bgTertiary)',
        color: 'var(--textSecondary)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '13px',
    },
    announcementCard: (priority) => ({
        padding: '16px 20px',
        marginBottom: '12px',
        borderRadius: '10px',
        background: 'var(--cardBg)',
        border: '1px solid var(--cardBorder)',
        borderLeft: `4px solid ${priority === 'urgent' ? '#ef4444' : priority === 'important' ? '#f59e0b' : '#6366f1'}`,
    }),
    badge: (color) => ({
        display: 'inline-block',
        fontSize: '10px',
        padding: '2px 8px',
        borderRadius: '10px',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.3px',
        color: 'white',
        background: color,
    }),
    sidebarBtn: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        width: 'calc(100% - 16px)',
        margin: '4px 8px',
        padding: '8px 12px',
        background: 'transparent',
        border: '1px dashed var(--border)',
        borderRadius: '6px',
        color: 'var(--textSecondary)',
        cursor: 'pointer',
        fontSize: '13px',
        transition: 'all 0.15s',
    },
    skeleton: {
        height: '60px',
        borderRadius: '8px',
        background: 'var(--bgTertiary)',
        animation: 'pulse 1.5s infinite',
        margin: '8px 16px',
    },
};

// ═══════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════
const Messages = () => {
    const { currentUser } = useAuth();
    const { committeeRole } = useCommittee();
    const [searchParams, setSearchParams] = useSearchParams();

    // Hooks
    const {
        channels, publicChannels, dmChannels,
        currentChannel, setCurrentChannel,
        loading: channelsLoading, createChannel, openDm, deleteChannel, refresh: refreshChannels,
    } = useChannels();

    const {
        messages, loading: messagesLoading, sending, error: messagesError,
        hasMore, sendMessage, editMessage, deleteMessage, loadMore,
    } = useMessages(
        currentChannel && currentChannel.type !== 'announcement' && currentChannel.slug !== 'announcements'
            ? currentChannel.id
            : null
    );

    const {
        announcements, loading: announcementsLoading,
        createAnnouncement, deleteAnnouncement,
    } = useAnnouncements();

    // State
    const [messageText, setMessageText] = useState('');
    const [showCreateChannel, setShowCreateChannel] = useState(false);
    const [showNewDm, setShowNewDm] = useState(false);
    const [showCreateAnnouncement, setShowCreateAnnouncement] = useState(false);
    const [members, setMembers] = useState([]);
    const [memberSearch, setMemberSearch] = useState('');
    const [membersLoading, setMembersLoading] = useState(false);

    // Channel creation form
    const [newChannelName, setNewChannelName] = useState('');
    const [newChannelDesc, setNewChannelDesc] = useState('');
    const [newChannelType, setNewChannelType] = useState('text');

    // Announcement creation form
    const [announcementTitle, setAnnouncementTitle] = useState('');
    const [announcementContent, setAnnouncementContent] = useState('');
    const [announcementPriority, setAnnouncementPriority] = useState('normal');

    // Refs for auto-scroll
    const messagesEndRef = useRef(null);
    const messagesAreaRef = useRef(null);
    const prevMessageCountRef = useRef(0);

    // Determine if announcements view is active
    const isAnnouncementsView = currentChannel &&
        (currentChannel.type === 'announcement' || currentChannel.slug === 'announcements');

    const canCreateChannels = ['head', 'admin', 'faculty'].includes(committeeRole);
    const canPostAnnouncements = ['head', 'admin', 'faculty'].includes(committeeRole);

    // ═══ Handle URL params (memberId for DM, tab for announcements) ═══
    useEffect(() => {
        const memberId = searchParams.get('memberId');
        const dmId = searchParams.get('dm');
        const tab = searchParams.get('tab');

        if (memberId && channels.length > 0) {
            openDm(memberId).then(() => {
                // Clear the param after opening
                setSearchParams({}, { replace: true });
            }).catch(err => console.error('Failed to open DM from URL:', err));
        }

        if (dmId && channels.length > 0) {
            const dmChannel = channels.find(c => c.id === dmId);
            if (dmChannel) {
                setCurrentChannel(dmChannel);
                setSearchParams({}, { replace: true });
            }
        }

        if (tab === 'announcements' && channels.length > 0) {
            const announcementChannel = channels.find(
                c => c.slug === 'announcements' || c.type === 'announcement'
            );
            if (announcementChannel) {
                setCurrentChannel(announcementChannel);
            }
            setSearchParams({}, { replace: true });
        }
    }, [searchParams, channels.length]);

    // ═══ Auto-scroll when new messages arrive ═══
    useEffect(() => {
        if (messages.length > prevMessageCountRef.current && messagesAreaRef.current) {
            const area = messagesAreaRef.current;
            const isNearBottom = area.scrollHeight - area.scrollTop - area.clientHeight < 200;
            if (isNearBottom) {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }
        }
        prevMessageCountRef.current = messages.length;
    }, [messages.length]);

    // ═══ Fetch members for DM modal ═══
    const fetchMembers = useCallback(async () => {
        setMembersLoading(true);
        try {
            const data = await api.get('/api/committees/members');
            if (data.members) {
                setMembers(data.members.map(m => ({
                    id: m.user_id || m.id,
                    name: m.name || m.email || 'Unknown',
                    email: m.email || '',
                    role: m.role || 'member',
                })).filter(m => m.id !== currentUser?.id));
            }
        } catch (err) {
            console.error('Failed to fetch members:', err);
        } finally {
            setMembersLoading(false);
        }
    }, [currentUser?.id]);

    // ═══ Group messages by sender ═══
    const groupedMessages = useMemo(() => {
        return messages.map((msg, idx) => {
            const prev = idx > 0 ? messages[idx - 1] : null;
            const showHeader = !prev ||
                prev.user_id !== msg.user_id ||
                (new Date(msg.created_at) - new Date(prev.created_at)) > 300000; // 5 min gap
            return { ...msg, showHeader };
        });
    }, [messages]);

    // ═══ SEND handler ═══
    const handleSend = async (e) => {
        e.preventDefault();
        const textToSend = messageText.trim();
        if (!textToSend) return;
        setMessageText('');
        try {
            await sendMessage(textToSend);
        } catch (err) {
            setMessageText(textToSend); // Restore on failure
        }
    };

    // ═══ CREATE CHANNEL handler ═══
    const handleCreateChannel = async () => {
        if (!newChannelName.trim()) return;
        try {
            await createChannel({
                name: newChannelName.trim(),
                description: newChannelDesc.trim(),
                type: newChannelType,
            });
            setNewChannelName('');
            setNewChannelDesc('');
            setNewChannelType('text');
            setShowCreateChannel(false);
        } catch (err) {
            console.error('Create channel failed:', err);
        }
    };

    // ═══ START DM handler ═══
    const handleStartDm = async (memberId) => {
        try {
            await openDm(memberId);
            setShowNewDm(false);
            setMemberSearch('');
        } catch (err) {
            console.error('Start DM failed:', err);
        }
    };

    // ═══ CREATE ANNOUNCEMENT handler ═══
    const handleCreateAnnouncement = async () => {
        if (!announcementTitle.trim() || !announcementContent.trim()) return;
        try {
            await createAnnouncement({
                title: announcementTitle.trim(),
                content: announcementContent.trim(),
                priority: announcementPriority,
            });
            setAnnouncementTitle('');
            setAnnouncementContent('');
            setAnnouncementPriority('normal');
            setShowCreateAnnouncement(false);
        } catch (err) {
            console.error('Create announcement failed:', err);
        }
    };

    // Filtered members for DM search
    const filteredMembers = members.filter(m =>
        m.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
        m.email.toLowerCase().includes(memberSearch.toLowerCase())
    );

    // ═══════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════
    return (
        <div style={S.page}>
            {/* ═══ SIDEBAR ═══ */}
            <div style={S.sidebar}>
                <div style={S.sidebarHeader}>💬 Messages</div>

                {/* Public Channels */}
                <div style={S.sectionLabel}>Channels</div>
                {channelsLoading ? (
                    <>
                        <div style={S.skeleton} />
                        <div style={S.skeleton} />
                    </>
                ) : (
                    publicChannels.map(ch => (
                        <div
                            key={ch.id}
                            style={S.channelItem(currentChannel?.id === ch.id)}
                            onClick={() => setCurrentChannel(ch)}
                            onMouseEnter={e => { if (currentChannel?.id !== ch.id) e.currentTarget.style.background = 'var(--bgHover)'; }}
                            onMouseLeave={e => { if (currentChannel?.id !== ch.id) e.currentTarget.style.background = 'transparent'; }}
                        >
                            <span style={S.channelIcon}>
                                {ch.type === 'announcement' ? '📢' : '#'}
                            </span>
                            <span style={S.channelName}>{ch.name}</span>
                        </div>
                    ))
                )}

                {/* DM Channels */}
                <div style={S.sectionLabel}>Direct Messages</div>
                {dmChannels.length === 0 && !channelsLoading && (
                    <div style={{ padding: '8px 16px', fontSize: '12px', color: 'var(--textTertiary)' }}>
                        No conversations yet
                    </div>
                )}
                {dmChannels.map(ch => (
                    <div
                        key={ch.id}
                        style={S.dmItem(currentChannel?.id === ch.id)}
                        onClick={() => setCurrentChannel(ch)}
                        onMouseEnter={e => { if (currentChannel?.id !== ch.id) e.currentTarget.style.background = 'var(--bgHover)'; }}
                        onMouseLeave={e => { if (currentChannel?.id !== ch.id) e.currentTarget.style.background = 'transparent'; }}
                    >
                        <div style={S.dmAvatar}>
                            {(ch.dm_user?.name || ch.display_name || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div style={S.dmInfo}>
                            <div style={S.dmName}>
                                {ch.dm_user?.name || ch.display_name || 'Unknown'}
                            </div>
                            {ch.last_message_preview && (
                                <div style={S.dmPreview}>
                                    {ch.last_message_preview.substring(0, 30)}
                                    {ch.last_message_preview.length > 30 ? '…' : ''}
                                </div>
                            )}
                        </div>
                        {ch.last_message_at && (
                            <span style={S.dmTime}>
                                {formatRelativeTime(ch.last_message_at)}
                            </span>
                        )}
                    </div>
                ))}

                {/* Action buttons */}
                <div style={{ marginTop: 'auto', padding: '8px 0 12px' }}>
                    {canCreateChannels && (
                        <button
                            style={S.sidebarBtn}
                            onClick={() => setShowCreateChannel(true)}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--textSecondary)'; }}
                        >
                            ＋ New Channel
                        </button>
                    )}
                    <button
                        style={S.sidebarBtn}
                        onClick={() => { setShowNewDm(true); fetchMembers(); }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--textSecondary)'; }}
                    >
                        ✉ New Message
                    </button>
                </div>
            </div>

            {/* ═══ CHAT AREA ═══ */}
            <div style={S.chatArea}>
                {!currentChannel ? (
                    <div style={S.emptyState}>
                        <span style={{ fontSize: '48px' }}>💬</span>
                        <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--textPrimary)' }}>
                            Welcome to Messages
                        </h3>
                        <p style={{ color: 'var(--textSecondary)', maxWidth: '300px' }}>
                            Select a channel from the sidebar or start a new conversation
                        </p>
                    </div>
                ) : isAnnouncementsView ? (
                    /* ═══ ANNOUNCEMENTS VIEW ═══ */
                    <>
                        <div style={S.chatHeader}>
                            <span style={{ fontSize: '20px' }}>📢</span>
                            <div>
                                <div style={S.chatHeaderTitle}>Announcements</div>
                                <div style={S.chatHeaderSub}>
                                    Important updates from faculty and committee heads
                                </div>
                            </div>
                            <div style={{ marginLeft: 'auto' }}>
                                {canPostAnnouncements && (
                                    <button
                                        style={S.primaryBtn(false)}
                                        onClick={() => setShowCreateAnnouncement(true)}
                                    >
                                        ＋ New Announcement
                                    </button>
                                )}
                            </div>
                        </div>

                        <div style={{ ...S.messagesArea, padding: '16px 24px' }}>
                            {announcementsLoading ? (
                                <>
                                    <div style={{ ...S.skeleton, height: '100px' }} />
                                    <div style={{ ...S.skeleton, height: '100px' }} />
                                </>
                            ) : announcements.length === 0 ? (
                                <div style={S.emptyState}>
                                    <span style={{ fontSize: '48px' }}>🔔</span>
                                    <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--textPrimary)' }}>
                                        No announcements yet
                                    </h3>
                                    <p style={{ color: 'var(--textSecondary)', maxWidth: '300px' }}>
                                        Announcements from faculty and committee heads will appear here.
                                    </p>
                                    {canPostAnnouncements && (
                                        <button
                                            style={S.primaryBtn(false)}
                                            onClick={() => setShowCreateAnnouncement(true)}
                                        >
                                            Create First Announcement
                                        </button>
                                    )}
                                </div>
                            ) : (
                                announcements.map(a => (
                                    <div key={a.id} style={S.announcementCard(a.priority)}>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            marginBottom: '8px',
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{
                                                    fontSize: '14px',
                                                    fontWeight: 600,
                                                    color: 'var(--textPrimary)',
                                                }}>
                                                    {a.author_name || a.created_by_name || 'Unknown'}
                                                </span>
                                                {a.created_by_role && (
                                                    <span style={S.badge(ROLE_COLORS[a.created_by_role] || '#6b7280')}>
                                                        {ROLE_LABELS[a.created_by_role] || a.created_by_role}
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                {a.priority && a.priority !== 'normal' && (
                                                    <span style={S.badge(
                                                        a.priority === 'urgent' ? '#ef4444' :
                                                            a.priority === 'important' ? '#f59e0b' : '#3b82f6'
                                                    )}>
                                                        {a.priority}
                                                    </span>
                                                )}
                                                <span style={{
                                                    fontSize: '12px',
                                                    color: 'var(--textTertiary)',
                                                }}>
                                                    {formatRelativeTime(a.created_at)}
                                                </span>
                                                {(a.created_by === currentUser?.id || ['head', 'admin'].includes(committeeRole)) && (
                                                    <button
                                                        onClick={() => deleteAnnouncement(a.id)}
                                                        style={{
                                                            background: 'none',
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                            fontSize: '14px',
                                                            color: 'var(--textTertiary)',
                                                        }}
                                                        title="Delete"
                                                    >🗑️</button>
                                                )}
                                            </div>
                                        </div>
                                        <h4 style={{
                                            fontSize: '15px',
                                            fontWeight: 600,
                                            color: 'var(--textPrimary)',
                                            marginBottom: '6px',
                                        }}>
                                            {a.title}
                                        </h4>
                                        <p style={{
                                            fontSize: '14px',
                                            lineHeight: 1.6,
                                            color: 'var(--textSecondary)',
                                            whiteSpace: 'pre-wrap',
                                        }}>
                                            {a.content}
                                        </p>
                                    </div>
                                ))
                            )}
                        </div>
                    </>
                ) : (
                    /* ═══ NORMAL CHAT VIEW ═══ */
                    <>
                        <div style={S.chatHeader}>
                            <span style={{ fontSize: '20px' }}>
                                {currentChannel.type === 'dm' ? '👤' : '#'}
                            </span>
                            <div>
                                <div style={S.chatHeaderTitle}>
                                    {currentChannel.type === 'dm'
                                        ? (currentChannel.dm_user?.name || currentChannel.display_name || currentChannel.name)
                                        : currentChannel.name
                                    }
                                </div>
                                {currentChannel.description && (
                                    <div style={S.chatHeaderSub}>
                                        {currentChannel.description}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div ref={messagesAreaRef} style={S.messagesArea}>
                            {messagesLoading ? (
                                <>
                                    <div style={S.skeleton} />
                                    <div style={S.skeleton} />
                                    <div style={S.skeleton} />
                                </>
                            ) : messagesError ? (
                                <div style={S.emptyState}>
                                    <span style={{ fontSize: '32px' }}>⚠️</span>
                                    <p style={{ color: 'var(--error)' }}>{messagesError}</p>
                                    <button
                                        style={S.secondaryBtn}
                                        onClick={() => window.location.reload()}
                                    >
                                        Retry
                                    </button>
                                </div>
                            ) : messages.length === 0 ? (
                                <div style={S.emptyState}>
                                    <span style={{ fontSize: '48px' }}>
                                        {currentChannel.type === 'dm' ? '💬' : '📝'}
                                    </span>
                                    <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--textPrimary)' }}>
                                        {currentChannel.type === 'dm'
                                            ? 'Start your conversation'
                                            : `Welcome to #${currentChannel.name}`
                                        }
                                    </h3>
                                    <p style={{ color: 'var(--textSecondary)' }}>
                                        {currentChannel.type === 'dm'
                                            ? 'Send a message to begin chatting'
                                            : 'Be the first to send a message in this channel'
                                        }
                                    </p>
                                </div>
                            ) : (
                                <>
                                    {hasMore && (
                                        <button style={S.loadMoreBtn} onClick={loadMore}>
                                            ↑ Load older messages
                                        </button>
                                    )}
                                    {groupedMessages.map(msg => (
                                        <MessageItem
                                            key={msg.id}
                                            message={msg}
                                            showHeader={msg.showHeader}
                                            isOwnMessage={msg.user_id === currentUser?.id}
                                            onEdit={editMessage}
                                            onDelete={deleteMessage}
                                        />
                                    ))}
                                    <div ref={messagesEndRef} />
                                </>
                            )}
                        </div>

                        {/* Input bar */}
                        <div style={S.inputBar}>
                            <form style={S.inputForm} onSubmit={handleSend}>
                                <input
                                    style={S.inputField}
                                    value={messageText}
                                    onChange={e => setMessageText(e.target.value)}
                                    placeholder={
                                        currentChannel.type === 'dm'
                                            ? `Message ${currentChannel.dm_user?.name || currentChannel.display_name || ''}…`
                                            : `Message #${currentChannel.name}…`
                                    }
                                    disabled={sending}
                                />
                                <button
                                    type="submit"
                                    style={S.sendBtn(!messageText.trim() || sending)}
                                    disabled={!messageText.trim() || sending}
                                >
                                    {sending ? '⏳' : 'Send'}
                                </button>
                            </form>
                        </div>
                    </>
                )}
            </div>

            {/* ═══ CREATE CHANNEL MODAL ═══ */}
            {showCreateChannel && (
                <div style={S.modal}>
                    <div style={S.modalOverlay} onClick={() => setShowCreateChannel(false)} />
                    <div style={S.modalCard}>
                        <div style={S.modalHeader}>
                            <span style={S.modalTitle}>Create Channel</span>
                            <button style={S.modalClose} onClick={() => setShowCreateChannel(false)}>✕</button>
                        </div>
                        <div style={S.modalBody}>
                            <div style={{ marginBottom: '12px' }}>
                                <label style={S.formLabel}>Channel Name</label>
                                <input
                                    style={S.formInput}
                                    value={newChannelName}
                                    onChange={e => setNewChannelName(e.target.value)}
                                    placeholder="e.g. events"
                                    autoFocus
                                />
                            </div>
                            <div style={{ marginBottom: '12px' }}>
                                <label style={S.formLabel}>Description (optional)</label>
                                <input
                                    style={S.formInput}
                                    value={newChannelDesc}
                                    onChange={e => setNewChannelDesc(e.target.value)}
                                    placeholder="What's this channel about?"
                                />
                            </div>
                            <div>
                                <label style={S.formLabel}>Type</label>
                                <select
                                    style={{ ...S.formInput, cursor: 'pointer' }}
                                    value={newChannelType}
                                    onChange={e => setNewChannelType(e.target.value)}
                                >
                                    <option value="text">Text Channel</option>
                                    <option value="announcement">Announcement Channel</option>
                                </select>
                            </div>
                        </div>
                        <div style={S.modalFooter}>
                            <button style={S.secondaryBtn} onClick={() => setShowCreateChannel(false)}>Cancel</button>
                            <button
                                style={S.primaryBtn(!newChannelName.trim())}
                                onClick={handleCreateChannel}
                                disabled={!newChannelName.trim()}
                            >
                                Create
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ NEW DM MODAL ═══ */}
            {showNewDm && (
                <div style={S.modal}>
                    <div style={S.modalOverlay} onClick={() => { setShowNewDm(false); setMemberSearch(''); }} />
                    <div style={S.modalCard}>
                        <div style={S.modalHeader}>
                            <span style={S.modalTitle}>New Message</span>
                            <button style={S.modalClose} onClick={() => { setShowNewDm(false); setMemberSearch(''); }}>✕</button>
                        </div>
                        <div style={S.modalBody}>
                            <input
                                style={{ ...S.formInput, marginBottom: '12px' }}
                                value={memberSearch}
                                onChange={e => setMemberSearch(e.target.value)}
                                placeholder="Search members…"
                                autoFocus
                            />
                            <div style={{
                                maxHeight: '300px',
                                overflowY: 'auto',
                            }}>
                                {membersLoading ? (
                                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--textTertiary)' }}>
                                        Loading members…
                                    </div>
                                ) : filteredMembers.length === 0 ? (
                                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--textTertiary)' }}>
                                        {memberSearch ? 'No members found' : 'No other members in this committee'}
                                    </div>
                                ) : (
                                    filteredMembers.map(m => (
                                        <div
                                            key={m.id}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '10px',
                                                padding: '10px 8px',
                                                cursor: 'pointer',
                                                borderRadius: '6px',
                                                transition: 'background 0.15s',
                                            }}
                                            onClick={() => handleStartDm(m.id)}
                                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bgHover)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <div style={{
                                                width: '32px',
                                                height: '32px',
                                                borderRadius: '50%',
                                                background: '#6366f1',
                                                color: 'white',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '13px',
                                                fontWeight: 600,
                                            }}>
                                                {m.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{
                                                    fontSize: '14px',
                                                    fontWeight: 500,
                                                    color: 'var(--textPrimary)',
                                                }}>
                                                    {m.name}
                                                </div>
                                                <div style={{
                                                    fontSize: '12px',
                                                    color: 'var(--textTertiary)',
                                                }}>
                                                    {m.email}
                                                </div>
                                            </div>
                                            <span style={S.badge(ROLE_COLORS[m.role] || '#6b7280')}>
                                                {ROLE_LABELS[m.role] || m.role}
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ CREATE ANNOUNCEMENT MODAL ═══ */}
            {showCreateAnnouncement && (
                <div style={S.modal}>
                    <div style={S.modalOverlay} onClick={() => setShowCreateAnnouncement(false)} />
                    <div style={S.modalCard}>
                        <div style={S.modalHeader}>
                            <span style={S.modalTitle}>📢 New Announcement</span>
                            <button style={S.modalClose} onClick={() => setShowCreateAnnouncement(false)}>✕</button>
                        </div>
                        <div style={S.modalBody}>
                            <div style={{ marginBottom: '12px' }}>
                                <label style={S.formLabel}>Title</label>
                                <input
                                    style={S.formInput}
                                    value={announcementTitle}
                                    onChange={e => setAnnouncementTitle(e.target.value)}
                                    placeholder="Announcement title"
                                    autoFocus
                                />
                            </div>
                            <div style={{ marginBottom: '12px' }}>
                                <label style={S.formLabel}>Content</label>
                                <textarea
                                    style={{
                                        ...S.formInput,
                                        resize: 'vertical',
                                        minHeight: '120px',
                                        fontFamily: 'inherit',
                                    }}
                                    value={announcementContent}
                                    onChange={e => setAnnouncementContent(e.target.value)}
                                    placeholder="Write your announcement…"
                                    rows={6}
                                />
                            </div>
                            <div>
                                <label style={S.formLabel}>Priority</label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    {[
                                        { val: 'normal', label: 'Normal', color: '#6366f1' },
                                        { val: 'important', label: 'Important', color: '#f59e0b' },
                                        { val: 'urgent', label: 'Urgent', color: '#ef4444' },
                                    ].map(p => (
                                        <button
                                            key={p.val}
                                            type="button"
                                            style={{
                                                flex: 1,
                                                padding: '8px',
                                                border: announcementPriority === p.val
                                                    ? `2px solid ${p.color}`
                                                    : '1px solid var(--border)',
                                                borderRadius: '8px',
                                                background: announcementPriority === p.val
                                                    ? `${p.color}15`
                                                    : 'var(--bgTertiary)',
                                                color: announcementPriority === p.val
                                                    ? p.color
                                                    : 'var(--textSecondary)',
                                                cursor: 'pointer',
                                                fontSize: '13px',
                                                fontWeight: 600,
                                                transition: 'all 0.15s',
                                            }}
                                            onClick={() => setAnnouncementPriority(p.val)}
                                        >
                                            {p.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div style={S.modalFooter}>
                            <button style={S.secondaryBtn} onClick={() => setShowCreateAnnouncement(false)}>
                                Cancel
                            </button>
                            <button
                                style={S.primaryBtn(!announcementTitle.trim() || !announcementContent.trim())}
                                onClick={handleCreateAnnouncement}
                                disabled={!announcementTitle.trim() || !announcementContent.trim()}
                            >
                                Publish
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Keyframe animation for skeleton */}
            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 0.4; }
                    50% { opacity: 0.7; }
                }
            `}</style>
        </div>
    );
};

export default Messages;
