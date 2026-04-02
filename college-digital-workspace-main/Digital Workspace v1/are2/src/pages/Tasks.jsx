import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import TaskColumn from '../components/TaskColumn';
import { useAuth } from '../contexts/AuthContext';
import { useCommittee } from '../contexts/CommitteeContext';
import { createTask, subscribeTasks, subscribeMyTasks, subscribeCreatedTasks, cleanupCompletedTasks } from '../services/taskService';
import { canUserPerformAction } from '../constants/roles';

const statusTabs = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'inprogress', label: 'In Progress' },
    { key: 'complete', label: 'Complete' },
];

const Tasks = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { committeeRole } = useCommittee();
    const [tasks, setTasks] = useState([]);
    const [activeTab, setActiveTab] = useState('all');
    const [priorityFilter, setPriorityFilter] = useState('all');
    const [isCreatingTask, setIsCreatingTask] = useState(false);

    // ── View tabs: My Tasks / Created / All ───────────────────
    const isAdmin = ['head', 'admin', 'faculty'].includes(committeeRole);
    const canCreateTasks = canUserPerformAction(committeeRole, 'createTasks');
    const [viewTab, setViewTab] = useState('my'); // 'my' | 'created' | 'all'

    const viewTabs = useMemo(() => {
        const tabs = [
            { key: 'my', label: '📋 My Tasks' },
            { key: 'created', label: '✏️ Created by Me' },
        ];
        // Only admins/heads see "All Tasks" tab
        if (isAdmin) {
            tabs.push({ key: 'all', label: '👁️ All Tasks' });
        }
        return tabs;
    }, [isAdmin]);

    // ── Subscribe to tasks based on active view tab ───────────
    useEffect(() => {
        let unsubscribe;
        const handler = (fetchedTasks) => setTasks(fetchedTasks);

        if (viewTab === 'my') {
            unsubscribe = subscribeMyTasks(handler);
        } else if (viewTab === 'created') {
            unsubscribe = subscribeCreatedTasks(handler);
        } else {
            unsubscribe = subscribeTasks(handler);
        }

        return () => unsubscribe();
    }, [viewTab]);

    // ── Optimistic status update — move task immediately ──────────
    const handleOptimisticStatus = useCallback((taskId, newStatus) => {
        setTasks(prev => prev.map(t =>
            t.id === taskId ? { ...t, status: newStatus } : t
        ));
    }, []);

    // ── Optimistic delete — remove task immediately ──────────────
    const handleOptimisticDelete = useCallback((taskId) => {
        setTasks(prev => prev.filter(t => t.id !== taskId));
    }, []);

    // Auto-delete completed tasks older than 2 hours (check every 5 min)
    useEffect(() => {
        const cleanup = () => {
            if (tasks.length > 0) cleanupCompletedTasks(tasks);
        };
        cleanup(); // run once on mount / tasks change
        const interval = setInterval(cleanup, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [tasks]);

    // ── Filtered tasks ─────────────────────────────────────────────
    const filteredTasks = useMemo(() => {
        return tasks.filter((task) => {
            const matchesTab = activeTab === 'all' || task.status === activeTab;
            const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;
            return matchesTab && matchesPriority;
        });
    }, [tasks, activeTab, priorityFilter]);

    // ── Grouped by status ──────────────────────────────────────────
    const pendingTasks = filteredTasks.filter(t => t.status === 'pending');
    const inprogressTasks = filteredTasks.filter(t => t.status === 'inprogress');
    const completeTasks = filteredTasks.filter(t => t.status === 'complete');

    // ── Quick-create → open in detail page (Notion-style) ──────────
    const handleNewTask = async () => {
        if (!user) {
            console.error("❌ No user logged in.");
            return;
        }
        setIsCreatingTask(true);
        try {
            const docRef = await createTask({ title: 'Untitled' }, user.id);
            navigate(`/tasks/${docRef.id}`);
        } catch (error) {
            console.error("❌ Failed to create task:", error);
        } finally {
            setIsCreatingTask(false);
        }
    };

    return (
        <div>
            {/* Page Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-white">Task Management</h1>
                    <p className="text-zinc-500 text-sm mt-1">
                        {tasks.length} task{tasks.length !== 1 ? 's' : ''}
                        {viewTab === 'my' ? ' assigned to you' : viewTab === 'created' ? ' created by you' : ''}
                    </p>
                </div>
                {canCreateTasks && (
                    <button
                        onClick={handleNewTask}
                        disabled={isCreatingTask}
                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-500/20 cursor-pointer disabled:opacity-50 disabled:cursor-wait"
                    >
                        {isCreatingTask ? 'Creating...' : '+ New Task'}
                    </button>
                )}
            </div>

            {/* View Tabs (My Tasks / Created by Me / All Tasks) */}
            <div className="flex items-center gap-2 mb-4">
                {viewTabs.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => { setViewTab(tab.key); setActiveTab('all'); }}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer border ${viewTab === tab.key
                                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white border-transparent shadow-md shadow-indigo-500/20'
                                : 'text-zinc-400 border-zinc-800 hover:text-white hover:border-zinc-600 bg-zinc-900/50'
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Filter Bar */}
            <div className="flex flex-wrap items-center gap-4 mb-6">
                {/* Status Tabs */}
                <div className="flex bg-zinc-900/80 border border-zinc-800 rounded-xl p-1">
                    {statusTabs.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${activeTab === tab.key
                                ? 'bg-blue-600 text-white shadow-md'
                                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Priority Filter */}
                <select
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                    className="bg-zinc-900 border border-zinc-800 text-zinc-300 text-sm rounded-xl px-4 py-2.5 outline-none focus:border-blue-500 transition-all cursor-pointer appearance-none"
                >
                    <option value="all">All Priorities</option>
                    <option value="high">🔴 High</option>
                    <option value="medium">🟡 Medium</option>
                    <option value="low">🟢 Low</option>
                </select>
            </div>

            {/* Kanban Board */}
            <div
                className={`grid gap-6 transition-all duration-300 ${activeTab === 'all'
                    ? 'grid-cols-1 lg:grid-cols-3'
                    : 'grid-cols-1 max-w-2xl'
                    }`}
            >
                {(activeTab === 'all' || activeTab === 'pending') && (
                    <div className="animate-fadeIn">
                        <TaskColumn status="pending" tasks={pendingTasks} onStatusChange={handleOptimisticStatus} onDelete={handleOptimisticDelete} />
                    </div>
                )}
                {(activeTab === 'all' || activeTab === 'inprogress') && (
                    <div className="animate-fadeIn">
                        <TaskColumn status="inprogress" tasks={inprogressTasks} onStatusChange={handleOptimisticStatus} onDelete={handleOptimisticDelete} />
                    </div>
                )}
                {(activeTab === 'all' || activeTab === 'complete') && (
                    <div className="animate-fadeIn">
                        <TaskColumn status="complete" tasks={completeTasks} onStatusChange={handleOptimisticStatus} onDelete={handleOptimisticDelete} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default Tasks;
