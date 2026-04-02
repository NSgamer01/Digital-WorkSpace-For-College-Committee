import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
    subscribeChatRooms,
    subscribeMessages,
    sendMessage,
    markMessageSeen,
    createChat,
} from '../../services/chatService';
import ChatBubble from './ChatBubble';
import ChatInput from './ChatInput';

// ── General Chat Channel Component ──────────────────────────────
const GeneralChatChannel = () => {
    const [chatId, setChatId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newMessage, setNewMessage] = useState('');

    const messagesEndRef = useRef(null);
    const scrollContainerRef = useRef(null);
    const isInitialLoad = useRef(true);

    const { user: authUser } = useAuth();
    const currentUserId = authUser?.id;

    // ── Find the "general" chat document, auto-create if missing ──
    useEffect(() => {
        let hasAutoCreated = false;
        const unsub = subscribeChatRooms((rooms) => {
            const generalChat = rooms.find(r => r.type === 'general');
            if (generalChat) {
                setChatId(generalChat.id);
                setLoading(false);
            } else if (!hasAutoCreated) {
                // Auto-create general chat room if it doesn't exist
                hasAutoCreated = true;
                console.log('⚠️ No "general" chat found. Creating one...');
                createChat({ type: 'general', name: 'General', description: 'Public committee discussion' })
                    .then(room => {
                        if (room?.id) {
                            setChatId(room.id);
                        }
                    })
                    .catch(err => {
                        console.error('Failed to create general chat:', err);
                    })
                    .finally(() => setLoading(false));
            } else {
                setLoading(false);
            }
        });
        return () => unsub();
    }, []);

    // ── Subscribe to messages ───────────────────────────────────
    useEffect(() => {
        if (!chatId) return;

        const unsub = subscribeMessages(chatId, (msgs) => {
            const realMsgs = msgs.map(m => ({
                ...m,
                sender: m.senderName || 'Unknown',
                isMe: m.senderId === currentUserId,
                timestamp: m.createdAt ? (typeof m.createdAt === 'string' ? new Date(m.createdAt) : m.createdAt) : null,
            }));

            // Deduplicate with optimistic messages
            const confirmedClientIds = new Set(
                realMsgs.map(m => m.clientId).filter(Boolean)
            );

            setMessages(prev => {
                const pendingOptimistic = prev.filter(
                    m => m.optimistic && !confirmedClientIds.has(m.clientId)
                );
                return [...realMsgs, ...pendingOptimistic];
            });
            setLoading(false);

            // Mark unread as seen
            if (currentUserId) {
                realMsgs
                    .filter(m => m.senderId !== currentUserId && m.readBy && !m.readBy.includes(currentUserId))
                    .forEach(m => {
                        markMessageSeen(chatId, m.id, currentUserId).catch(() => { });
                    });
            }
        });

        return () => unsub();
    }, [chatId, currentUserId]);

    // ── Auto-scroll ─────────────────────────────────────────────
    useEffect(() => {
        if (isInitialLoad.current) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
            isInitialLoad.current = false;
            return;
        }

        const container = scrollContainerRef.current;
        if (container) {
            const distFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
            if (distFromBottom < 150) {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }
        }
    }, [messages]);

    // ── Send message ────────────────────────────────────────────
    const handleSendMessage = async () => {
        const text = newMessage.trim();
        if (!text || !chatId || !currentUserId) return;

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
            await sendMessage(chatId, {
                senderId: currentUserId,
                senderName: authUser?.name || authUser?.email || 'You',
                text,
                clientId,
            });
        } catch (error) {
            console.error('❌ Error sending message:', error);
            setMessages(prev => prev.filter(m => m.id !== tempMessage.id));
            setNewMessage(text);
        }
    };

    // ── Render ──────────────────────────────────────────────────
    return (
        <div className="flex-1 flex flex-col h-full">

            {/* Sticky Channel Header */}
            <div className="flex-shrink-0 px-6 py-4 border-b border-zinc-800">
                <div className="flex items-center gap-3">
                    <span className="text-lg">🌐</span>
                    <div>
                        <h3 className="text-white font-semibold text-base leading-tight">General Chat</h3>
                        <p className="text-zinc-500 text-xs mt-0.5">Public committee discussion</p>
                    </div>
                </div>
            </div>

            {/* Scrollable Messages Area */}
            <div
                ref={scrollContainerRef}
                className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4"
            >
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
                            <span className="text-2xl opacity-40">🌐</span>
                        </div>
                        <p className="text-white font-medium text-sm mb-1">No messages yet</p>
                        <p className="text-zinc-500 text-xs">Start the conversation in #general</p>
                    </div>
                ) : (
                    messages.map(msg => (
                        <ChatBubble key={msg.id} message={msg} chatId={chatId} />
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Sticky Input Footer */}
            <ChatInput
                placeholder="Message #general"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onSend={handleSendMessage}
                disabled={!newMessage.trim() || !chatId}
            />
        </div>
    );
};

export default GeneralChatChannel;
