// ============================================
// src/components/ThemePreview.jsx — Mini UI Mockup
// ============================================
// Renders a small mockup of the app layout using a given theme's colors.
// Used inside ThemeSelector to show what each theme looks like.
// ============================================

import React from 'react';
import themes from '../styles/themes';

const ThemePreview = ({ themeName }) => {
    const theme = themes[themeName];
    if (!theme) return null;

    const c = theme.colors;

    return (
        <div style={{
            width: '100%',
            height: 80,
            borderRadius: 8,
            overflow: 'hidden',
            display: 'flex',
            background: c.bgPrimary,
            border: `1px solid ${c.border}`,
        }}>
            {/* Mini sidebar */}
            <div style={{
                width: 30,
                background: c.sidebarBg,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                padding: '8px 4px',
                borderRight: `1px solid ${c.border}`,
            }}>
                <div style={{
                    width: 14,
                    height: 14,
                    borderRadius: 4,
                    background: c.accent,
                    margin: '0 auto',
                }} />
                {[1, 2, 3].map(i => (
                    <div key={i} style={{
                        width: 18,
                        height: 3,
                        borderRadius: 2,
                        background: i === 1 ? c.sidebarActive : c.bgTertiary,
                        margin: '0 auto',
                        opacity: i === 1 ? 1 : 0.5,
                    }} />
                ))}
            </div>

            {/* Content area */}
            <div style={{ flex: 1, padding: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {/* Top bar */}
                <div style={{
                    height: 8,
                    borderRadius: 3,
                    background: c.bgSecondary,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 4px',
                    gap: 3,
                }}>
                    <div style={{ width: 16, height: 3, borderRadius: 2, background: c.textTertiary, opacity: 0.5 }} />
                    <div style={{ marginLeft: 'auto', width: 8, height: 3, borderRadius: 2, background: c.accent }} />
                </div>

                {/* Cards */}
                <div style={{ display: 'flex', gap: 3, flex: 1 }}>
                    {[1, 2].map(i => (
                        <div key={i} style={{
                            flex: 1,
                            borderRadius: 4,
                            background: c.cardBg,
                            border: `1px solid ${c.cardBorder}`,
                            padding: 4,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 3,
                        }}>
                            <div style={{ width: '60%', height: 3, borderRadius: 2, background: c.textPrimary, opacity: 0.6 }} />
                            <div style={{ width: '80%', height: 2, borderRadius: 2, background: c.textSecondary, opacity: 0.3 }} />
                            <div style={{
                                width: '40%', height: 6, borderRadius: 3,
                                background: i === 1 ? c.accent : c.success,
                                marginTop: 'auto',
                            }} />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ThemePreview;
