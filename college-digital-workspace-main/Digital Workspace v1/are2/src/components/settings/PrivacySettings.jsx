// ============================================
// src/components/settings/PrivacySettings.jsx
// ============================================

import React, { useState, useEffect } from 'react';
import { useSettings } from '../../contexts/SettingsContext';

const Toggle = ({ checked, onChange, label, description }) => (
    <label className="flex items-center justify-between py-3 cursor-pointer group">
        <div className="pr-4">
            <span className="text-sm text-zinc-300 group-hover:text-white transition-colors block">{label}</span>
            {description && <span className="text-xs text-zinc-500 mt-0.5 block">{description}</span>}
        </div>
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

const PrivacySettings = () => {
    const { settings, updateSettings } = useSettings();
    const [form, setForm] = useState({
        showOnline: true, showLastSeen: true, showEmail: false,
        showPhone: false, profileVisibility: 'committee', allowDms: true,
    });
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);

    useEffect(() => {
        if (settings?.privacy) setForm({ ...settings.privacy });
    }, [settings?.privacy]);

    const handleToggle = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

    const handleSave = async () => {
        setSaving(true);
        const result = await updateSettings('privacy', form);
        setSaving(false);
        setMessage(result.success ? { type: 'success', text: 'Privacy settings updated!' } : { type: 'error', text: result.error });
        setTimeout(() => setMessage(null), 3000);
    };

    return (
        <div>
            {message && (
                <div className={`mb-4 px-4 py-2 rounded-lg text-sm font-medium ${message.type === 'success' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                    {message.text}
                </div>
            )}

            <div className="max-w-lg">
                <div className="mb-6">
                    <h3 className="text-sm font-semibold text-zinc-300 mb-2">Online Status</h3>
                    <div className="divide-y divide-zinc-800">
                        <Toggle checked={form.showOnline} onChange={v => handleToggle('showOnline', v)} label="Show online status" description="Let others see when you're online" />
                        <Toggle checked={form.showLastSeen} onChange={v => handleToggle('showLastSeen', v)} label="Show last seen" description="Display when you were last active" />
                    </div>
                </div>

                <div className="mb-6">
                    <h3 className="text-sm font-semibold text-zinc-300 mb-2">Contact Info</h3>
                    <div className="divide-y divide-zinc-800">
                        <Toggle checked={form.showEmail} onChange={v => handleToggle('showEmail', v)} label="Show email to committee members" />
                        <Toggle checked={form.showPhone} onChange={v => handleToggle('showPhone', v)} label="Show phone to committee members" />
                    </div>
                </div>

                <div className="mb-6">
                    <h3 className="text-sm font-semibold text-zinc-300 mb-2">Profile Visibility</h3>
                    <select
                        value={form.profileVisibility}
                        onChange={e => handleToggle('profileVisibility', e.target.value)}
                        className="w-full bg-zinc-800/60 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer"
                    >
                        <option value="public">Public — Anyone can see your profile</option>
                        <option value="committee">Committee Only — Only committee members</option>
                        <option value="private">Private — Only you</option>
                    </select>
                </div>

                <div className="mb-6">
                    <h3 className="text-sm font-semibold text-zinc-300 mb-2">Messaging</h3>
                    <div className="divide-y divide-zinc-800">
                        <Toggle checked={form.allowDms} onChange={v => handleToggle('allowDms', v)} label="Allow direct messages" description="Let committee members send you direct messages" />
                    </div>
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

export default PrivacySettings;
