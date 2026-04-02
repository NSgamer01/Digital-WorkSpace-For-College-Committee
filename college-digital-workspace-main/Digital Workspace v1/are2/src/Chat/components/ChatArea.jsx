import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';
import { subscribeChatRooms, subscribeMessages, sendMessage, deleteMessageForEveryone, editMessage, markMessageSeen, createChat } from '../../services/chatService';
import {
    subscribeAnnouncements,
    publishAnnouncement,
    deleteAnnouncement,
} from '../../services/announcementService';
import { supabase } from '../../services/supabaseClient';
import EmojiPicker, { Theme } from 'emoji-picker-react';

// ── Helpers ─────────────────────────────────────────────────────
const getUserName = (data) => data?.name || data?.displayName || data?.email || 'User';

const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
};

const formatTime = (ts) => {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return formatMessageTime(d);
};

// ── Relative timestamp formatter ────────────────────────────────
function formatMessageTime(date) {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) return '';
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    return new Intl.DateTimeFormat('en-US', {
        month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit', hour12: true,
    }).format(date);
}

const formatDate = (ts) => {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' });
};

const isSameDay = (a, b) => {
    if (!a || !b) return false;
    const da = a.toDate ? a.toDate() : new Date(a);
    const db2 = b.toDate ? b.toDate() : new Date(b);
    return da.toDateString() === db2.toDateString();
};


