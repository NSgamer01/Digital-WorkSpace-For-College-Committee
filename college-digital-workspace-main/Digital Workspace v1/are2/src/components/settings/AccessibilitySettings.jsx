// ============================================
// src/components/settings/AccessibilitySettings.jsx
// ============================================
// Actual functional accessibility settings that apply
// CSS changes in real-time via document.documentElement.
// ============================================

import React, { useState, useEffect, useCallback } from 'react';
import { useSettings } from '../../contexts/SettingsContext';

const Toggle = ({ checked, onChange, label, description }) => (
    <label className="flex items-center justify-between py-4 cursor-pointer group">
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

const AccessibilitySettings = () => {
    const { settings, updateSettings } = useSettings();
    const [form, setForm] = useState({
        reduceMotion: false,
        highContrast: false,
        screenReaderMode: false,
    });
    const [fontSize, setFontSize] = useState(100); // percentage: 75-150
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);

    // ── Apply Reduce Motion in real-time ──
    const applyReduceMotion = useCallback((enabled) => {
        const root = document.documentElement;
        if (enabled) {
            root.classList.add('reduce-motion');
            let style = document.getElementById('a11y-reduce-motion');
            if (!style) {
                style = document.createElement('style');
                style.id = 'a11y-reduce-motion';
                document.head.appendChild(style);
            }
            style.textContent = `
                .reduce-motion *, .reduce-motion *::before, .reduce-motion *::after {
                    animation-duration: 0.01ms !important;
                    animation-iteration-count: 1 !important;
                    transition-duration: 0.01ms !important;
                    scroll-behavior: auto !important;
                }
            `;
        } else {
            root.classList.remove('reduce-motion');
            const style = document.getElementById('a11y-reduce-motion');
            if (style) style.remove();
        }
    }, []);

    // ── Apply High Contrast in real-time ──
    const applyHighContrast = useCallback((enabled) => {
        const root = document.documentElement;
        if (enabled) {
            root.classList.add('high-contrast');
            let style = document.getElementById('a11y-high-contrast');
            if (!style) {
                style = document.createElement('style');
                style.id = 'a11y-high-contrast';
                document.head.appendChild(style);
            }
            style.textContent = `
                .high-contrast {
                    --textPrimary: #ffffff !important;
                    --textSecondary: #e5e5e5 !important;
                    --textTertiary: #cccccc !important;
                    --border: rgba(255, 255, 255, 0.3) !important;
                    --borderLight: rgba(255, 255, 255, 0.2) !important;
                    --cardBorder: rgba(255, 255, 255, 0.3) !important;
                }
                .high-contrast * {
                    border-color: rgba(255, 255, 255, 0.3) !important;
                }
                .high-contrast p, .high-contrast span, .high-contrast div,
                .high-contrast h1, .high-contrast h2, .high-contrast h3,
                .high-contrast h4, .high-contrast h5, .high-contrast h6,
                .high-contrast label, .high-contrast a, .high-contrast button {
                    text-shadow: 0 0 1px rgba(255,255,255,0.1);
                }
                .high-contrast input, .high-contrast textarea, .high-contrast select {
                    border-width: 2px !important;
                    border-color: rgba(255, 255, 255, 0.4) !important;
                }
                .high-contrast button {
                    font-weight: 600 !important;
                }
            `;
        } else {
            root.classList.remove('high-contrast');
            const style = document.getElementById('a11y-high-contrast');
            if (style) style.remove();
        }
    }, []);

    // ── Apply Screen Reader Mode in real-time ──
    const applyScreenReaderMode = useCallback((enabled) => {
        const root = document.documentElement;
        if (enabled) {
            root.classList.add('screen-reader-mode');
            root.setAttribute('role', 'application');
            let style = document.getElementById('a11y-screen-reader');
            if (!style) {
                style = document.createElement('style');
                style.id = 'a11y-screen-reader';
                document.head.appendChild(style);
            }
            style.textContent = `
                .screen-reader-mode *:focus {
                    outline: 3px solid #6366f1 !important;
                    outline-offset: 2px !important;
                }
                .screen-reader-mode *:focus:not(:focus-visible) {
                    outline: none !important;
                }
                .screen-reader-mode *:focus-visible {
                    outline: 3px solid #6366f1 !important;
                    outline-offset: 2px !important;
                }
                .screen-reader-mode [aria-hidden="true"] {
                    display: none !important;
                }
                .screen-reader-mode img:not([alt]) {
                    outline: 3px dashed #ef4444 !important;
                }
                .screen-reader-mode button, .screen-reader-mode a,
                .screen-reader-mode input, .screen-reader-mode select,
                .screen-reader-mode textarea {
                    min-height: 44px;
                    min-width: 44px;
                }
            `;
        } else {
            root.classList.remove('screen-reader-mode');
            root.removeAttribute('role');
            const style = document.getElementById('a11y-screen-reader');
            if (style) style.remove();
        }
    }, []);

    // ── Apply Font Size in real-time ──
    const applyFontSize = useCallback((size) => {
        document.documentElement.style.fontSize = `${size}%`;
        localStorage.setItem('a11y-font-size', String(size));
    }, []);

    // Load saved settings (MUST be after useCallback definitions above)
    useEffect(() => {
        if (settings?.accessibility) {
            const saved = settings.accessibility;
            setForm({
                reduceMotion: saved.reduceMotion || false,
                highContrast: saved.highContrast || false,
                screenReaderMode: saved.screenReaderMode || false,
            });
            const savedSize = saved.fontSize || parseInt(localStorage.getItem('a11y-font-size') || '100');
            setFontSize(savedSize);

            // Re-apply CSS effects from saved settings
            applyReduceMotion(saved.reduceMotion || false);
            applyHighContrast(saved.highContrast || false);
            applyScreenReaderMode(saved.screenReaderMode || false);
            applyFontSize(savedSize);
        } else {
            // Fallback: load font size from localStorage
            const savedFontSize = localStorage.getItem('a11y-font-size');
            if (savedFontSize) {
                const size = parseInt(savedFontSize);
                setFontSize(size);
                applyFontSize(size);
            }
        }
    }, [settings?.accessibility, applyReduceMotion, applyHighContrast, applyScreenReaderMode, applyFontSize]);

    const handleToggle = (field, value) => {
        setForm(prev => ({ ...prev, [field]: value }));

        // Apply immediately
        if (field === 'reduceMotion') applyReduceMotion(value);
        if (field === 'highContrast') applyHighContrast(value);
        if (field === 'screenReaderMode') applyScreenReaderMode(value);
    };

    const handleFontSizeChange = (value) => {
        setFontSize(value);
        applyFontSize(value);
    };

    const handleSave = async () => {
        setSaving(true);
        // Include fontSize in the save payload so it persists to the account
        const result = await updateSettings('accessibility', { ...form, fontSize });
        setSaving(false);
        setMessage(result.success ? { type: 'success', text: 'Accessibility settings saved!' } : { type: 'error', text: result.error });
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
                <p className="text-zinc-500 text-sm mb-6">
                    Configure accessibility features. Changes apply instantly.
                </p>

                {/* Toggle settings */}
                <div className="divide-y divide-zinc-800">
                    <Toggle
                        checked={form.reduceMotion}
                        onChange={v => handleToggle('reduceMotion', v)}
                        label="Reduce motion"
                        description="Disables all animations and transitions throughout the interface"
                    />
                    <Toggle
                        checked={form.highContrast}
                        onChange={v => handleToggle('highContrast', v)}
                        label="High contrast mode"
                        description="Increases contrast between text and backgrounds, thickens borders"
                    />
                    <Toggle
                        checked={form.screenReaderMode}
                        onChange={v => handleToggle('screenReaderMode', v)}
                        label="Screen reader optimizations"
                        description="Enhances focus indicators, enforces minimum touch targets (44px), adds ARIA regions"
                    />
                </div>

                {/* Font Size Slider */}
                <div className="mt-6">
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-sm text-zinc-300 font-medium">Text Size</label>
                        <span className="text-xs text-zinc-500">{fontSize}%</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-zinc-500">A</span>
                        <input
                            type="range"
                            min="75"
                            max="150"
                            step="5"
                            value={fontSize}
                            onChange={e => handleFontSizeChange(parseInt(e.target.value))}
                            className="flex-1 h-2 bg-zinc-700 rounded-full appearance-none cursor-pointer accent-indigo-500"
                        />
                        <span className="text-lg text-zinc-500">A</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-zinc-600 mt-1">
                        <span>Smaller</span>
                        <span>Default</span>
                        <span>Larger</span>
                    </div>
                    {fontSize !== 100 && (
                        <button
                            onClick={() => handleFontSizeChange(100)}
                            className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer"
                        >
                            Reset to default (100%)
                        </button>
                    )}
                </div>

                {/* Live Preview */}
                <div className="mt-6 bg-zinc-800/40 border border-zinc-700/50 rounded-xl p-5">
                    <h4 className="text-sm font-semibold text-zinc-300 mb-3">Live Preview</h4>
                    <div className="space-y-3">
                        <p className="text-sm text-zinc-400">
                            This text shows how your accessibility settings affect the interface. Toggle the options above to see changes in real-time.
                        </p>
                        <div className="flex gap-2">
                            <button className="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg">
                                Sample Button
                            </button>
                            <button className="px-3 py-1.5 bg-zinc-700 text-zinc-300 text-xs rounded-lg border border-zinc-600">
                                Another Button
                            </button>
                        </div>
                        <input
                            type="text"
                            placeholder="Sample input field"
                            className="w-full bg-zinc-800/60 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm placeholder-zinc-600 outline-none"
                            readOnly
                        />
                    </div>
                </div>

                {/* Keyboard Shortcuts */}
                <div className="mt-6 bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                        <span className="text-lg">⌨️</span>
                        <div>
                            <p className="text-sm text-blue-300 font-medium">Keyboard Navigation</p>
                            <p className="text-xs text-blue-400/70 mt-1 mb-2">
                                Navigate using keyboard shortcuts for faster access:
                            </p>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                                <div className="flex items-center gap-2">
                                    <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-300 font-mono">Tab</kbd>
                                    <span className="text-zinc-500">Next element</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-300 font-mono">Shift+Tab</kbd>
                                    <span className="text-zinc-500">Previous element</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-300 font-mono">Enter</kbd>
                                    <span className="text-zinc-500">Activate</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-300 font-mono">Esc</kbd>
                                    <span className="text-zinc-500">Close/Cancel</span>
                                </div>
                            </div>
                        </div>
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

export default AccessibilitySettings;
