// ============================================
// src/components/settings/CalendarSettings.jsx
// ============================================

import React, { useState, useEffect } from 'react';
import { useSettings } from '../../contexts/SettingsContext';

const CalendarSettings = () => {
    const { settings, updateSettings } = useSettings();
    const [form, setForm] = useState({
        defaultView: 'month',
        workingHoursStart: '09:00',
        workingHoursEnd: '17:00',
        weekStartsOn: 1,
        googleConnected: false,
        syncEnabled: false,
    });
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);

    useEffect(() => {
        if (settings?.calendar) {
            setForm({ ...settings.calendar });
        }
    }, [settings?.calendar]);

    const handleChange = (field, value) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        setSaving(true);
        const result = await updateSettings('calendar', form);
        setSaving(false);
        setMessage(result.success ? { type: 'success', text: 'Calendar settings updated!' } : { type: 'error', text: result.error });
        setTimeout(() => setMessage(null), 3000);
    };

    const weekDays = [
        { value: 0, label: 'Sunday' },
        { value: 1, label: 'Monday' },
        { value: 2, label: 'Tuesday' },
        { value: 3, label: 'Wednesday' },
        { value: 4, label: 'Thursday' },
        { value: 5, label: 'Friday' },
        { value: 6, label: 'Saturday' },
    ];

    return (
        <div>
            {message && (
                <div className={`mb-4 px-4 py-2 rounded-lg text-sm font-medium ${message.type === 'success' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                    {message.text}
                </div>
            )}

            <div className="space-y-6 max-w-lg">
                {/* Default View */}
                <div>
                    <label className="block text-sm text-zinc-400 mb-2">Default View</label>
                    <select
                        value={form.defaultView}
                        onChange={e => handleChange('defaultView', e.target.value)}
                        className="w-full bg-zinc-800/60 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer"
                    >
                        <option value="month">Month</option>
                        <option value="week">Week</option>
                        <option value="day">Day</option>
                        <option value="agenda">Agenda</option>
                    </select>
                </div>

                {/* Working Hours */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm text-zinc-400 mb-2">Working Hours Start</label>
                        <input
                            type="time"
                            value={form.workingHoursStart}
                            onChange={e => handleChange('workingHoursStart', e.target.value)}
                            className="w-full bg-zinc-800/60 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-zinc-400 mb-2">Working Hours End</label>
                        <input
                            type="time"
                            value={form.workingHoursEnd}
                            onChange={e => handleChange('workingHoursEnd', e.target.value)}
                            className="w-full bg-zinc-800/60 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        />
                    </div>
                </div>

                {/* Week Starts On */}
                <div>
                    <label className="block text-sm text-zinc-400 mb-2">Week Starts On</label>
                    <select
                        value={form.weekStartsOn}
                        onChange={e => handleChange('weekStartsOn', parseInt(e.target.value))}
                        className="w-full bg-zinc-800/60 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer"
                    >
                        {weekDays.map(d => (
                            <option key={d.value} value={d.value}>{d.label}</option>
                        ))}
                    </select>
                </div>

                {/* Google Calendar */}
                <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-2">
                        <span className="text-lg">📅</span>
                        <h4 className="text-sm font-semibold text-zinc-300">Google Calendar</h4>
                        <span className="px-2 py-0.5 bg-amber-500/15 text-amber-400 text-xs font-medium rounded-full">Coming Soon</span>
                    </div>
                    <p className="text-zinc-500 text-sm">Sync your workspace calendar with Google Calendar for seamless scheduling.</p>
                </div>
            </div>

            <div className="flex justify-end mt-8">
                <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-all hover:shadow-lg hover:shadow-blue-500/20 cursor-pointer">
                    {saving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>
        </div>
    );
};

export default CalendarSettings;
