// ============================================
// src/components/settings/AppearanceSettings.jsx
// ============================================
// Fully functional — all controls instantly apply via ThemeContext.
// Theme switching, accent color, compact mode, and font size
// all take effect immediately without needing "Save".
// ============================================

import React, { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import ThemeSelector from '../ThemeSelector';

const presetAccentColors = [
    { color: '#6366f1', name: 'Indigo' },
    { color: '#8b5cf6', name: 'Purple' },
    { color: '#3b82f6', name: 'Blue' },
    { color: '#06b6d4', name: 'Cyan' },
    { color: '#10b981', name: 'Emerald' },
    { color: '#f59e0b', name: 'Amber' },
    { color: '#ef4444', name: 'Red' },
    { color: '#ec4899', name: 'Pink' },
    { color: '#f97316', name: 'Orange' },
    { color: '#14b8a6', name: 'Teal' },
];

const fontSizeOptions = [
    { value: 'small', label: 'Small', desc: '14px — Compact reading' },
    { value: 'medium', label: 'Medium', desc: '16px — Default' },
    { value: 'large', label: 'Large', desc: '18px — Easier to read' },
];

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

// ── Gradient presets with boosted opacity for visibility ──────────
const GRADIENT_PRESETS = [
    { id: 'aurora', name: 'Aurora', gradient: 'linear-gradient(135deg, rgba(99,102,241,0.18) 0%, rgba(139,92,246,0.12) 50%, rgba(6,182,212,0.10) 100%)' },
    { id: 'sunset', name: 'Sunset', gradient: 'linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(249,115,22,0.12) 50%, rgba(245,158,11,0.08) 100%)' },
    { id: 'ocean', name: 'Ocean', gradient: 'linear-gradient(135deg, rgba(6,182,212,0.16) 0%, rgba(59,130,246,0.12) 50%, rgba(99,102,241,0.08) 100%)' },
    { id: 'forest', name: 'Forest', gradient: 'linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(5,150,105,0.12) 50%, rgba(20,184,166,0.08) 100%)' },
    { id: 'rose', name: 'Rose', gradient: 'linear-gradient(135deg, rgba(236,72,153,0.15) 0%, rgba(139,92,246,0.12) 50%, rgba(99,102,241,0.08) 100%)' },
    { id: 'golden', name: 'Golden', gradient: 'linear-gradient(135deg, rgba(245,158,11,0.16) 0%, rgba(251,191,36,0.12) 50%, rgba(234,179,8,0.08) 100%)' },
    { id: 'midnight', name: 'Midnight', gradient: 'linear-gradient(135deg, rgba(30,27,75,0.45) 0%, rgba(88,28,135,0.25) 50%, rgba(30,58,138,0.15) 100%)' },
    { id: 'neon', name: 'Neon', gradient: 'linear-gradient(135deg, rgba(34,211,238,0.14) 0%, rgba(168,85,247,0.12) 50%, rgba(236,72,153,0.10) 100%)' },
];

function applyGradientOverlay(gradient) {
    let overlay = document.getElementById('bg-gradient-overlay');
    if (!gradient) {
        if (overlay) overlay.remove();
        return;
    }
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'bg-gradient-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:0;pointer-events:none;transition:background 0.5s ease;';
        document.body.prepend(overlay);
    }
    overlay.style.background = gradient;
}

