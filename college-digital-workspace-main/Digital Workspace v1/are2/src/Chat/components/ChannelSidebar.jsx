import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';
import { subscribeChatRooms } from '../../services/chatService';

// Helper: resolve user name
const getUserName = (data) => data?.name || data?.displayName || data?.email || 'User';

const ChannelSidebar = ({ activeChannel, setActiveChannel, channels, dmUsers, setDmUsers, onSelectDM }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [users, setUsers] = useState([]);
    const { user: authUser } = useAuth();
    const currentUserId = authUser?.id;

    // Fetch workspace members from backend
    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const data = await api.get('/api/committees/members');
                const list = (data.members || [])
                    .map(m => ({
                        id: m.user_id || m.id,
                        ...m,
                        displayName: getUserName(m),
                    }))
                    .filter(u => u.id !== currentUserId);
                setUsers(list);
            } catch (err) {
                console.error('Error fetching users:', err);
            }
        };
        if (currentUserId) fetchUsers();
    }, [currentUserId]);

    // Subscribe to DM conversations via chatService
    useEffect(() => {
        if (!currentUserId) return;
        const unsub = subscribeChatRooms((rooms) => {
            const dms = rooms.filter(r =>
                r.type === 'direct' &&
                r.participants?.includes(currentUserId)
            );
            setDmUsers(dms);
        });
        return () => unsub();
    }, [currentUserId, setDmUsers]);

    const getInitials = (name) => {
        if (!name) return '?';
        return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    };

    const filteredChannels = channels.filter(ch =>
        ch.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getDMPartner = (dm) => {
        const partnerId = dm.participants?.find(p => p !== currentUserId);
        const user = users.find(u => u.id === partnerId);
        return user || { id: partnerId, displayName: 'Unknown User' };
    };

    return (
        <div className="msg-sidebar">
            <div className="msg-sidebar-header">
                <h2>College Workspace</h2>
            </div>

            <div className="msg-search">
                <input
                    type="text"
                    placeholder="Find a channel or DM..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            <div className="msg-channel-list">
                <div className="msg-section-header">
                    <span>Text Channels</span>
                </div>

                {filteredChannels.map((ch) => (
                    <button
                        key={ch.key}
                        className={`msg-channel-item ${activeChannel === ch.key ? 'active' : ''}`}
                        onClick={() => setActiveChannel(ch.key)}
                    >
                        {ch.icon ? (
                            <span className="ch-icon">{ch.icon}</span>
                        ) : (
                            <span className="ch-hash">#</span>
                        )}
                        <span className="ch-name">{ch.name}</span>
                        {ch.unread > 0 && (
                            <span className="msg-unread-badge">{ch.unread}</span>
                        )}
                    </button>
                ))}

                <div className="msg-section-header">
                    <span>Direct Messages</span>
                </div>

                {dmUsers.length === 0 && users.slice(0, 5).map((user) => (
                    <button
                        key={user.id}
                        className={`msg-dm-item ${activeChannel === `dm-${user.id}` ? 'active' : ''}`}
                        onClick={() => onSelectDM(user)}
                    >
                        <div className="msg-dm-avatar">
                            {getInitials(user.displayName)}
                        </div>
                        <div className="msg-dm-info">
                            <div className="msg-dm-name">{user.displayName}</div>
                            <div className="msg-dm-preview">Click to start chatting</div>
                        </div>
                    </button>
                ))}

                {dmUsers.map((dm) => {
                    const partner = getDMPartner(dm);
                    return (
                        <button
                            key={dm.id}
                            className={`msg-dm-item ${activeChannel === `dm-${partner.id}` ? 'active' : ''}`}
                            onClick={() => onSelectDM(partner)}
                        >
                            <div className="msg-dm-avatar">
                                {getInitials(partner.displayName)}
                            </div>
                            <div className="msg-dm-info">
                                <div className="msg-dm-name">{partner.displayName}</div>
                                <div className="msg-dm-preview">
                                    {dm.lastMessage ? (dm.lastMessage.length > 30 ? dm.lastMessage.slice(0, 30) + '...' : dm.lastMessage) : 'No messages yet'}
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default ChannelSidebar;
