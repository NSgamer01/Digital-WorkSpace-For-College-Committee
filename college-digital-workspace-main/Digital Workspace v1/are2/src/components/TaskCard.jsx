import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { updateTaskStatus, deleteTask } from '../services/taskService';

const priorityColors = {
    high: 'bg-red-500/20 text-red-400',
    medium: 'bg-yellow-500/20 text-yellow-400',
    low: 'bg-green-500/20 text-green-400',
};

const statusActions = {
    pending: { label: '▶ Start', next: 'inprogress', color: 'bg-blue-600 hover:bg-blue-500' },
    inprogress: { label: '✓ Complete', next: 'complete', color: 'bg-green-600 hover:bg-green-500' },
    complete: { label: '↩ Pending', next: 'pending', color: 'bg-orange-600 hover:bg-orange-500' },
};

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

const TaskCard = React.memo(({ task, onStatusChange, onDelete }) => {
    const navigate = useNavigate();
    const priority = task.priority || 'medium';
    const isCompleted = task.status === 'complete';
    const [updating, setUpdating] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [animState, setAnimState] = useState('visible'); // 'visible' | 'exiting' | 'entering'
    const [prevStatus, setPrevStatus] = useState(task.status);
    const cardRef = useRef(null);

    const dueDate = task.dueDate
        ? typeof task.dueDate === 'string'
            ? task.dueDate
            : task.dueDate?.toDate?.()?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) || ''
        : '';

    // Detect status change (real-time update)
    useEffect(() => {
        if (task.status !== prevStatus) {
            setAnimState('entering');
            setPrevStatus(task.status);
            const timer = setTimeout(() => setAnimState('visible'), 350);
            return () => clearTimeout(timer);
        }
    }, [task.status, prevStatus]);

    const handleStatusChange = async (e) => {
        e.stopPropagation();
        const action = statusActions[task.status];
        if (!action || updating) return;

        // Block revert if outside 2hr window
        if (task.status === 'complete' && !isWithinRevertWindow()) return;

        const nextStatus = action.next;

        setUpdating(true);
        setAnimState('exiting');

        // Optimistic update: tell parent immediately so the task moves columns
        if (onStatusChange) {
            onStatusChange(task.id, nextStatus);
        }

        try {
            await updateTaskStatus(task.id, nextStatus);
        } catch (err) {
            console.error('❌ Status update failed:', err);
            // Revert optimistic update on failure
            if (onStatusChange) {
                onStatusChange(task.id, task.status);
            }
            setAnimState('visible');
        } finally {
            setUpdating(false);
        }
    };

    // Check if completed task is within 2-hour revert window
    const isWithinRevertWindow = () => {
        if (task.status !== 'complete') return false;
        if (!task.completedAt) return true; // legacy tasks — always show button
        const completedTime = typeof task.completedAt === 'string'
            ? new Date(task.completedAt).getTime()
            : (task.completedAt?.toDate?.()?.getTime() || 0);
        return (Date.now() - completedTime) < TWO_HOURS_MS;
    };

    // Countdown for revert window
    const [timeLeft, setTimeLeft] = useState('');
    useEffect(() => {
        if (task.status !== 'complete' || !task.completedAt) {
            setTimeLeft('');
            return;
        }

        const updateCountdown = () => {
            const completedTime = typeof task.completedAt === 'string'
                ? new Date(task.completedAt).getTime()
                : (task.completedAt?.toDate?.()?.getTime() || 0);
            const remaining = TWO_HOURS_MS - (Date.now() - completedTime);
            if (remaining <= 0) {
                setTimeLeft('');
                return;
            }
            const mins = Math.floor(remaining / 60000);
            const hrs = Math.floor(mins / 60);
            const m = mins % 60;
            setTimeLeft(hrs > 0 ? `${hrs}h ${m}m left` : `${m}m left`);
        };

        updateCountdown();
        const interval = setInterval(updateCountdown, 60000);
        return () => clearInterval(interval);
    }, [task.status, task.completedAt]);

    const canRevert = task.status === 'complete' && isWithinRevertWindow();

    // Animation classes
    const animClasses = {
        visible: 'opacity-100 translate-y-0 scale-100',
        exiting: 'opacity-0 -translate-y-2 scale-[0.97]',
        entering: 'opacity-0 translate-y-2 scale-[0.97]',
    };

    const action = statusActions[task.status];

    return (
        <div
            ref={cardRef}
            onClick={() => navigate(`/tasks/${task.id}`)}
            className={`bg-zinc-800/70 border border-zinc-700/50 rounded-xl px-4 py-2.5 hover:border-zinc-600 group cursor-pointer
                transition-all duration-300 ease-in-out ${animClasses[animState]}`}
            style={{ transitionProperty: 'opacity, transform' }}
        >
            {/* Top row: priority badge + action button */}
            <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2.5">
                    <span className={`text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md ${priorityColors[priority]}`}>
                        {priority}
                    </span>
                </div>

                {/* Status action button */}
                {task.status !== 'complete' && action && (
                    <button
                        onClick={handleStatusChange}
                        disabled={updating}
                        className={`text-[11px] font-semibold px-3 py-1 rounded-lg text-white transition-all duration-200 cursor-pointer
                            ${action.color} ${updating ? 'opacity-50 cursor-wait' : 'hover:-translate-y-0.5 hover:shadow-lg'}`}
                    >
                        {updating ? '…' : action.label}
                    </button>
                )}
                {/* Revert button for completed (within 2hr window) */}
                {canRevert && (
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-zinc-500">{timeLeft}</span>
                        <button
                            onClick={handleStatusChange}
                            disabled={updating}
                            className={`text-[11px] font-semibold px-3 py-1 rounded-lg text-white transition-all duration-200 cursor-pointer
                                bg-orange-600 hover:bg-orange-500 ${updating ? 'opacity-50 cursor-wait' : 'hover:-translate-y-0.5 hover:shadow-lg'}`}
                        >
                            {updating ? '…' : '↩ Pending'}
                        </button>
                    </div>
                )}
            </div>

            {/* Title */}
            <h4 className={`font-semibold text-sm mb-1.5 transition-colors ${isCompleted
                ? 'line-through text-zinc-500'
                : 'text-white group-hover:text-blue-400'
                }`}>
                {task.title}
            </h4>

            {/* Description */}
            {task.description && (
                <p className={`text-xs leading-relaxed mb-2 line-clamp-2 ${isCompleted ? 'text-zinc-600' : 'text-zinc-400'
                    }`}>
                    {task.description}
                </p>
            )}

            {/* Footer: due date + assigned + delete */}
            <div className="flex items-center justify-between text-[11px] text-zinc-500">
                <div className="flex items-center gap-3">
                    {dueDate && (
                        <span className="flex items-center gap-1">
                            📅 {dueDate}
                        </span>
                    )}
                    <span className="flex items-center gap-1">
                        👤 {task.assignedToName || (task.assignedTo === 'all' ? 'Everyone' : task.assignedTo || 'Unassigned')}
                    </span>
                </div>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        if (deleting) return;
                        if (!window.confirm('Delete this task?')) return;
                        setDeleting(true);
                        if (onDelete) onDelete(task.id);
                        deleteTask(task.id).catch(() => setDeleting(false));
                    }}
                    disabled={deleting}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 cursor-pointer"
                    title="Delete task"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        <line x1="10" y1="11" x2="10" y2="17" />
                        <line x1="14" y1="11" x2="14" y2="17" />
                    </svg>
                </button>
            </div>
        </div>
    );
});

TaskCard.displayName = 'TaskCard';

export default TaskCard;
