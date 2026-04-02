// ============================================
// services/chatService.js — Chat via PostgreSQL API
// ============================================
// Replaces Firestore with PostgreSQL backend API calls.
// Uses api.js which sends Firebase token + committee slug.
// ============================================

import api from '../utils/api';

// ── System chat initialization ──────────────────────────────────
/**
 * Ensure system chats exist (backend creates "General" room on DB init).
 * This is a no-op now — kept for compatibility.
 */
export async function ensureSystemChats(userId) {
    // Backend handles this during database initialization
    return;
}

// ── Chat CRUD ───────────────────────────────────────────────────

/**
 * Create a new chat room.
 */
export async function createChat(chatData) {
    const data = await api.post('/api/chat/rooms', {
        name: chatData.name || chatData.type,
        description: chatData.description || '',
        type: chatData.type || 'general',
    });
    return data.room || data;
}

/**
 * Fetch all active chat rooms (replaces Firestore subscription).
 * @param {Function} callback - Receives array of chat objects
 * @returns {Function} Unsubscribe function
 */
export function subscribeChats(callback) {
    let active = true;

    const fetchChats = async () => {
        try {
            const data = await api.get('/api/chat/rooms');
            if (active) {
                const rooms = (data.rooms || []).map(room => ({
                    id: room.id,
                    type: room.type || 'general',
                    name: room.name,
                    description: room.description,
                    participants: room.members || [],
                    createdBy: room.created_by,
                    createdAt: room.created_at,
                    lastMessage: room.last_message || '',
                    lastMessageAt: room.last_message_at,
                    isActive: !room.is_archived,
                    message_count: room.message_count,
                }));
                callback(rooms);
            }
        } catch (error) {
            console.error('Error fetching chats:', error);
            if (active) callback([]);
        }
    };

    fetchChats();
    const interval = setInterval(fetchChats, 5000); // Poll every 5 seconds for chat

    return () => {
        active = false;
        clearInterval(interval);
    };
}

/**
 * Find direct chat between two users.
 */
export function subscribeDirectChat(uid1, uid2, callback) {
    // Direct messages not fully implemented in backend yet
    // Return null for now
    callback(null);
    return () => { };
}

// ── Messages subcollection ──────────────────────────────────────

/**
 * Send a message in a chat room.
 */
export async function sendMessage(chatId, messageData) {
    const body = {
        content: messageData.text || '',
        type: messageData.type || 'text',
    };

    // Handle file messages
    if (messageData.fileUrl) {
        body.content = messageData.fileUrl;
        body.type = 'file';
    }

    const data = await api.post(`/api/chat/rooms/${chatId}/messages`, body);
    return data.message || data;
}

/**
 * Fetch messages in a chat room (replaces Firestore subscription).
 * @param {string} chatId
 * @param {Function} callback - Receives array of message objects
 * @returns {Function} Unsubscribe function
 */
export function subscribeMessages(chatId, callback) {
    let active = true;

    const fetchMessages = async () => {
        try {
            const data = await api.get(`/api/chat/rooms/${chatId}/messages`);
            if (active) {
                const messages = (data.messages || []).map(msg => ({
                    id: msg.id,
                    senderId: msg.sender_id,
                    senderName: msg.sender_name,
                    text: msg.content || '',
                    content: msg.content || '',
                    type: msg.type || 'text',
                    createdAt: msg.created_at ? { toDate: () => new Date(msg.created_at) } : null,
                    edited: false,
                    deleted: false,
                    readBy: [],
                }));
                callback(messages);
            }
        } catch (error) {
            console.error(`Error fetching messages for chat ${chatId}:`, error);
            if (active) callback([]);
        }
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 3000); // Poll every 3 seconds

    return () => {
        active = false;
        clearInterval(interval);
    };
}

// ── Delete message ──────────────────────────────────────────────
export async function deleteMessageForEveryone(chatId, messageId) {
    try {
        await api.delete(`/api/chat/rooms/${chatId}/messages/${messageId}`);
    } catch (error) {
        console.error('Delete message error:', error);
    }
}

// ── Edit message ────────────────────────────────────────────────
export async function editMessage(chatId, messageId, newText) {
    try {
        await api.patch(`/api/chat/rooms/${chatId}/messages/${messageId}`, {
            content: newText,
        });
    } catch (error) {
        console.error('Edit message error:', error);
        throw error;
    }
}

// ── Mark message as seen ────────────────────────────────────────
export async function markMessageSeen(chatId, messageId, userId) {
    // Not implemented in current backend — no-op
    return;
}

// ── Aliases for import compatibility ────────────────────────────
// Some components import subscribeChatRooms instead of subscribeChats
export const subscribeChatRooms = subscribeChats;

