// ============================================
// src/components/settings/StorageSettings.jsx
// ============================================

import React, { useState, useEffect } from 'react';
import { useSettings } from '../../contexts/SettingsContext';

const StorageSettings = () => {
    const { settings, updateSettings } = useSettings();
    const [form, setForm] = useState({
        autoDeleteTrashDays: 30,
        downloadQuality: 'original',
    });
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);

    useEffect(() => {
        if (settings?.storage) setForm({ ...settings.storage });
    }, [settings?.storage]);

    const handleSave = async () => {
        setSaving(true);
        const result = await updateSettings('storage', form);
        setSaving(false);
        setMessage(result.success ? { type: 'success', text: 'Storage settings updated!' } : { type: 'error', text: result.error });
        setTimeout(() => setMessage(null), 3000);
    };

    // Simulated storage usage (in a real app, fetch from backend)
    const storageUsed = 2.4; // GB
    const storageLimit = 10; // GB
    const usagePercent = (storageUsed / storageLimit) * 100;

    return (
        <div>
            {message && (
                <div className={`mb-4 px-4 py-2 rounded-lg text-sm font-medium ${message.type === 'success' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                    {message.text}
                </div>
            )}

            {/* Storage Usage */}
            <div className="mb-8 max-w-lg">
                <h3 className="text-sm font-semibold text-zinc-300 mb-4">Storage Usage</h3>
                <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-xl p-5">
                    <div className="flex justify-between text-sm mb-2">
                        <span className="text-zinc-400">{storageUsed} GB used</span>
                        <span className="text-zinc-500">{storageLimit} GB total</span>
                    </div>
                    <div className="w-full h-2.5 bg-zinc-700 rounded-full overflow-hidden">
                        <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                                width: `${usagePercent}%`,
                                background: usagePercent > 80
                                    ? 'linear-gradient(90deg, #f59e0b, #ef4444)'
                                    : 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                            }}
                        />
                    </div>

                    {/* Breakdown */}
                    <div className="mt-4 space-y-2">
                        {[
                            { label: 'Files', size: '1.8 GB', color: '#6366f1' },
                            { label: 'Folders', size: '0.4 GB', color: '#8b5cf6' },
                            { label: 'Attachments', size: '0.2 GB', color: '#3b82f6' },
                        ].map(item => (
                            <div key={item.label} className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                    <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: item.color }} />
                                    <span className="text-zinc-400">{item.label}</span>
                                </div>
                                <span className="text-zinc-500">{item.size}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Auto-Delete Trash */}
            <div className="mb-6 max-w-lg">
                <label className="block text-sm text-zinc-400 mb-2">Auto-delete trash after</label>
                <select
                    value={form.autoDeleteTrashDays}
                    onChange={e => setForm(prev => ({ ...prev, autoDeleteTrashDays: parseInt(e.target.value) }))}
                    className="w-full bg-zinc-800/60 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer"
                >
                    <option value={7}>7 days</option>
                    <option value={14}>14 days</option>
                    <option value={30}>30 days</option>
                    <option value={60}>60 days</option>
                    <option value={90}>90 days</option>
                    <option value={0}>Never</option>
                </select>
            </div>

            {/* Download Quality */}
            <div className="mb-6 max-w-lg">
                <label className="block text-sm text-zinc-400 mb-2">Download Quality</label>
                <select
                    value={form.downloadQuality}
                    onChange={e => setForm(prev => ({ ...prev, downloadQuality: e.target.value }))}
                    className="w-full bg-zinc-800/60 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer"
                >
                    <option value="original">Original quality</option>
                    <option value="compressed">Compressed (save bandwidth)</option>
                </select>
            </div>

            {/* Quick Actions */}
            <div className="mb-8 max-w-lg">
                <h3 className="text-sm font-semibold text-zinc-300 mb-3">Quick Actions</h3>
                <div className="flex gap-3">
                    <button className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 hover:text-white text-sm rounded-lg transition-all cursor-pointer">
                        🗑️ Clear Trash Now
                    </button>
                    <button className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 hover:text-white text-sm rounded-lg transition-all cursor-pointer">
                        📦 Export My Data
                    </button>
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

export default StorageSettings;
