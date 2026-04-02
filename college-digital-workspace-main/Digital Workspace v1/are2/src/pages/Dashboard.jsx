import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import StatCard from '../components/StatCard';
import DashboardPanel from '../components/DashboardPanel';
import RecentActivity from '../components/RecentActivity';
import QuickActionCard from '../components/QuickActionCard';
import NewTaskModal from '../components/NewTaskModal';
import DashboardMeetings from '../components/DashboardMeetings';
import AnnouncementForm from '../components/announcement/AnnouncementForm';
import DashboardAnnouncementCard from '../components/announcement/DashboardAnnouncementCard';
import { useAuth } from '../contexts/AuthContext';
import { subscribeAnnouncements } from '../services/announcementService';
import { subscribeTasks, createTask, updateTaskStatus } from '../services/taskService';

const Dashboard = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    // ── Current User Role ────────────────────────────────────────────
    const normalizedRole = (user?.globalRole || 'member').toLowerCase().trim();
    const canCreateAnnouncement = ['admin', 'faculty', 'head'].includes(normalizedRole);

    // ── Live Tasks (from PostgreSQL via polling) ─────────────────────
    const [tasks, setTasks] = useState([]);
    const [recentTasks, setRecentTasks] = useState([]);

    useEffect(() => {
        const unsub = subscribeTasks((allTasks) => {
            setTasks(allTasks);
            // Recent 3 tasks
            const sorted = [...allTasks].sort((a, b) => {
                const aTime = a.createdAt ? new Date(a.createdAt) : new Date(0);
                const bTime = b.createdAt ? new Date(b.createdAt) : new Date(0);
                return bTime - aTime;
            });
            setRecentTasks(sorted.slice(0, 3));
        });
        return () => unsub();
    }, []);

    const totalTasks = tasks.length;
    const completedCount = tasks.filter(t => t.status === 'complete').length;
    const pendingCount = tasks.filter(t => t.status === 'pending').length;

    // ── Meetings this week count (lightweight) ────────────────────────
    const [meetingsThisWeek, setMeetingsThisWeek] = useState(0);

    // ── Removing Task Animation ─────────────────────────────────────
    const [removingTaskId, setRemovingTaskId] = useState(null);

    // ── New Task Modal ──────────────────────────────────────────────
    const [showNewTaskModal, setShowNewTaskModal] = useState(false);
    const [isCreatingTask, setIsCreatingTask] = useState(false);

    const handleCreateTask = async (formData) => {
        if (!user) {
            console.error("❌ No user logged in — cannot create task.");
            return;
        }
        setIsCreatingTask(true);
        try {
            await createTask(formData, user.id);
            setShowNewTaskModal(false);
        } catch (error) {
            console.error("❌ Failed to create task:", error);
        } finally {
            setIsCreatingTask(false);
        }
    };



    // ── Announcement Modal + Live Announcements ─────────────────────
    const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
    const [announcements, setAnnouncements] = useState([]);

    // Real-time listener — reads from root "announcements" collection (max 3)
    useEffect(() => {
        const unsubscribe = subscribeAnnouncements(setAnnouncements, 3);
        return () => unsubscribe();
    }, []);

    // ── Quick Actions ───────────────────────────────────────────────
    const quickActions = [
        { id: 1, title: 'Upload File', icon: '📤', onClick: () => navigate('/drive') },
        { id: 2, title: 'Send Message', icon: '💬', onClick: () => navigate('/messages') },
        { id: 3, title: 'Schedule Meeting', icon: '📅', onClick: () => navigate('/calendar') },
        { id: 4, title: 'New Task', icon: '✅', onClick: () => setShowNewTaskModal(true) },
    ];

    const currentDate = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    return (
        <>
            {/* Page Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-4xl font-bold text-white">
                        {(() => {
                            const slug = localStorage.getItem('currentCommitteeSlug')?.toUpperCase();
                            const names = { DLLE: "DLLE's", GYK: "Gymkhana's", NSS: "NSS's" };
                            return `${names[slug] || slug || "Digital"} College Workspace`;
                        })()}
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">Dashboard</p>
                </div>
                <p className="text-zinc-400 text-sm">{currentDate}</p>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
                <StatCard title="Total Tasks" value={totalTasks} icon="📋" iconBg="bg-blue-500/20" textColor="text-blue-400" />
                <StatCard title="Completed" value={completedCount} icon="✓" iconBg="bg-green-500/20" textColor="text-green-400" />
                <StatCard title="Pending" value={pendingCount} icon="⏳" iconBg="bg-yellow-500/20" textColor="text-yellow-400" />
                <StatCard title="Meetings This Week" value={meetingsThisWeek} icon="📅" iconBg="bg-purple-500/20" textColor="text-purple-400" />
            </div>

            {/* Dashboard Content Panels */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <DashboardPanel
                    title="Recent Tasks"
                    actionText="View All"
                    onAction={() => navigate('/tasks')}
                >
                    {recentTasks.length === 0 ? (
                        <div className="flex items-center justify-center py-8">
                            <p className="text-zinc-500 text-sm">No recent tasks.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {recentTasks.map((task) => (
                                <div
                                    key={task.id}
                                    onClick={() => navigate(`/tasks/${task.id}`)}
                                    style={{ cursor: 'pointer' }}
                                    className={`transition-all duration-300 ease-in-out overflow-hidden
                                        ${removingTaskId === task.id
                                            ? 'opacity-0 scale-95 max-h-0 py-0 my-0'
                                            : 'opacity-100 scale-100 max-h-40'
                                        }
                                        flex items-center justify-between bg-zinc-800/60 border border-zinc-700/40 rounded-xl px-4 py-3 hover:bg-zinc-700/60
                                    `}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${task.status === 'complete' ? 'bg-green-500' :
                                            task.status === 'inprogress' ? 'bg-blue-500' : 'bg-yellow-500'
                                            }`} />
                                        <div>
                                            <p
                                                className={`text-sm font-medium ${task.status === 'complete'
                                                    ? 'line-through text-zinc-500'
                                                    : 'text-white'
                                                    }`}
                                            >
                                                {task.title}
                                            </p>
                                            {task.dueDate && (
                                                <p className="text-xs text-zinc-400 mt-0.5">
                                                    Due: {task.dueDate}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    {task.priority && (
                                        <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${task.priority === 'high'
                                            ? 'bg-red-500/20 text-red-400'
                                            : task.priority === 'low'
                                                ? 'bg-green-500/20 text-green-400'
                                                : 'bg-yellow-500/20 text-yellow-400'
                                            }`}>
                                            {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </DashboardPanel>

                <DashboardMeetings />
            </div>

            {/* Recent Activity */}
            <div className="mt-8">
                <RecentActivity />
            </div>

            {/* Announcements & Quick Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
                {/* Announcements Panel (custom header with "+" icon) */}
                <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 backdrop-blur-sm">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-lg font-semibold text-white">Announcements</h2>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => navigate("/messages?tab=announcements")}
                                className="text-sm text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
                            >
                                View All
                            </button>
                            {canCreateAnnouncement && (
                                <button
                                    onClick={() => setShowAnnouncementModal(true)}
                                    className="w-7 h-7 rounded-lg bg-purple-500/15 border border-purple-500/20 flex items-center justify-center text-purple-400 hover:bg-purple-500/25 hover:text-purple-300 transition-all cursor-pointer group"
                                    aria-label="New Announcement"
                                    title="New Announcement"
                                >
                                    <svg className="w-4 h-4 transition-transform group-hover:rotate-90 duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    </div>

                    {announcements.length === 0 ? (
                        <div className="flex items-center justify-center py-12">
                            <p className="text-zinc-500 text-sm">No announcements yet.</p>
                        </div>
                    ) : (
                        <div className="max-h-[280px] overflow-y-auto space-y-2.5 pr-1 custom-scroll">
                            {announcements.map((a) => (
                                <DashboardAnnouncementCard key={a.id} announcement={a} />
                            ))}
                        </div>
                    )}
                </div>

                <DashboardPanel title="Quick Actions" actionText="">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {quickActions.map((action) => (
                            <QuickActionCard
                                key={action.id}
                                title={action.title}
                                icon={action.icon}
                                onClick={action.onClick}
                            />
                        ))}
                    </div>
                </DashboardPanel>
            </div>

            {/* New Task Modal */}
            <NewTaskModal
                isOpen={showNewTaskModal}
                onClose={() => setShowNewTaskModal(false)}
                onSubmit={handleCreateTask}
                isLoading={isCreatingTask}
            />



            {/* Create Announcement Modal */}
            <AnnouncementForm
                isOpen={showAnnouncementModal}
                onClose={() => setShowAnnouncementModal(false)}
            />
        </>
    );
};

export default Dashboard;
