// ============================================
// src/pages/Settings.jsx — Full Settings Page
// ============================================
// Two-column layout: left sidebar navigation,
// right content area renders the active section.
// ============================================

import React, { useState } from 'react';
import ProfileSettings from '../components/settings/ProfileSettings';
import AccountSettings from '../components/settings/AccountSettings';
import NotificationSettings from '../components/settings/NotificationSettings';

import PrivacySettings from '../components/settings/PrivacySettings';
import AppearanceSettings from '../components/settings/AppearanceSettings';
import AccessibilitySettings from '../components/settings/AccessibilitySettings';
import { useSettings } from '../contexts/SettingsContext';

const settingsTabs = [
    { key: 'profile', label: 'Profile', icon: '👤', description: 'Manage your personal information' },
    { key: 'account', label: 'Account', icon: '🔐', description: 'Security and account management' },
    { key: 'notifications', label: 'Notifications', icon: '🔔', description: 'Control your notification preferences' },

    { key: 'privacy', label: 'Privacy', icon: '🔒', description: 'Manage visibility and privacy' },
    { key: 'appearance', label: 'Appearance', icon: '🎨', description: 'Themes, colors, and display' },
    { key: 'accessibility', label: 'Accessibility', icon: '♿', description: 'Accessibility features' },
];

const sectionComponents = {
    profile: ProfileSettings,
    account: AccountSettings,
    notifications: NotificationSettings,

    privacy: PrivacySettings,
    appearance: AppearanceSettings,
    accessibility: AccessibilitySettings,
};

const Settings = () => {
    const [activeTab, setActiveTab] = useState('profile');
    const { loading } = useSettings();

    const currentTab = settingsTabs.find(t => t.key === activeTab);
    const ActiveComponent = sectionComponents[activeTab];

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center">
                    <div className="w-10 h-10 border-3 border-zinc-700 border-t-indigo-500 rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-zinc-400 text-sm">Loading settings...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="px-6 md:px-10 py-8 w-full max-w-7xl mx-auto">
            {/* Page Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-semibold tracking-tight text-white">Settings</h1>
                <p className="text-zinc-400 text-sm mt-1.5">Manage your account preferences</p>
            </div>

            {/* Two-column layout */}
            <div className="flex gap-8 min-h-[600px]">
                {/* Left Sidebar */}
                <nav className="w-[220px] flex-shrink-0">
                    <div className="space-y-1 sticky top-8">
                        {settingsTabs.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer text-left ${activeTab === tab.key
                                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                                    }`}
                            >
                                <span className="text-base flex-shrink-0">{tab.icon}</span>
                                <span>{tab.label}</span>
                            </button>
                        ))}
                    </div>
                </nav>

                {/* Right Content */}
                <div className="flex-1 min-w-0">
                    <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-2xl p-8 backdrop-blur-sm">
                        {/* Section Header */}
                        <div className="flex items-center gap-4 mb-8 pb-6 border-b border-zinc-800">
                            <div className="w-12 h-12 rounded-xl bg-indigo-500/15 flex items-center justify-center text-2xl">
                                {currentTab?.icon}
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-white">{currentTab?.label}</h2>
                                <p className="text-zinc-500 text-sm mt-0.5">{currentTab?.description}</p>
                            </div>
                        </div>

                        {/* Active Section Component */}
                        {ActiveComponent && <ActiveComponent />}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;