// ═════════════════════════════════════════════════════════════════
//  WHATSAPP-STYLE MESSAGE BUBBLE (unified for all types)
// ═════════════════════════════════════════════════════════════════
const MessageBubble = ({ msg, prevMsg, userMap, currentUserId, isAnnouncement, onDelete, canDelete, chatId }) => {
    const isOwn = msg.senderId === currentUserId;
    const sameAuthor = prevMsg && prevMsg.senderId === msg.senderId && !msg._newDay && !isAnnouncement;
    const senderName = getUserName(userMap[msg.senderId]) || msg.senderName || 'Unknown';
    const senderRole = userMap[msg.senderId]?.role;
    const [showActions, setShowActions] = useState(false);
    const [editing, setEditing] = useState(false);
    const [editText, setEditText] = useState(msg.text || '');
    const actionsRef = useRef(null);

    // Close actions menu on outside click
    useEffect(() => {
        const handler = (e) => {
            if (actionsRef.current && !actionsRef.current.contains(e.target)) setShowActions(false);
        };
        if (showActions) document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showActions]);

    // Check if message is within 7-hour edit window
    const canEdit = () => {
        if (!isOwn || msg.deleted || msg.type === 'file') return false;
        const created = msg.createdAt?.toDate?.() || new Date(0);
        return (Date.now() - created.getTime()) / (1000 * 60 * 60) <= 7;
    };

    const handleEdit = async () => {
        if (!editText.trim() || editText === msg.text) { setEditing(false); return; }
        try {
            await editMessage(chatId, msg.id, editText.trim());
            setEditing(false);
        } catch (err) { alert(err.message); }
    };

    const handleDeleteForEveryone = async () => {
        if (!window.confirm('Delete this message for everyone?')) return;
        setShowActions(false);
        try { await deleteMessageForEveryone(chatId, msg.id); }
        catch (err) { console.error('Delete failed:', err); }
    };

    // Read receipt indicator (for own messages)
    const getReadStatus = () => {
        if (!isOwn || isAnnouncement || !msg.readBy) return null;
        const othersSeen = msg.readBy.filter(uid => uid !== currentUserId).length;
        return othersSeen > 0 ? 'seen' : 'sent';
    };
    const readStatus = getReadStatus();

    // ── Deleted message ──
    if (msg.deleted) {
        return (
            <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-3`}>
                <div className={`flex items-end gap-2 max-w-[60%] ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                    {!sameAuthor ? (
                        <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white ${isOwn ? 'bg-gradient-to-br from-purple-600 to-indigo-600' : 'bg-gradient-to-br from-zinc-600 to-zinc-700'}`}>
                            {getInitials(senderName)}
                        </div>
                    ) : <div className="w-8 flex-shrink-0" />}
                    <div>
                        <div className={`mt-1 px-4 py-2 text-sm rounded-2xl ${isOwn ? 'bg-zinc-800/50 rounded-br-sm' : 'bg-zinc-800/50 rounded-bl-sm'}`}>
                            <span className="text-zinc-500 italic">🚫 This message was deleted</span>
                        </div>
                        <div className={`flex items-center gap-2 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                            <span className="text-xs text-gray-600">{formatTime(msg.createdAt || msg.timestamp)}</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-4 group`}>
            <div className={`flex items-end gap-2 max-w-[60%] ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>

                {/* Avatar */}
                {!sameAuthor ? (
                    <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white ${isOwn ? 'bg-gradient-to-br from-purple-600 to-indigo-600' : 'bg-gradient-to-br from-zinc-600 to-zinc-700'}`}>
                        {getInitials(senderName)}
                    </div>
                ) : (
                    <div className="w-8 flex-shrink-0" />
                )}

                <div className="relative">
                    {/* Name + role */}
                    {!isOwn && !sameAuthor && (
                        <div className="text-sm font-medium flex items-center gap-2 mb-0.5">
                            <span className="text-zinc-400">{senderName}</span>
                            {senderRole && (
                                <span className="text-[10px] px-2 py-0.5 rounded bg-gray-700 text-zinc-400 uppercase font-semibold">{senderRole}</span>
                            )}
                        </div>
                    )}

                    {/* Actions menu (hover ⋮ on own messages) */}
                    {isOwn && !editing && chatId && (
                        <div ref={actionsRef} className="absolute -left-8 top-1 z-10">
                            <button
                                onClick={() => setShowActions(!showActions)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500 hover:text-zinc-300 text-sm p-1 rounded hover:bg-zinc-700/50"
                            >⋮</button>
                            {showActions && (
                                <div className="absolute right-0 top-6 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 min-w-[170px] z-50">
                                    {canEdit() && (
                                        <button onClick={() => { setEditing(true); setEditText(msg.text || ''); setShowActions(false); }}
                                            className="w-full text-left px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-700 flex items-center gap-2">
                                            ✏️ Edit message
                                        </button>
                                    )}
                                    <button onClick={handleDeleteForEveryone}
                                        className="w-full text-left px-3 py-1.5 text-sm text-red-400 hover:bg-zinc-700 flex items-center gap-2">
                                        🗑️ Delete for everyone
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Bubble — edit mode or normal */}
                    {editing ? (
                        <div className="mt-1 bg-zinc-800 border border-indigo-500/50 rounded-2xl px-3 py-2">
                            <textarea
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                className="w-full bg-transparent text-sm text-white outline-none resize-none min-w-[200px]"
                                rows={2} autoFocus
                                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEdit(); } if (e.key === 'Escape') setEditing(false); }}
                            />
                            <div className="flex gap-2 justify-end mt-1">
                                <button onClick={() => setEditing(false)} className="text-xs text-zinc-500 hover:text-zinc-300">Cancel</button>
                                <button onClick={handleEdit} className="text-xs text-indigo-400 hover:text-indigo-300 font-medium">Save</button>
                            </div>
                        </div>
                    ) : (
                        <div className={`mt-1 text-sm leading-relaxed ${msg.type === 'file' && msg.fileType?.startsWith('image/')
                            ? `overflow-hidden ${isOwn ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl rounded-br-sm' : 'bg-[#1f1f23] text-gray-200 rounded-2xl rounded-bl-sm'}`
                            : `px-4 py-2 ${isOwn ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl rounded-br-sm' : 'bg-[#1f1f23] text-gray-200 rounded-2xl rounded-bl-sm'}`
                            }`}>
                            {/* Announcement tag */}
                            {isAnnouncement && (
                                <div className={`text-[10px] font-semibold text-purple-400 uppercase tracking-wider mb-1 ${msg.type === 'file' && msg.fileType?.startsWith('image/') ? 'px-4 pt-2' : ''}`}>
                                    📣 ANNOUNCEMENT
                                </div>
                            )}

                            {/* Title */}
                            {isAnnouncement && msg.title && (
                                <div className={`font-semibold mb-1 ${msg.type === 'file' && msg.fileType?.startsWith('image/') ? 'px-4' : ''}`}>{msg.title}</div>
                            )}

                            {/* Text */}
                            {msg.text && <div className={msg.type === 'file' && msg.fileType?.startsWith('image/') ? 'px-4 pt-2' : ''}>{msg.text}</div>}
                            {!msg.text && msg.description && <div className={msg.type === 'file' && msg.fileType?.startsWith('image/') ? 'px-4 pt-2' : ''}>{msg.description}</div>}

                            {/* File (Supabase) */}
                            {msg.type === 'file' && msg.fileUrl && (
                                <div className="mt-1">
                                    {msg.fileType?.startsWith('image/') ? (
                                        <img src={msg.fileUrl} alt={msg.fileName}
                                            className="w-full max-w-[300px] cursor-pointer hover:opacity-90 transition-opacity"
                                            onClick={() => window.open(msg.fileUrl, '_blank')}
                                            onError={(e) => { e.target.style.display = 'none'; e.target.insertAdjacentHTML('afterend', '<span class="px-4 py-2 text-zinc-500 text-xs italic">🚧 File no longer available</span>'); }}
                                        />
                                    ) : msg.fileType?.startsWith('video/') ? (
                                        <video src={msg.fileUrl} controls className="max-w-full rounded-lg" />
                                    ) : (
                                        <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer"
                                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${isOwn ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'}`}>
                                            <span className="text-lg">📎</span>
                                            <span className="truncate max-w-[200px]">{msg.fileName || 'Attachment'}</span>
                                        </a>
                                    )}
                                </div>
                            )}

                            {/* Legacy media */}
                            {msg.mediaUrl && (
                                <div className="mt-2 rounded-lg overflow-hidden max-w-xs">
                                    {msg.mediaType === 'image' ? (
                                        <img src={msg.mediaUrl} alt="" className="w-full rounded-lg" />
                                    ) : msg.mediaType === 'video' ? (
                                        <video src={msg.mediaUrl} controls className="w-full rounded-lg" />
                                    ) : (
                                        <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-300 text-xs hover:underline">📎 {msg.mediaFileName || 'Attachment'}</a>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Timestamp + edited + read receipts */}
                    <div className={`flex items-center gap-1.5 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                        <span className="text-xs text-gray-500">{formatTime(msg.createdAt || msg.timestamp)}</span>
                        {msg.edited && <span className="text-[10px] text-zinc-600 italic">edited</span>}
                        {readStatus === 'seen' && <span className="text-xs text-blue-400" title="Seen">✓✓</span>}
                        {readStatus === 'sent' && <span className="text-xs text-zinc-500" title="Sent">✓</span>}
                        {isAnnouncement && canDelete && (
                            <button
                                onClick={() => onDelete(msg.id)}
                                className="text-xs text-gray-500 hover:text-red-400 transition-colors cursor-pointer ml-1"
                            >🗑</button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};


// ═════════════════════════════════════════════════════════════════
//  INLINE ANNOUNCEMENT COMPOSER (simplified)
// ═════════════════════════════════════════════════════════════════
const InlineAnnouncementComposer = ({ onPublish, onCancel }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [publishing, setPublishing] = useState(false);
    const titleRef = useRef(null);

    useEffect(() => { titleRef.current?.focus(); }, []);

    const handlePublish = async () => {
        if (!title.trim()) return;
        setPublishing(true);
        try {
            await onPublish({ title: title.trim(), description: description.trim() });
            setTitle(''); setDescription('');
        } catch (err) { console.error('Error publishing:', err); }
        finally { setPublishing(false); }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey && title.trim()) { e.preventDefault(); handlePublish(); }
        if (e.key === 'Escape') onCancel();
    };

    return (
        <div className="mx-4 mb-3 rounded-xl border border-indigo-500/20 bg-zinc-900/60 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
                <span className="text-xs font-bold text-indigo-400">📣 New Announcement</span>
                <button onClick={onCancel} className="text-zinc-500 hover:text-white text-sm cursor-pointer">✕</button>
            </div>
            <div className="p-3">
                <input ref={titleRef} type="text" placeholder="Title..."
                    value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={handleKeyDown}
                    className="w-full bg-transparent border-none outline-none text-white text-sm font-semibold placeholder-zinc-500 mb-2"
                />
                <textarea placeholder="Description (optional)..." value={description}
                    onChange={(e) => setDescription(e.target.value)} rows={2}
                    className="w-full bg-transparent border-none outline-none text-zinc-300 text-sm resize-none placeholder-zinc-600"
                />
                <div className="flex justify-end mt-2">
                    <button onClick={handlePublish} disabled={!title.trim() || publishing}
                        className="px-4 py-1.5 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors">
                        {publishing ? '…' : '📣 Publish'}
                    </button>
                </div>
            </div>
        </div>
    );
};


// ═════════════════════════════════════════════════════════════════
//  MAIN CHAT AREA
// ═════════════════════════════════════════════════════════════════
const ChatArea = ({ activeChannel, channelConfig, dmPartner, showMembers, toggleMembers }) => {
    const [messages, setMessages] = useState([]);
    const [announcements, setAnnouncements] = useState([]);
    const [chatId, setChatId] = useState(null);
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [showComposer, setShowComposer] = useState(false);
    const [userMap, setUserMap] = useState({});
    const [userRole, setUserRole] = useState('member');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const messagesEndRef = useRef(null);
    const textareaRef = useRef(null);
    const fileInputRef = useRef(null);
    const [uploading, setUploading] = useState(false);
    const { user: authUser, firebaseUser } = useAuth();
    const currentUserId = authUser?.id;
    const currentUserUid = firebaseUser?.uid || authUser?.firebase_uid;

    // Auto-mark messages as seen
    useEffect(() => {
        if (!chatId || !currentUserId || !messages.length) return;
        const unread = messages.filter(m =>
            m.senderId !== currentUserId &&
            m.readBy && !m.readBy.includes(currentUserId)
        );
        unread.forEach(m => {
            markMessageSeen(chatId, m.id, currentUserId).catch(() => { });
        });
    }, [messages, chatId, currentUserId]);

    // Fetch users from backend
    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const data = await api.get('/api/committees/members');
                const map = {};
                (data.members || []).forEach(m => {
                    const id = m.user_id || m.id;
                    map[id] = { ...m, displayName: getUserName(m), name: m.name };
                });
                setUserMap(map);
                if (currentUserId && map[currentUserId]) {
                    setUserRole(map[currentUserId].role || map[currentUserId].position || 'member');
                }
            } catch (err) { console.error('Error fetching users:', err); }
        };
        fetchUsers();
    }, [currentUserId]);

    // Find chat document using chatService
    useEffect(() => {
        if (activeChannel === 'announcement') { setChatId(null); return; }

        const unsub = subscribeChatRooms((rooms) => {
            if (activeChannel.startsWith('dm-') && dmPartner) {
                const match = rooms.find(r =>
                    r.type === 'direct' &&
                    r.participants?.includes(currentUserId) &&
                    r.participants?.includes(dmPartner.id)
                );
                setChatId(match?.id || null);
            } else {
                const typeMap = { generalChat: 'general' };
                const channelType = typeMap[activeChannel] || activeChannel;
                const match = rooms.find(r => r.type === channelType);
                setChatId(match?.id || null);
            }
        });
        return () => unsub();
    }, [activeChannel, dmPartner, currentUserId]);

    // Subscribe to messages / announcements
    useEffect(() => {
        if (activeChannel === 'announcement') {
            const unsub = subscribeAnnouncements((items) => {
                setAnnouncements(items.filter(a => !a.deleted));
                setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
            });
            return () => unsub();
        }
        if (!chatId) { setMessages([]); return; }
        const unsub = subscribeMessages(chatId, (msgs) => {
            setMessages(msgs);
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        });
        return () => unsub();
    }, [chatId, activeChannel]);

    // Send message
    const handleSend = async () => {
        const text = message.trim();
        if (!text || sending) return;
        const savedMessage = message;
        setMessage(''); // Clear immediately
        const currentDisplayName = getUserName(userMap[currentUserId]) || authUser?.name || authUser?.email || 'User';

        if (activeChannel.startsWith('dm-') && !chatId && dmPartner) {
            setSending(true);
            try {
                const docRef = await createChat({ type: 'direct', participants: [currentUserId, dmPartner.id], createdBy: currentUserId });
                await sendMessage(docRef.id, { senderId: currentUserId, senderName: currentDisplayName, text });
            } catch (err) {
                console.error('Error creating DM:', err);
                setMessage(savedMessage); // Restore on error
            }
            finally { setSending(false); }
            return;
        }
        if (!chatId) { setMessage(savedMessage); return; }
        setSending(true);
        try {
            await sendMessage(chatId, { senderId: currentUserId, senderName: currentDisplayName, text });
        } catch (err) {
            console.error('Error sending:', err);
            setMessage(savedMessage); // Restore on error
        }
        finally { setSending(false); }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    };

    // ── File upload via Supabase ─────────────────────────────────
    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !currentUserId || uploading) return;

        // Validate size (max 25MB)
        if (file.size > 25 * 1024 * 1024) {
            alert('File too large. Maximum size is 25MB.');
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        setUploading(true);
        try {
            const uploadPath = activeChannel === 'announcement' ? 'announcements' : (chatId || 'general');
            const filePath = `chat/${uploadPath}/${Date.now()}_${file.name}`;

            const { error } = await supabase.storage
                .from('chat-files')
                .upload(filePath, file);

            if (error) throw error;

            const { data } = supabase.storage
                .from('chat-files')
                .getPublicUrl(filePath);

            const fileUrl = data.publicUrl;
            const currentDisplayName = getUserName(userMap[currentUserId]) || authUser?.name || authUser?.email || 'User';

            if (activeChannel === 'announcement') {
                // Upload file as announcement
                await publishAnnouncement({
                    senderId: currentUserId,
                    senderName: currentDisplayName,
                    title: file.name,
                    description: '',
                    category: 'general',
                    pinned: false,
                    notifyAll: false,
                    type: 'file',
                    fileName: file.name,
                    fileUrl,
                    fileType: file.type,
                });
            } else {
                if (!chatId) {
                    alert('Please select a chat first.');
                    if (fileInputRef.current) fileInputRef.current.value = '';
                    setUploading(false);
                    return;
                }
                await sendMessage(chatId, {
                    senderId: currentUserId,
                    senderName: currentDisplayName,
                    text: '',
                    type: 'file',
                    fileName: file.name,
                    fileUrl,
                    fileType: file.type,
                });
            }

            console.log('✅ File uploaded:', file.name);
        } catch (err) {
            console.error('❌ File upload failed:', err);
            alert('File upload failed. Please try again.');
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
        }
    }, [message]);

    // Publish announcement
    const handlePublishAnnouncement = async (data) => {
        if (!currentUserId) return;
        const displayName = getUserName(userMap[currentUserId]) || authUser?.name || authUser?.email || 'Unknown';
        await publishAnnouncement({
            senderId: currentUserId,
            senderName: displayName,
            title: data.title,
            description: data.description || '',
            category: 'general',
            pinned: false,
            notifyAll: false,
        });
        setShowComposer(false);
    };

    const handleDeleteAnn = async (annId) => {
        if (!window.confirm('Delete this announcement?')) return;
        try { await deleteAnnouncement(annId); }
        catch (err) { console.error('Error:', err); }
    };

    const getHeaderInfo = () => {
        if (activeChannel.startsWith('dm-') && dmPartner) {
            const partnerName = getUserName(userMap[dmPartner.id]) || dmPartner.displayName || 'User';
            return { prefix: '@', name: partnerName, desc: 'Direct message' };
        }
        if (channelConfig) return { prefix: channelConfig.icon || '#', name: channelConfig.name, desc: channelConfig.description || '' };
        return { prefix: '#', name: 'general', desc: '' };
    };

    const headerInfo = getHeaderInfo();
    const canPostAnnouncement = ['admin', 'head', 'faculty'].includes(userRole);
    const canDeleteAnn = (ann) => ann.senderId === currentUserId || ['admin', 'head'].includes(userRole);

    // Build messages with date dividers
    const buildChatItems = () => {
        const source = activeChannel === 'announcement' ? announcements : messages;
        const items = [];
        source.forEach((msg, i) => {
            const prev = source[i - 1];
            const ts = msg.createdAt || msg.timestamp;
            const prevTs = prev?.createdAt || prev?.timestamp;
            if (!prev || !isSameDay(prevTs, ts)) {
                items.push({ _type: 'date', date: ts });
            }
            items.push(msg);
        });
        return items;
    };

    const chatItems = buildChatItems();

    return (
        <div className="msg-chat">
            {/* Header */}
            <div className="msg-chat-header">
                <div className="ch-info">
                    <span className="ch-prefix">{headerInfo.prefix}</span>
                    <h3>{headerInfo.name}</h3>
                    {headerInfo.desc && <p className="ch-desc">{headerInfo.desc}</p>}
                </div>
                <div className="msg-header-actions">
                    {activeChannel === 'announcement' && canPostAnnouncement && (
                        <button onClick={() => setShowComposer(!showComposer)} title="Create Announcement"
                            style={{ background: showComposer ? 'rgba(240,178,50,0.15)' : 'rgba(99,102,241,0.12)', color: showComposer ? '#f0b232' : 'var(--accent)', borderRadius: 6, padding: '4px 10px', fontSize: 13, fontWeight: 600 }}>
                            {showComposer ? '✕ Cancel' : '📣 New'}
                        </button>
                    )}
                    <button onClick={toggleMembers} title="Members"
                        style={showMembers ? { color: 'var(--text-primary)', background: 'rgba(255,255,255,0.06)', borderRadius: 6 } : {}}>
                        👥
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div className="msg-messages" style={{ padding: '16px 16px 8px' }}>
                {chatItems.length === 0 ? (
                    <div className="msg-empty">
                        <div className="empty-icon">{activeChannel === 'announcement' ? '📣' : '💬'}</div>
                        <h3>{activeChannel === 'announcement' ? 'No announcements yet' : 'No messages yet'}</h3>
                        <p>{activeChannel === 'announcement' ? 'Announcements will appear here as chat messages.' : 'Send the first message to start the conversation!'}</p>
                    </div>
                ) : (
                    chatItems.map((item, i) => {
                        if (item._type === 'date') {
                            return (
                                <div key={`date-${i}`} className="flex items-center gap-3 my-4">
                                    <div className="flex-1 h-px bg-zinc-800" />
                                    <span className="text-[11px] text-zinc-500 font-medium">{formatDate(item.date)}</span>
                                    <div className="flex-1 h-px bg-zinc-800" />
                                </div>
                            );
                        }
                        const prevItem = chatItems[i - 1]?._type !== 'date' ? chatItems[i - 1] : null;
                        return (
                            <MessageBubble
                                key={item.id}
                                msg={item}
                                prevMsg={prevItem}
                                userMap={userMap}
                                currentUserId={currentUserId}
                                isAnnouncement={activeChannel === 'announcement'}
                                onDelete={handleDeleteAnn}
                                canDelete={canDeleteAnn(item)}
                                chatId={chatId}
                            />
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Inline announcement composer */}
            {activeChannel === 'announcement' && showComposer && (
                <InlineAnnouncementComposer onPublish={handlePublishAnnouncement} onCancel={() => setShowComposer(false)} />
            )}

            {/* Message input (all channels) */}
            <div className="msg-input-area" style={{ position: 'relative' }}>
                {/* Emoji Picker */}
                {showEmojiPicker && (
                    <div style={{ position: 'absolute', bottom: '60px', right: '16px', zIndex: 100 }}>
                        <EmojiPicker
                            theme={Theme.DARK}
                            onEmojiClick={(emojiData) => {
                                setMessage(prev => prev + emojiData.emoji);
                                textareaRef.current?.focus();
                            }}
                            width={320}
                            height={400}
                            searchPlaceholder="Search emoji..."
                            previewConfig={{ showPreview: false }}
                        />
                    </div>
                )}
                <div className="msg-input-wrapper">
                    <input
                        type="file"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        onChange={handleFileUpload}
                        accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
                    />
                    <button
                        className="attach-btn"
                        title={uploading ? 'Uploading...' : 'Attach file'}
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        style={uploading ? { opacity: 0.5 } : {}}
                    >
                        {uploading ? '⏳' : '➕'}
                    </button>
                    <textarea ref={textareaRef} rows={1}
                        placeholder={activeChannel.startsWith('dm-') && dmPartner
                            ? `Message @${getUserName(userMap[dmPartner.id]) || dmPartner.displayName || 'User'}`
                            : `Message #${headerInfo.name}`}
                        value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={handleKeyDown}
                    />
                    <button
                        className="emoji-btn"
                        title="Emoji"
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        style={showEmojiPicker ? { color: 'var(--accent)', background: 'rgba(99,102,241,0.15)', borderRadius: 6 } : {}}
                    >😊</button>
                    {message.trim() && (
                        <button className="send-btn" onClick={handleSend} disabled={sending} title="Send">➤</button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ChatArea;
