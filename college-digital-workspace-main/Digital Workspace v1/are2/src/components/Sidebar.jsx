import React from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCommittee } from '../contexts/CommitteeContext';
import CommitteeSwitcher from './CommitteeSwitcher';

const Sidebar = ({ isOpen = true, toggleSidebar, forceCollapsed = false }) => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const { currentCommittee, committeeRole } = useCommittee();

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    // Derive initials from name or email
    const userInitials = user?.name
        ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
        : user?.email
            ? user.email.substring(0, 2).toUpperCase()
            : '??';

    const navItems = [
        { name: 'Dashboard', icon: '📊', path: '/dashboard' },
        { name: 'Tasks', icon: '✓', path: '/tasks' },
        { name: 'Calendar', icon: '📅', path: '/calendar' },
        { name: 'Messages', icon: '💬', path: '/messages' },
        { name: 'Drive', icon: '📁', path: '/drive' },
        { name: 'Members', icon: '👥', path: '/members' },
        { name: 'Settings', icon: '⚙️', path: '/settings' },
        ...(user?.globalRole === 'admin' ? [{ name: 'Admin', icon: '🛡️', path: '/admin' }] : []),
    ];

    const committeeColor = currentCommittee?.color || '#3b82f6';

    return (
        <div
            onClick={() => { if (!isOpen && !forceCollapsed) toggleSidebar(); }}
            className={`
                fixed left-0 top-0 h-screen
                flex flex-col
                bg-zinc-900
                border-r border-zinc-800
                transition-[width] duration-300 ease-in-out
                overflow-x-hidden
                z-40
                ${isOpen ? 'w-[260px]' : `w-[80px] ${forceCollapsed ? '' : 'cursor-pointer'}`}
            `}
        >
            {/* Committee Switcher / Logo Section */}
            <div className="flex items-center px-4 py-4 border-b border-zinc-800">
                {/* Committee-colored logo box */}
                <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                        background: `linear-gradient(135deg, ${committeeColor}, ${committeeColor}88)`,
                    }}
                >
                    <span className="text-lg">
                        {currentCommittee?.name?.[0] || '🎓'}
                    </span>
                </div>

                {/* Text + committee switcher */}
                <div
                    className={`overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out ${isOpen ? 'opacity-100 ml-3 w-auto flex-1' : 'opacity-0 ml-0 w-0'}`}
                >
                    {isOpen && <CommitteeSwitcher />}
                </div>

                {/* Toggle Button */}
                {isOpen && (
                    <button
                        onClick={(e) => { e.stopPropagation(); toggleSidebar(); }}
                        className="ml-auto w-10 h-10 flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-all duration-300 ease-in-out flex-shrink-0"
                    >
                        ☰
                    </button>
                )}
            </div>

            {/* Navigation Items */}
            <nav className="flex-1 py-6 px-4 space-y-2 overflow-y-auto overflow-x-hidden">
                {navItems.map((item) => (
                    <NavLink
                        key={item.name}
                        to={item.path}
                        onClick={(e) => e.stopPropagation()}
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors cursor-pointer no-underline ${isActive
                                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                                : 'text-gray-400 hover:bg-zinc-800 hover:text-white'
                            }`
                        }
                    >
                        <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                            <span className="text-xl">{item.icon}</span>
                        </div>
                        <div
                            className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isOpen
                                ? 'opacity-100 translate-x-0 ml-1'
                                : 'opacity-0 -translate-x-2 w-0'
                                }`}
                        >
                            <span className="font-medium">{item.name}</span>
                        </div>
                    </NavLink>
                ))}
            </nav>

            {/* User Profile + Logout Section */}
            <div className="p-4 border-t border-zinc-800">
                <div className="flex items-center gap-3 px-2 py-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center font-bold text-white text-sm flex-shrink-0">
                        {userInitials}
                    </div>
                    <div
                        className={`whitespace-nowrap overflow-hidden transition-all duration-300 min-w-0 ${isOpen
                            ? 'opacity-100 translate-x-0 flex-1'
                            : 'opacity-0 -translate-x-2 w-0 pointer-events-none'
                            }`}
                    >
                        <p className="text-sm font-semibold text-white truncate">
                            {user?.name || user?.email || 'No user'}
                        </p>
                        <p className="text-xs text-gray-400 flex items-center gap-1.5">
                            <span>{currentCommittee ? currentCommittee.name : 'No committee'}</span>
                            {committeeRole && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide" style={{ backgroundColor: (currentCommittee?.color || '#6366f1') + '25', color: currentCommittee?.color || '#6366f1' }}>
                                    {committeeRole}
                                </span>
                            )}
                        </p>
                    </div>
                    <button
                        onClick={(e) => { e.stopPropagation(); handleLogout(); }}
                        title="Logout"
                        className={`text-gray-400 hover:text-red-400 transition-all duration-300 flex-shrink-0 ${isOpen
                            ? 'opacity-100'
                            : 'opacity-0 w-0 pointer-events-none'
                            }`}
                    >
                        🚪
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Sidebar;
