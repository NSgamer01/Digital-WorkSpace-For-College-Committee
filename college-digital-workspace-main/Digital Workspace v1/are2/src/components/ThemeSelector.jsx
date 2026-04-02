// ============================================
// src/components/ThemeSelector.jsx — Visual Theme Picker
// ============================================
// Grid of clickable theme cards with preview mockups.
// Used in AppearanceSettings and can be used standalone.
// ============================================

import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import ThemePreview from './ThemePreview';
import { themeOptions } from '../styles/themes';
import themes from '../styles/themes';

const ThemeSelector = () => {
    const { currentTheme, setTheme, effectiveTheme } = useTheme();

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
            {themeOptions.map(option => {
                const isActive = currentTheme === option.value;

                return (
                    <button
                        key={option.value}
                        onClick={() => setTheme(option.value)}
                        style={{
                            padding: 12,
                            borderRadius: 12,
                            border: isActive
                                ? '2px solid var(--accent)'
                                : '2px solid var(--border)',
                            background: isActive
                                ? 'var(--accentLight)'
                                : 'var(--bgSecondary)',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'all 0.2s ease',
                            position: 'relative',
                            outline: 'none',
                        }}
                    >
                        {/* Active check */}
                        {isActive && (
                            <div style={{
                                position: 'absolute',
                                top: 8,
                                right: 8,
                                width: 20,
                                height: 20,
                                borderRadius: '50%',
                                background: 'var(--accent)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 12,
                                color: '#fff',
                                zIndex: 2,
                            }}>
                                ✓
                            </div>
                        )}

                        {/* Theme preview */}
                        {option.value !== 'auto' ? (
                            <ThemePreview themeName={option.value} />
                        ) : (
                            <div style={{
                                width: '100%',
                                height: 80,
                                borderRadius: 8,
                                overflow: 'hidden',
                                display: 'flex',
                                border: '1px solid var(--border)',
                            }}>
                                {/* Half light / half dark */}
                                <div style={{ flex: 1, background: '#ffffff' }}>
                                    <div style={{
                                        height: '100%', padding: 8,
                                        display: 'flex', flexDirection: 'column', gap: 4,
                                    }}>
                                        <div style={{
                                            width: '60%', height: 4, borderRadius: 2,
                                            background: '#111827', opacity: 0.6,
                                        }} />
                                        <div style={{
                                            width: '80%', height: 3, borderRadius: 2,
                                            background: '#6b7280', opacity: 0.4,
                                        }} />
                                        <div style={{
                                            width: '40%', height: 8, borderRadius: 4,
                                            background: '#6366f1', marginTop: 'auto',
                                        }} />
                                    </div>
                                </div>
                                <div style={{ flex: 1, background: '#09090b' }}>
                                    <div style={{
                                        height: '100%', padding: 8,
                                        display: 'flex', flexDirection: 'column', gap: 4,
                                    }}>
                                        <div style={{
                                            width: '60%', height: 4, borderRadius: 2,
                                            background: '#ffffff', opacity: 0.6,
                                        }} />
                                        <div style={{
                                            width: '80%', height: 3, borderRadius: 2,
                                            background: '#d1d5db', opacity: 0.4,
                                        }} />
                                        <div style={{
                                            width: '40%', height: 8, borderRadius: 4,
                                            background: '#6366f1', marginTop: 'auto',
                                        }} />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Label */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            marginTop: 10,
                        }}>
                            <span style={{ fontSize: 16 }}>{option.icon}</span>
                            <span style={{
                                fontSize: 13,
                                fontWeight: 600,
                                color: isActive ? 'var(--accent)' : 'var(--textPrimary)',
                            }}>
                                {option.label}
                            </span>
                        </div>

                        {/* Color swatches */}
                        {option.value !== 'auto' && themes[option.value] && (
                            <div style={{
                                display: 'flex',
                                gap: 4,
                                marginTop: 6,
                            }}>
                                {[
                                    themes[option.value].colors.bgPrimary,
                                    themes[option.value].colors.accent,
                                    themes[option.value].colors.bgSecondary,
                                ].map((color, i) => (
                                    <div key={i} style={{
                                        width: 16,
                                        height: 16,
                                        borderRadius: 4,
                                        background: color,
                                        border: '1px solid var(--border)',
                                    }} />
                                ))}
                            </div>
                        )}
                    </button>
                );
            })}
        </div>
    );
};

export default ThemeSelector;
