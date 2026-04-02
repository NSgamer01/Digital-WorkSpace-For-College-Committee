// ============================================
// src/components/settings/ProfileSettings.jsx
// ============================================

import React, { useState, useEffect, useRef } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { useAuth } from '../../contexts/AuthContext';

const ProfileSettings = () => {
    const { settings, updateSettings, uploadAvatar, uploadCover } = useSettings();
    const { user } = useAuth();
    const [form, setForm] = useState({
        displayName: '', bio: '', phone: '', location: '',
        socialLinkedin: '', socialGithub: '', socialTwitter: '',
    });
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);
    const avatarInputRef = useRef(null);
    const coverInputRef = useRef(null);

    useEffect(() => {
        if (settings?.profile) {
            setForm({
                displayName: settings.profile.displayName || '',
                bio: settings.profile.bio || '',
                phone: settings.profile.phone || '',
                location: settings.profile.location || '',
                socialLinkedin: settings.profile.socialLinkedin || '',
                socialGithub: settings.profile.socialGithub || '',
                socialTwitter: settings.profile.socialTwitter || '',
            });
        }
    }, [settings?.profile]);

    const handleChange = (field, value) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage(null);
        const result = await updateSettings('profile', form);
        setSaving(false);
        setMessage(result.success ? { type: 'success', text: 'Profile updated!' } : { type: 'error', text: result.error || 'Failed' });
        setTimeout(() => setMessage(null), 3000);
    };

    const handleAvatarUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const result = await uploadAvatar(file);
        if (result.success) setMessage({ type: 'success', text: 'Avatar updated!' });
        else setMessage({ type: 'error', text: result.error });
        setTimeout(() => setMessage(null), 3000);
    };

    const handleCoverUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const result = await uploadCover(file);
        if (result.success) setMessage({ type: 'success', text: 'Cover updated!' });
        else setMessage({ type: 'error', text: result.error });
        setTimeout(() => setMessage(null), 3000);
    };

    const userInitials = (form.displayName || user?.email || '??')
        .split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

    return (
        <div>
            {message && (
                <div className={`mb-4 px-4 py-2 rounded-lg text-sm font-medium ${message.type === 'success' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                    {message.text}
                </div>
            )}

            {/* Cover Photo */}
            <div className="relative mb-8">
                <div
                    onClick={() => coverInputRef.current?.click()}
                    className="w-full h-32 rounded-xl bg-gradient-to-r from-indigo-500/30 to-purple-500/30 cursor-pointer hover:opacity-80 transition-opacity flex items-center justify-center overflow-hidden"
                    style={{
                        backgroundImage: settings?.profile?.coverPhoto ? `url(${settings.profile.coverPhoto})` : undefined,
                        backgroundSize: 'cover', backgroundPosition: 'center',
                    }}
                >
                    {!settings?.profile?.coverPhoto && (
                        <span className="text-zinc-400 text-sm">Click to upload cover photo</span>
                    )}
                </div>
                <input ref={coverInputRef} type="file" accept="image/*" onChange={handleCoverUpload} className="hidden" />
            </div>

            {/* Avatar */}
            <div className="flex flex-col sm:flex-row items-center gap-6 mb-8">
                <div
                    onClick={() => avatarInputRef.current?.click()}
                    className="w-[100px] h-[100px] rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center text-white text-3xl font-bold cursor-pointer hover:opacity-80 transition-opacity shadow-lg flex-shrink-0 overflow-hidden"
                >
                    {settings?.profile?.avatar ? (
                        <img src={settings.profile.avatar} alt="avatar" className="w-full h-full object-cover" />
                    ) : userInitials}
                </div>
                <div className="text-center sm:text-left">
                    <button onClick={() => avatarInputRef.current?.click()} className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 hover:text-white text-sm font-medium rounded-xl transition-all cursor-pointer">
                        Change Photo
                    </button>
                    <p className="text-zinc-500 text-xs mt-2">JPG, PNG or GIF. Max size 5MB</p>
                </div>
                <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
            </div>

            {/* Form */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm text-zinc-400 mb-2">Display Name</label>
                    <input type="text" value={form.displayName} onChange={e => handleChange('displayName', e.target.value)} placeholder="Enter your full name" className="w-full bg-zinc-800/60 border border-zinc-700 rounded-lg px-4 py-3 text-white text-sm placeholder-zinc-600 outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                </div>
                <div>
                    <label className="block text-sm text-zinc-400 mb-2">Email</label>
                    <input type="email" value={settings?.profile?.email || user?.email || ''} disabled className="w-full bg-zinc-800/30 border border-zinc-700/50 rounded-lg px-4 py-3 text-zinc-500 text-sm cursor-not-allowed outline-none" />
                    <p className="text-zinc-600 text-xs mt-1.5">Email cannot be changed</p>
                </div>
                <div>
                    <label className="block text-sm text-zinc-400 mb-2">Phone</label>
                    <input type="tel" value={form.phone} onChange={e => handleChange('phone', e.target.value)} placeholder="Enter your phone number" className="w-full bg-zinc-800/60 border border-zinc-700 rounded-lg px-4 py-3 text-white text-sm placeholder-zinc-600 outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                </div>
                <div>
                    <label className="block text-sm text-zinc-400 mb-2">Location</label>
                    <input type="text" value={form.location} onChange={e => handleChange('location', e.target.value)} placeholder="City, Country" className="w-full bg-zinc-800/60 border border-zinc-700 rounded-lg px-4 py-3 text-white text-sm placeholder-zinc-600 outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                </div>
            </div>

            {/* Bio */}
            <div className="mt-6">
                <label className="block text-sm text-zinc-400 mb-2">Bio</label>
                <textarea value={form.bio} onChange={e => handleChange('bio', e.target.value.slice(0, 200))} placeholder="Tell us about yourself..." maxLength={200} rows={4} className="w-full bg-zinc-800/60 border border-zinc-700 rounded-lg px-4 py-3 text-white text-sm placeholder-zinc-600 outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none" />
                <p className="text-zinc-600 text-xs mt-1.5 text-right">{form.bio.length}/200 characters</p>
            </div>

            {/* Social Links */}
            <div className="mt-6">
                <h3 className="text-sm font-semibold text-zinc-300 mb-4">Social Links</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-xs text-zinc-500 mb-1.5">LinkedIn</label>
                        <input type="url" value={form.socialLinkedin} onChange={e => handleChange('socialLinkedin', e.target.value)} placeholder="https://linkedin.com/in/..." className="w-full bg-zinc-800/60 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-zinc-600 outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                    </div>
                    <div>
                        <label className="block text-xs text-zinc-500 mb-1.5">GitHub</label>
                        <input type="url" value={form.socialGithub} onChange={e => handleChange('socialGithub', e.target.value)} placeholder="https://github.com/..." className="w-full bg-zinc-800/60 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-zinc-600 outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                    </div>
                    <div>
                        <label className="block text-xs text-zinc-500 mb-1.5">Twitter</label>
                        <input type="url" value={form.socialTwitter} onChange={e => handleChange('socialTwitter', e.target.value)} placeholder="https://twitter.com/..." className="w-full bg-zinc-800/60 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-zinc-600 outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-4 mt-8">
                <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-all hover:shadow-lg hover:shadow-blue-500/20 cursor-pointer disabled:cursor-not-allowed">
                    {saving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>
        </div>
    );
};

export default ProfileSettings;
