import React from 'react';
import TaskCard from './TaskCard';

const columnConfig = {
    pending: { label: 'Pending', icon: '⏳', accent: 'bg-yellow-500' },
    inprogress: { label: 'In Progress', icon: '🔄', accent: 'bg-blue-500' },
    complete: { label: 'Complete', icon: '✅', accent: 'bg-green-500' },
};

const TaskColumn = ({ status, tasks, onStatusChange, onDelete }) => {
    const config = columnConfig[status] || columnConfig.pending;

    return (
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl flex flex-col min-h-[400px] backdrop-blur-sm">
            {/* Column Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
                <div className="flex items-center gap-2.5">
                    <span className={`w-2.5 h-2.5 rounded-full ${config.accent}`} />
                    <span className="text-white font-semibold text-sm">{config.icon} {config.label}</span>
                </div>
                <span className="bg-zinc-800 text-zinc-400 text-xs font-bold px-2.5 py-1 rounded-lg min-w-[28px] text-center">
                    {tasks.length}
                </span>
            </div>

            {/* Task List */}
            <div className="flex-1 p-3 space-y-3 overflow-y-auto max-h-[calc(100vh-320px)] task-scroll">
                {tasks.length === 0 ? (
                    <div className="flex items-center justify-center h-full min-h-[200px]">
                        <p className="text-zinc-600 text-sm">No {config.label.toLowerCase()} tasks</p>
                    </div>
                ) : (
                    tasks.map((task) => (
                        <TaskCard key={task.id} task={task} onStatusChange={onStatusChange} onDelete={onDelete} />
                    ))
                )}
            </div>
        </div>
    );
};

export default TaskColumn;
