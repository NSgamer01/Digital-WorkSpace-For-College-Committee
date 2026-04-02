// ============================================
// src/components/settings/AccountSettings.jsx
// ============================================

import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { auth } from '../../firebase/config';

const AccountSettings = () => {
    const { user, firebaseUser } = useAuth();
    const { settings } = useSettings();
    const [showPasswordForm, setShowPasswordForm] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
    const [passwordError, setPasswordError] = useState('');
    const [passwordSuccess, setPasswordSuccess] = useState('');
    const [saving, setSaving] = useState(false);

    const handleChangePassword = async () => {
        setPasswordError('');
        setPasswordSuccess('');

        if (passwordForm.new.length < 6) {
            setPasswordError('New password must be at least 6 characters.');
            return;
        }
        if (passwordForm.new !== passwordForm.confirm) {
            setPasswordError('Passwords do not match.');
            return;
        }

        setSaving(true);
        try {
            const credential = EmailAuthProvider.credential(firebaseUser.email, passwordForm.current);
            await reauthenticateWithCredential(auth.currentUser, credential);
            await updatePassword(auth.currentUser, passwordForm.new);
            setPasswordSuccess('Password updated successfully!');
            setPasswordForm({ current: '', new: '', confirm: '' });
            setTimeout(() => setShowPasswordForm(false), 2000);
        } catch (err) {
            setPasswordError(err.message || 'Failed to update password');
        } finally {
            setSaving(false);
        }
    };

    const createdDate = settings?.profile?.createdAt
        ? new Date(settings.profile.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
        : 'Unknown';

    const lastLogin = firebaseUser?.metadata?.lastSignInTime
        ? new Date(firebaseUser.metadata.lastSignInTime).toLocaleString()
        : 'Unknown';

    return (
        <div>
            {/* Account Info */}
            <div className="space-y-4 mb-8">
                <div className="flex items-center justify-between py-3 border-b border-zinc-800">
                    <div>
                        <p className="text-sm font-medium text-zinc-300">Email</p>
                        <p className="text-sm text-zinc-500">{user?.email || 'N/A'}</p>
                    </div>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-zinc-800">
                    <div>
                        <p className="text-sm font-medium text-zinc-300">Account Created</p>
                        <p className="text-sm text-zinc-500">{createdDate}</p>
                    </div>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-zinc-800">
                    <div>
                        <p className="text-sm font-medium text-zinc-300">Last Login</p>
                        <p className="text-sm text-zinc-500">{lastLogin}</p>
                    </div>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-zinc-800">
                    <div>
                        <p className="text-sm font-medium text-zinc-300">Role</p>
                        <p className="text-sm text-zinc-500 capitalize">{user?.globalRole || 'User'}</p>
                    </div>
                </div>
            </div>

            {/* Password Section */}
            <div className="mb-8">
                <h3 className="text-sm font-semibold text-zinc-300 mb-4">Security</h3>

                {!showPasswordForm ? (
                    <button onClick={() => setShowPasswordForm(true)} className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 hover:text-white text-sm font-medium rounded-xl transition-all cursor-pointer">
                        Change Password
                    </button>
                ) : (
                    <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-xl p-6 max-w-md">
                        {passwordError && <div className="mb-3 px-3 py-2 rounded-lg bg-red-500/15 text-red-400 text-sm">{passwordError}</div>}
                        {passwordSuccess && <div className="mb-3 px-3 py-2 rounded-lg bg-emerald-500/15 text-emerald-400 text-sm">{passwordSuccess}</div>}

                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs text-zinc-500 mb-1">Current Password</label>
                                <input type="password" value={passwordForm.current} onChange={e => setPasswordForm(prev => ({ ...prev, current: e.target.value }))} className="w-full bg-zinc-800/60 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label className="block text-xs text-zinc-500 mb-1">New Password</label>
                                <input type="password" value={passwordForm.new} onChange={e => setPasswordForm(prev => ({ ...prev, new: e.target.value }))} className="w-full bg-zinc-800/60 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label className="block text-xs text-zinc-500 mb-1">Confirm New Password</label>
                                <input type="password" value={passwordForm.confirm} onChange={e => setPasswordForm(prev => ({ ...prev, confirm: e.target.value }))} className="w-full bg-zinc-800/60 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-4">
                            <button onClick={handleChangePassword} disabled={saving} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-all cursor-pointer">
                                {saving ? 'Updating...' : 'Update Password'}
                            </button>
                            <button onClick={() => { setShowPasswordForm(false); setPasswordError(''); }} className="px-4 py-2 border border-zinc-700 hover:bg-zinc-800 text-zinc-400 text-sm rounded-lg transition-all cursor-pointer">
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Danger Zone */}
            <div className="border border-red-500/20 rounded-xl p-6">
                <h3 className="text-sm font-semibold text-red-400 mb-2">Danger Zone</h3>
                <p className="text-zinc-500 text-sm mb-4">Once you delete your account, there is no going back.</p>

                {!showDeleteConfirm ? (
                    <button onClick={() => setShowDeleteConfirm(true)} className="px-5 py-2.5 border border-red-500/30 hover:bg-red-500/10 text-red-400 text-sm font-medium rounded-xl transition-all cursor-pointer">
                        Delete Account
                    </button>
                ) : (
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-zinc-400">Are you sure?</span>
                        <button className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-all cursor-pointer">
                            Yes, delete my account
                        </button>
                        <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 border border-zinc-700 hover:bg-zinc-800 text-zinc-400 text-sm rounded-lg transition-all cursor-pointer">
                            Cancel
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AccountSettings;
