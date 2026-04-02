import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';
import {
    subscribeChatRooms,
    subscribeMessages,
    sendMessage,
    createChat,
    markMessageSeen,
} from '../../services/chatService';
import ChatBubble from './ChatBubble';
import ChatHeader from './ChatHeader';
import ChatInput from './ChatInput';
import UserList from './UserList';

// ── Direct Messages Component ───────────────────────────────────
const DirectMessages = ({ initialMemberId }) => {
    const [selectedUser, setSelectedUser] = useState(null);
    const [dmChatId, setDmChatId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [newMessage, setNewMessage] = useState('');
    const [dmChatsMap, setDmChatsMap] = useState({});
    const [unreadCountMap, setUnreadCountMap] = useState({});
    const messagesEndRef = useRef(null);
    const [backendUsers, setBackendUsers] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(true);
    const inputRef = useRef(null);

    const { user: authUser } = useAuth();
    const currentUserId = authUser?.id;

    // ── Fetch workspace members from backend ────────────────────
    useEffect(() => {
        if (!currentUserId) {
            setLoadingUsers(false);
            return;
        }

        const fetchUsers = async () => {
            try {
                const data = await api.get('/api/committees/members');
                const users = (data.members || [])
                    .filter(m => (m.user_id || m.id) !== currentUserId)
                    .map(m => {
                        const name = m.name || m.email || 'Unknown';
                        return {
                            id: m.user_id || m.id,
                            name,
                            role: m.role || m.position || 'member',
                            initial: name.charAt(0).toUpperCase(),
                        };
                    });
                setBackendUsers(users);
            } catch (error) {
                console.error('❌ Error fetching users:', error);
            } finally {
                setLoadingUsers(false);
            }
        };

        fetchUsers();
    }, [currentUserId]);

    // ── Auto-select user from URL param (initialMemberId) ───────
    useEffect(() => {
        if (!initialMemberId || backendUsers.length === 0) return;
        if (selectedUser?.id === initialMemberId) return;

        const target = backendUsers.find(u => u.id === initialMemberId);
        if (target) {
            setSelectedUser(target);
            setTimeout(() => { inputRef.current?.focus(); }, 300);
        }
    }, [initialMemberId, backendUsers]);

    // ── Subscribe to DM chats for preview ───────────────────────
    useEffect(() => {
        if (!currentUserId) return;

        const unsub = subscribeChatRooms((rooms) => {
            const map = {};
            rooms
                .filter(r => r.type === 'direct' && r.participants?.includes(currentUserId))
                .forEach(r => {
                    const otherId = r.participants?.find(p => p !== currentUserId);
                    if (otherId) {
                        map[otherId] = {
                            chatId: r.id,
                            lastMessage: r.lastMessage || '',
                            lastMessageAt: r.lastMessageAt ? new Date(r.lastMessageAt) : null,
                        };
                    }
                });
            setDmChatsMap(map);
        });

        return () => unsub();
    }, [currentUserId]);

    // ── Find or create DM chat ──────────────────────────────────
    useEffect(() => {
        if (!selectedUser) {
            setDmChatId(null);
            setMessages([]);
            return;
        }
        if (!currentUserId) return;

        let cancelled = false;
        setLoading(true);

        const findOrCreateDM = async () => {
            try {
                // Check dmChatsMap first
                const existing = dmChatsMap[selectedUser.id];
                if (existing) {
                    if (!cancelled) setDmChatId(existing.chatId);
                    return;
                }

                // Create new DM chat via service
                const docRef = await createChat({
                    type: 'direct',
                    participants: [currentUserId, String(selectedUser.id)],
                    createdBy: currentUserId,
                });
                if (!cancelled) {
                    setDmChatId(docRef.id);
                }
            } catch (error) {
                console.error('❌ Error finding/creating DM chat:', error);
                if (!cancelled) setLoading(false);
            }
        };

        findOrCreateDM();
        return () => { cancelled = true; };
    }, [selectedUser, dmChatsMap, currentUserId]);

    // ── Subscribe to messages ───────────────────────────────────
    useEffect(() => {
        if (!dmChatId) return;

        const unsub = subscribeMessages(dmChatId, (msgs) => {
            const realMsgs = msgs.map(m => ({
                ...m,
                sender: m.senderName || 'Unknown',
                isMe: m.senderId === currentUserId,
                timestamp: m.createdAt ? (typeof m.createdAt === 'string' ? new Date(m.createdAt) : m.createdAt) : null,
            }));
            setMessages(realMsgs);
            setLoading(false);

            // Mark unread as seen
            if (currentUserId) {
                realMsgs
                    .filter(m => m.senderId !== currentUserId && m.readBy && !m.readBy.includes(currentUserId))
                    .forEach(m => {
                        markMessageSeen(dmChatId, m.id, currentUserId).catch(() => { });
                    });
            }
        });

        return () => unsub();
    }, [dmChatId, currentUserId]);

    // ── Auto-scroll ─────────────────────────────────────────────
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // ── Send message ────────────────────────────────────────────
    const handleSendMessage = async () => {
        const text = newMessage.trim();
        if (!text || !dmChatId || !currentUserId) return;

        setNewMessage('');

        const clientId = typeof crypto?.randomUUID === 'function'
            ? crypto.randomUUID()
            : 'fallback-' + Date.now() + '-' + Math.random().toString(36).slice(2);

        const tempMessage = {
            id: 'temp-' + clientId,
            clientId,
            sender: authUser?.name || authUser?.email || 'You',
            text,
            timestamp: new Date(),
            isMe: true,
            optimistic: true,
        };
        setMessages(prev => [...prev, tempMessage]);

        try {
            await sendMessage(dmChatId, {
                senderId: currentUserId,
                senderName: authUser?.name || authUser?.email || 'You',
                text,
                clientId,
            });
        } catch (error) {
            console.error('❌ Error sending DM:', error);
            setMessages(prev => prev.filter(m => m.id !== tempMessage.id));
            setNewMessage(text);
        }
    };

    // ── Handle back ─────────────────────────────────────────────
    const handleBack = () => {
        setSelectedUser(null);
        setNewMessage('');
    };

    // ── User list view ──────────────────────────────────────────
    if (!selectedUser) {
        return (
            <UserList
                users={backendUsers}
                loadingUsers={loadingUsers}
                onSelectUser={setSelectedUser}
                dmChatsMap={dmChatsMap}
                unreadCountMap={unreadCountMap}
            />
        );
    }

    // ── Chat view ───────────────────────────────────────────────
    return (
        <div className="flex-1 flex flex-col h-full">
            <ChatHeader user={selectedUser} onBack={handleBack} isOnline={false} />

            {/* Scrollable messages */}
            <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-3">
                        <div
                            className="w-7 h-7 border-2 border-zinc-700 border-t-blue-500 rounded-full"
                            style={{ animation: 'spin 0.8s linear infinite' }}
                        />
                        <p className="text-zinc-500 text-sm">Loading messages...</p>
                        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center">
                        <div className="w-16 h-16 rounded-2xl bg-zinc-800/60 border border-zinc-700/40 flex items-center justify-center mb-4">
                            <span className="text-2xl opacity-40">💬</span>
                        </div>
                        <p className="text-white font-medium text-sm mb-1">No messages yet</p>
                        <p className="text-zinc-500 text-xs">Say hello to {selectedUser.name.split(' ')[0]}!</p>
                    </div>
                ) : (
                    messages.map(msg => (
                        <ChatBubble
                            key={msg.id}
                            message={msg}
                            chatId={dmChatId}
                            isSeen={false}
                        />
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <ChatInput
                placeholder={`Message ${selectedUser.name.split(' ')[0]}...`}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onSend={handleSendMessage}
                disabled={!newMessage.trim() || !dmChatId}
                inputRef={inputRef}
            />
        </div>
    );
};

export default DirectMessages;
