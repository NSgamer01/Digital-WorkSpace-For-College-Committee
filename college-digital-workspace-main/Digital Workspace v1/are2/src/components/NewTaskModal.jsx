import React, { useState } from 'react';
import DatePickerModal from './DatePickerModal';

const NewTaskModal = ({ isOpen, onClose, onSubmit, isLoading }) => {
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        dueDate: '',
        assignedTo: 'all',
        priority: 'medium',
    });
    const [showDatePicker, setShowDatePicker] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.title.trim()) return;
        await onSubmit(formData);
        setFormData({ title: '', description: '', dueDate: '', assignedTo: 'all', priority: 'medium' });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-zinc-900 border border-zinc-700 rounded-2xl p-8 w-full max-w-md shadow-2xl shadow-blue-500/5 animate-fade-in">
                <h2 className="text-xl font-bold text-white mb-6">New Task</h2>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    {/* Title */}
                    <div>
                        <label className="block text-zinc-400 text-sm mb-1.5">
                            Title <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="text"
                            name="title"
                            value={formData.title}
                            onChange={handleChange}
                            required
                            placeholder="e.g. Design Event Poster"
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-zinc-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all"
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-zinc-400 text-sm mb-1.5">
                            Description
                        </label>
                        <textarea
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                            rows={3}
                            placeholder="Brief description of the task..."
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-zinc-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all resize-none"
                        />
                    </div>

                    {/* Due Date */}
                    <div>
                        <label className="block text-zinc-400 text-sm mb-1.5">
                            Due Date
                        </label>
                        <input
                            type="text"
                            readOnly
                            value={formData.dueDate ? new Date(formData.dueDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                            onClick={() => setShowDatePicker(true)}
                            placeholder="Select due date"
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all cursor-pointer"
                        />
                    </div>

                    {/* Priority */}
                    <div>
                        <label className="block text-zinc-400 text-sm mb-1.5">
                            Priority
                        </label>
                        <div className="flex gap-2">
                            {['low', 'medium', 'high'].map((level) => (
                                <button
                                    key={level}
                                    type="button"
                                    onClick={() =>
                                        setFormData((prev) => ({ ...prev, priority: level }))
                                    }
                                    className={`
                                        px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer
                                        ${formData.priority === level
                                            ? level === 'low'
                                                ? 'bg-green-500/20 text-green-400 border border-green-500/40'
                                                : level === 'medium'
                                                    ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40'
                                                    : 'bg-red-500/20 text-red-400 border border-red-500/40'
                                            : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-700'
                                        }
                                    `}
                                >
                                    {level.charAt(0).toUpperCase() + level.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Assigned To */}
                    <div>
                        <label className="block text-zinc-400 text-sm mb-1.5">
                            Assigned To
                        </label>
                        <input
                            type="text"
                            name="assignedTo"
                            value={formData.assignedTo}
                            onChange={handleChange}
                            placeholder='UID or "all"'
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-zinc-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all"
                        />
                    </div>

                    {/* Buttons */}
                    <div className="flex items-center justify-end gap-3 mt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isLoading}
                            className="px-5 py-2.5 rounded-lg text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading || !formData.title.trim()}
                            className="px-5 py-2.5 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                            {isLoading ? 'Creating...' : 'Create Task'}
                        </button>
                    </div>
                </form>

                {showDatePicker && (
                    <DatePickerModal
                        value={formData.dueDate}
                        onConfirm={(selectedDate) => {
                            setFormData((prev) => ({ ...prev, dueDate: selectedDate }));
                            setShowDatePicker(false);
                        }}
                        onClose={() => setShowDatePicker(false)}
                    />
                )}
            </div>
        </div>
    );
};

export default NewTaskModal;
