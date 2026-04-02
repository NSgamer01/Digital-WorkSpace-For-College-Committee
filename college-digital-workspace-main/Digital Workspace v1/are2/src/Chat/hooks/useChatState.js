import { useState } from 'react';

// ── Channel definitions ─────────────────────────────────────────
export const channels = [
    {
        key: 'announcement',
        icon: '📣',
        name: 'announcements',
        description: 'Important updates and news',
        panelTitle: 'Announcements',
        unread: 0,
    },
    {
        key: 'generalChat',
        icon: '💬',
        name: 'general-chat',
        description: 'Talk about anything',
        panelTitle: 'General Chat',
        unread: 0,
    },
];

// ── Chat tabs (unused now, kept for backward compat) ────────────
export const chatTabs = [
    { key: 'all', label: 'All' },
    { key: 'groups', label: 'Groups' },
];

// ── Custom hook for chat state ──────────────────────────────────
const useChatState = () => {
    const [activeTab, setActiveTab] = useState('all');
    const [activeChannel, setActiveChannel] = useState('announcement');
    const [selectedUser, setSelectedUser] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [showMembers, setShowMembers] = useState(true);

    return {
        activeTab,
        setActiveTab,
        activeChannel,
        setActiveChannel,
        selectedUser,
        setSelectedUser,
        searchQuery,
        setSearchQuery,
        showMembers,
        setShowMembers,
    };
};

export default useChatState;
