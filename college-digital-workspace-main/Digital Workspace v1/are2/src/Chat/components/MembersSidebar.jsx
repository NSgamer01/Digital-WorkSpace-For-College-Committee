import React, { useState, useEffect } from 'react';
import api from '../../utils/api';

const getUserName = (data) => data?.name || data?.displayName || data?.email || 'User';

const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
};

const MembersSidebar = ({ onSelectDM }) => {
    const [users, setUsers] = useState([]);

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const data = await api.get('/api/committees/members');
                setUsers((data.members || []).map(m => ({
                    id: m.user_id || m.id,
                    ...m,
                    displayName: getUserName(m),
                })));
            } catch (err) {
                console.error('Error fetching users:', err);
            }
        };
        fetchUsers();
    }, []);

    // Without RTDB presence, all users show as offline for now
    // Can add WebSocket-based presence later
    const onlineUsers = [];
    const offlineUsers = users;

    return (
        <div className="msg-members">
            <div className="msg-members-header">
                Members — {users.length}
            </div>

            {onlineUsers.length > 0 && (
                <>
                    <div className="msg-member-group-header">
                        Online — {onlineUsers.length}
                    </div>
                    {onlineUsers.map((user) => (
                        <button key={user.id} className="msg-member-item" onClick={() => onSelectDM(user)}>
                            <div className="member-avatar">
                                {getInitials(user.displayName)}
                                <span className="status-dot online" style={{ position: 'absolute', bottom: -1, right: -1, width: 10, height: 10, borderRadius: '50%', border: '2px solid #1e1f22' }} />
                            </div>
                            <div>
                                <div className="member-name">{user.displayName}</div>
                                {user.role && <div className="member-role">{user.role}</div>}
                            </div>
                        </button>
                    ))}
                </>
            )}

            {offlineUsers.length > 0 && (
                <>
                    <div className="msg-member-group-header">
                        Members — {offlineUsers.length}
                    </div>
                    {offlineUsers.map((user) => (
                        <button key={user.id} className="msg-member-item" onClick={() => onSelectDM(user)}>
                            <div className="member-avatar">
                                {getInitials(user.displayName)}
                            </div>
                            <div>
                                <div className="member-name">{user.displayName}</div>
                                {user.role && <div className="member-role">{user.role}</div>}
                            </div>
                        </button>
                    ))}
                </>
            )}
        </div>
    );
};

export default MembersSidebar;