const GradientPicker = ({ showMessage }) => {
    const [activeId, setActiveId] = useState(() => localStorage.getItem('bgGradient') || 'none');

    // Restore gradient on mount
    useEffect(() => {
        const savedId = localStorage.getItem('bgGradient');
        if (savedId && savedId !== 'none') {
            const preset = GRADIENT_PRESETS.find(p => p.id === savedId);
            if (preset) applyGradientOverlay(preset.gradient);
        }
    }, []);

    const selectGradient = (id, gradient, name) => {
        if (id === 'none') {
            applyGradientOverlay(null);
            localStorage.setItem('bgGradient', 'none');
            localStorage.removeItem('bgGradientCSS');
            setActiveId('none');
            showMessage('Gradient removed');
        } else {
            applyGradientOverlay(gradient);
            localStorage.setItem('bgGradient', id);
            localStorage.setItem('bgGradientCSS', gradient);
            setActiveId(id);
            showMessage(`Gradient: ${name}`);
        }
    };

    return (
        <div className="mb-8">
            <h3 className="text-sm font-semibold text-zinc-300 mb-1">Background Gradient</h3>
            <p className="text-xs text-zinc-500 mb-4">Add a subtle gradient tint to the page background</p>
            <div className="flex flex-wrap gap-3 items-center">
                {/* None option */}
                <div className="relative group">
                    <button onClick={() => selectGradient('none')} title="None"
                        style={{
                            width: 36, height: 36, borderRadius: 10, backgroundColor: '#27272a',
                            border: activeId === 'none' ? '2.5px solid white' : '2.5px solid transparent',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 14, color: '#a1a1aa',
                        }}>✕</button>
                    <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <span className="text-[10px] text-zinc-400 whitespace-nowrap">None</span>
                    </div>
                </div>
                {GRADIENT_PRESETS.map(({ id, name, gradient }) => (
                    <div key={id} className="relative group">
                        <button onClick={() => selectGradient(id, gradient, name)} title={name}
                            style={{
                                width: 36, height: 36, borderRadius: 10,
                                background: gradient.replace(/0\.\d+\)/g, '0.6)'),
                                border: activeId === id ? '2.5px solid white' : '2.5px solid transparent',
                                cursor: 'pointer', transition: 'all 0.2s ease',
                                boxShadow: activeId === id ? '0 0 12px rgba(255,255,255,0.15)' : 'none',
                                transform: activeId === id ? 'scale(1.1)' : 'scale(1)',
                            }}>
                            {activeId === id && <span style={{ color: 'white', fontSize: 14, fontWeight: 'bold', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>✓</span>}
                        </button>
                        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                            <span className="text-[10px] text-zinc-400 whitespace-nowrap">{name}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const AppearanceSettings = () => {
    const {
        currentTheme, accentColor, setAccentColor,
        compactMode, setCompactMode,
        fontSize, setFontSize,
    } = useTheme();

    const [customColor, setCustomColor] = useState('');
    const [message, setMessage] = useState(null);

    const showMessage = (text) => {
        setMessage(text);
        setTimeout(() => setMessage(null), 2000);
    };

    const handleAccentChange = (color) => {
        setAccentColor(color);
        showMessage(`Accent color set to ${color}`);
    };

    const handleCustomColorApply = () => {
        if (/^#[0-9a-fA-F]{6}$/.test(customColor)) {
            handleAccentChange(customColor);
            setCustomColor('');
        } else {
            setMessage('Invalid hex color. Use format: #FF5733');
            setTimeout(() => setMessage(null), 2000);
        }
    };

    return (
        <div>
            {message && (
                <div className="mb-4 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-500/15 text-emerald-400 transition-opacity">
                    {message}
                </div>
            )}

            {/* Note: changes apply instantly */}
            <div className="mb-6 px-3 py-2 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
                <p className="text-xs text-zinc-400">
                    ⚡ All changes apply instantly. No save needed.
                </p>
            </div>

            {/* ── Theme Selection ── */}
            <div className="mb-8">
                <h3 className="text-sm font-semibold text-zinc-300 mb-4">Theme</h3>
                <ThemeSelector />
            </div>

            {/* ── Accent Color ── */}
            <div className="mb-8">
                <h3 className="text-sm font-semibold text-zinc-300 mb-1">Accent Color</h3>
                <p className="text-xs text-zinc-500 mb-4">Changes buttons, links, active states, and highlights across the app</p>

                <div className="flex flex-wrap gap-3 items-center">
                    {presetAccentColors.map(({ color, name }) => (
                        <div key={color} className="relative group">
                            <button
                                onClick={() => handleAccentChange(color)}
                                title={name}
                                style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 10,
                                    backgroundColor: color,
                                    border: accentColor === color
                                        ? '2.5px solid white'
                                        : '2.5px solid transparent',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    boxShadow: accentColor === color
                                        ? `0 0 16px ${color}50, 0 2px 8px ${color}30`
                                        : 'none',
                                    transform: accentColor === color ? 'scale(1.1)' : 'scale(1)',
                                }}
                            >
                                {accentColor === color && (
                                    <span style={{
                                        position: 'absolute', inset: 0,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: 'white', fontSize: 16, fontWeight: 'bold',
                                        textShadow: '0 1px 3px rgba(0,0,0,0.4)',
                                    }}>✓</span>
                                )}
                            </button>
                            {/* Tooltip */}
                            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                <span className="text-[10px] text-zinc-400 whitespace-nowrap">{name}</span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Custom color input */}
                <div className="flex items-center gap-2 mt-5">
                    <div
                        style={{
                            width: 32, height: 32, borderRadius: 8,
                            backgroundColor: /^#[0-9a-fA-F]{6}$/.test(customColor) ? customColor : '#3f3f46',
                            border: '2px solid var(--border)',
                            transition: 'background-color 0.15s ease',
                            flexShrink: 0,
                        }}
                    />
                    <input
                        type="text"
                        value={customColor}
                        onChange={e => setCustomColor(e.target.value)}
                        placeholder="#hex color"
                        maxLength={7}
                        onKeyDown={e => e.key === 'Enter' && handleCustomColorApply()}
                        className="w-28 bg-zinc-800/60 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                    <button
                        onClick={handleCustomColorApply}
                        className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 hover:text-white text-sm rounded-lg transition-all cursor-pointer"
                    >
                        Apply
                    </button>
                    <span className="text-xs text-zinc-500 ml-1">Current: <code className="text-zinc-400">{accentColor}</code></span>
                </div>
            </div>

            {/* ── Gradient Background ── */}
            <GradientPicker showMessage={showMessage} />

            {/* ── Font Size ── */}
            <div className="mb-8">
                <h3 className="text-sm font-semibold text-zinc-300 mb-1">Font Size</h3>
                <p className="text-xs text-zinc-500 mb-4">Adjusts the base text size across the entire application</p>

                <div className="flex gap-3">
                    {fontSizeOptions.map((option) => (
                        <button
                            key={option.value}
                            onClick={() => setFontSize(option.value)}
                            className="flex-1 text-left cursor-pointer transition-all"
                            style={{
                                padding: '14px 16px',
                                borderRadius: 12,
                                border: fontSize === option.value
                                    ? `2px solid var(--accent, #6366f1)`
                                    : '2px solid var(--border)',
                                background: fontSize === option.value
                                    ? 'var(--accentLight, rgba(99,102,241,0.15))'
                                    : 'var(--bgSecondary)',
                            }}
                        >
                            <span style={{
                                fontSize: option.value === 'small' ? 13 : option.value === 'large' ? 17 : 15,
                                fontWeight: 600,
                                color: fontSize === option.value ? 'var(--accent)' : 'var(--textPrimary)',
                                display: 'block',
                            }}>
                                {option.label}
                            </span>
                            <span style={{
                                fontSize: 11,
                                color: 'var(--textTertiary)',
                                display: 'block',
                                marginTop: 2,
                            }}>
                                {option.desc}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Compact Mode ── */}
            <div className="mb-8 max-w-lg">
                <div className="divide-y divide-zinc-800">
                    <Toggle
                        checked={compactMode}
                        onChange={setCompactMode}
                        label="Compact mode"
                        description="Reduce spacing and padding for a denser layout — fits more content on screen"
                    />
                </div>
            </div>

            {/* ── Live Preview ── */}
            <div className="mb-4">
                <h3 className="text-sm font-semibold text-zinc-300 mb-3">Preview</h3>
                <div className="bg-zinc-800/30 border border-zinc-700/50 rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                            style={{ backgroundColor: accentColor }}>
                            Ab
                        </div>
                        <div>
                            <p className="text-sm font-semibold" style={{ color: 'var(--textPrimary)' }}>
                                Sample Card Title
                            </p>
                            <p className="text-xs" style={{ color: 'var(--textSecondary)' }}>
                                This shows your current appearance settings
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button className="px-4 py-2 text-white text-xs font-medium rounded-lg"
                            style={{ backgroundColor: accentColor }}>
                            Primary Button
                        </button>
                        <button className="px-4 py-2 text-xs font-medium rounded-lg"
                            style={{
                                backgroundColor: 'transparent',
                                border: `1.5px solid ${accentColor}`,
                                color: accentColor,
                            }}>
                            Secondary
                        </button>
                        <button className="px-4 py-2 text-xs font-medium rounded-lg"
                            style={{
                                backgroundColor: 'var(--bgTertiary)',
                                color: 'var(--textSecondary)',
                            }}>
                            Neutral
                        </button>
                    </div>
                    <div className="flex items-center gap-4 mt-4 text-xs">
                        <span style={{ color: accentColor }}>● Active</span>
                        <span style={{ color: 'var(--success)' }}>● Success</span>
                        <span style={{ color: 'var(--warning)' }}>● Warning</span>
                        <span style={{ color: 'var(--error)' }}>● Error</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AppearanceSettings;
