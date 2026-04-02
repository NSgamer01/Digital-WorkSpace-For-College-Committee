// ============================================
// src/components/settings/NotificationSettings.jsx
// ============================================

import React, { useState, useEffect } from 'react';
import { useSettings } from '../../contexts/SettingsContext';

const Toggle = ({ checked, onChange, label }) => (
    <label className="flex items-center justify-between py-3 cursor-pointer group">
        <span className="text-sm text-zinc-300 group-hover:text-white transition-colors">{label}</span>
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={() => onChange(!checked)}
            className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 flex-shrink-0"
            style={{ backgroundColor: checked ? 'var(--accent, #6366f1)' : '#3f3f46' }}
        >
            <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform duration-200 ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
    </label>
);

const NotificationSettings = () => {
    const { settings, updateSettings } = useSettings();
    const [form, setForm] = useState({
        browser: true, email: true, taskAssigned: true, taskUpdated: true,
        eventInvitation: true, messageMention: true, announcement: true,
        deadlineReminder: true, digestEmail: 'daily',
    });
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);

    useEffect(() => {
        if (settings?.notifications) {
            setForm({ ...settings.notifications });
        }
    }, [settings?.notifications]);

    const handleToggle = (field, value) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        setSaving(true);
        const result = await updateSettings('notifications', form);
        setSaving(false);
        setMessage(result.success ? { type: 'success', text: 'Notifications updated!' } : { type: 'error', text: result.error });
        setTimeout(() => setMessage(null), 3000);
    };

    return (
        <div>
            {message && (
                <div className={`mb-4 px-4 py-2 rounded-lg text-sm font-medium ${message.type === 'success' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                    {message.text}
                </div>
            )}

            {/* General */}
            <div className="mb-6">
                <h3 className="text-sm font-semibold text-zinc-300 mb-2">General</h3>
                <div className="divide-y divide-zinc-800">
                    <Toggle checked={form.browser} onChange={v => handleToggle('browser', v)} label="Browser notifications" />
                    <Toggle checked={form.email} onChange={v => handleToggle('email', v)} label="Email notifications" />
                </div>
            </div>

            {/* Notify me about */}
            <div className="mb-6">
                <h3 className="text-sm font-semibold text-zinc-300 mb-2">Notify me about</h3>
                <div className="divide-y divide-zinc-800">
                    <Toggle checked={form.taskAssigned} onChange={v => handleToggle('taskAssigned', v)} label="Task assignments" />
                    <Toggle checked={form.taskUpdated} onChange={v => handleToggle('taskUpdated', v)} label="Task updates" />
                    <Toggle checked={form.eventInvitation} onChange={v => handleToggle('eventInvitation', v)} label="Event invitations" />
                    <Toggle checked={form.messageMention} onChange={v => handleToggle('messageMention', v)} label="@Mentions" />
                    <Toggle checked={form.announcement} onChange={v => handleToggle('announcement', v)} label="Announcements" />
                    <Toggle checked={form.deadlineReminder} onChange={v => handleToggle('deadlineReminder', v)} label="Deadline reminders" />
                </div>
            </div>

            {/* Email digest */}
            <div className="mb-6">
                <h3 className="text-sm font-semibold text-zinc-300 mb-2">Email Digest</h3>
                <select
                    value={form.digestEmail}
                    onChange={e => handleToggle('digestEmail', e.target.value)}
                    className="bg-zinc-800/60 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer"
                >
                    <option value="off">Off</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                </select>
            </div>

            <div className="flex justify-end mt-8">
                <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-all hover:shadow-lg hover:shadow-blue-500/20 cursor-pointer">
                    {saving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>
        </div>
    );
};

export default NotificationSettings;
