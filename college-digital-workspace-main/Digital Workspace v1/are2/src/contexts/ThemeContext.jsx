// ============================================
// src/contexts/ThemeContext.jsx — Theme Provider
// ============================================
// Manages: theme, accent color, compact mode, font size.
// Applies ALL settings as CSS custom properties on document.documentElement
// in real-time. Reads from localStorage for instant apply.
// Debounces backend saves.
// ============================================

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import themes from '../styles/themes';
import api from '../utils/api';

const ThemeContext = createContext(null);

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) throw new Error('useTheme must be used within ThemeProvider');
    return context;
};

// Helper: generate accent color variants
function generateAccentVariants(hex) {
    // Convert hex to RGB
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);

    return {
        accent: hex,
        accentRgb: `${r}, ${g}, ${b}`,
        accentHover: adjustBrightness(hex, 20),
        accentLight: `rgba(${r}, ${g}, ${b}, 0.15)`,
        accentDark: adjustBrightness(hex, -20),
    };
}

function adjustBrightness(hex, amount) {
    let r = parseInt(hex.slice(1, 3), 16) + amount;
    let g = parseInt(hex.slice(3, 5), 16) + amount;
    let b = parseInt(hex.slice(5, 7), 16) + amount;
    r = Math.max(0, Math.min(255, r));
    g = Math.max(0, Math.min(255, g));
    b = Math.max(0, Math.min(255, b));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Font size mapping
const fontSizeMap = {
    small: '14px',
    medium: '16px',
    large: '18px',
};

export const ThemeProvider = ({ children }) => {
    // ── State ──
    const [currentTheme, setCurrentThemeState] = useState(() => {
        return localStorage.getItem('theme') || 'dark';
    });
    const [accentColor, setAccentColorState] = useState(() => {
        return localStorage.getItem('accentColor') || '#6366f1';
    });
    const [compactMode, setCompactModeState] = useState(() => {
        return localStorage.getItem('compactMode') === 'true';
    });
    const [fontSize, setFontSizeState] = useState(() => {
        return localStorage.getItem('fontSize') || 'medium';
    });
    const [systemTheme, setSystemTheme] = useState('dark');
    const saveTimerRef = useRef(null);

    // ── Restore background gradient from localStorage on app start ──
    useEffect(() => {
        const savedGradientCSS = localStorage.getItem('bgGradientCSS');
        const savedGradientId = localStorage.getItem('bgGradient');
        if (savedGradientCSS && savedGradientId && savedGradientId !== 'none') {
            let overlay = document.getElementById('bg-gradient-overlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'bg-gradient-overlay';
                overlay.style.cssText = 'position:fixed;inset:0;z-index:0;pointer-events:none;transition:background 0.5s ease;';
                document.body.prepend(overlay);
            }
            overlay.style.background = savedGradientCSS;
        }
    }, []);

    // ── Detect system preference ──
    useEffect(() => {
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        setSystemTheme(mq.matches ? 'dark' : 'light');
        const handler = (e) => setSystemTheme(e.matches ? 'dark' : 'light');
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);

    // Resolve effective theme
    const effectiveTheme = currentTheme === 'auto' ? systemTheme : currentTheme;

    // ── Apply theme colors whenever effective theme changes ──
    useEffect(() => {
        const themeData = themes[effectiveTheme];
        if (!themeData) return;

        const root = document.documentElement;
        const { colors } = themeData;

        // Apply all color tokens as CSS custom properties
        Object.entries(colors).forEach(([key, value]) => {
            root.style.setProperty(`--${key}`, value);
        });

        // Legacy variables
        root.style.setProperty('--bg-primary', colors.bgPrimary);
        root.style.setProperty('--bg-secondary', colors.bgSecondary);
        root.style.setProperty('--bg-tertiary', colors.bgTertiary);
        root.style.setProperty('--text-primary', colors.textPrimary);
        root.style.setProperty('--text-secondary', colors.textSecondary);
        root.style.setProperty('--text-tertiary', colors.textTertiary);
        root.style.setProperty('--border', colors.border);

        // Data attribute
        root.setAttribute('data-theme', effectiveTheme);

        // Body direct styles
        document.body.style.backgroundColor = colors.bgPrimary;
        document.body.style.color = colors.textPrimary;

        // ── Override hardcoded Tailwind classes with CSS variable values ──
        // This is necessary because the app uses classes like bg-zinc-900 directly,
        // which don't respond to CSS custom property changes.
        let themeOverrides = document.getElementById('theme-tailwind-overrides');
        if (!themeOverrides) {
            themeOverrides = document.createElement('style');
            themeOverrides.id = 'theme-tailwind-overrides';
            document.head.appendChild(themeOverrides);
        }

        themeOverrides.textContent = `
            /* ── Background overrides ── */
            .bg-zinc-950 { background-color: ${colors.bgPrimary} !important; }
            .bg-zinc-900 { background-color: ${colors.bgPrimary} !important; }
            .bg-zinc-900\\/50 { background-color: ${colors.bgPrimary}80 !important; }
            .bg-zinc-800 { background-color: ${colors.bgSecondary} !important; }
            .bg-zinc-800\\/60, .bg-zinc-800\\/40, .bg-zinc-800\\/50, .bg-zinc-800\\/30 {
                background-color: ${colors.bgSecondary}99 !important;
            }
            .bg-zinc-700 { background-color: ${colors.bgTertiary} !important; }
            .hover\\:bg-zinc-800:hover { background-color: ${colors.bgSecondary} !important; }
            .hover\\:bg-zinc-700:hover { background-color: ${colors.bgTertiary} !important; }
            .hover\\:bg-zinc-600:hover { background-color: ${colors.bgHover} !important; }

            /* ── Text overrides ── */
            .text-white { color: ${colors.textPrimary} !important; }
            .text-zinc-300, .text-zinc-200 { color: ${colors.textSecondary} !important; }
            .text-zinc-400 { color: ${colors.textTertiary} !important; }
            .text-zinc-500, .text-zinc-600 { color: ${colors.textTertiary} !important; }
            .text-gray-400 { color: ${colors.textTertiary} !important; }
            .text-gray-300 { color: ${colors.textSecondary} !important; }
            .hover\\:text-white:hover { color: ${colors.textPrimary} !important; }
            .group-hover\\:text-white:hover { color: ${colors.textPrimary} !important; }
            .placeholder-zinc-600::placeholder, .placeholder-zinc-500::placeholder {
                color: ${colors.textTertiary} !important;
            }

            /* ── Border overrides ── */
            .border-zinc-800, .border-zinc-800\\/60 { border-color: ${colors.border} !important; }
            .border-zinc-700, .border-zinc-700\\/50 { border-color: ${colors.border} !important; }
            .border-zinc-600 { border-color: ${colors.border} !important; }
            .divide-zinc-800 > * + * { border-color: ${colors.border} !important; }
            .divide-zinc-700 > * + * { border-color: ${colors.border} !important; }

            /* ── Sidebar ── */
            .bg-zinc-900.fixed { background-color: ${colors.sidebarBg} !important; }

            /* ── Input overrides ── */
            input, textarea, select {
                background-color: ${colors.inputBg} !important;
                border-color: ${colors.inputBorder} !important;
                color: ${colors.textPrimary} !important;
            }
            input::placeholder, textarea::placeholder {
                color: ${colors.textTertiary} !important;
            }

            /* ── Settings card area ── */
            .backdrop-blur-sm {
                background-color: ${colors.cardBg} !important;
                border-color: ${colors.cardBorder} !important;
            }

            /* ── Topbar ── */
            .topbar-wrapper {
                background-color: ${colors.bgSecondary} !important;
                border-color: ${colors.border} !important;
                color: ${colors.textPrimary} !important;
            }
            .topbar-email { color: ${colors.textSecondary} !important; }
            .topbar-btn {
                color: ${colors.textSecondary} !important;
                background: ${colors.bgTertiary} !important;
            }
            .topbar-btn:hover {
                color: ${colors.textPrimary} !important;
                background: ${colors.bgHover} !important;
            }
        `;
    }, [effectiveTheme]);

    // ── Apply accent color ──
    useEffect(() => {
        const root = document.documentElement;
        const variants = generateAccentVariants(accentColor);

        root.style.setProperty('--accent', variants.accent);
        root.style.setProperty('--accentRgb', variants.accentRgb);
        root.style.setProperty('--accentHover', variants.accentHover);
        root.style.setProperty('--accentLight', variants.accentLight);
        root.style.setProperty('--accentDark', variants.accentDark);

        // Also inject a dynamic style for Tailwind classes that use accent color
        let style = document.getElementById('theme-accent-overrides');
        if (!style) {
            style = document.createElement('style');
            style.id = 'theme-accent-overrides';
            document.head.appendChild(style);
        }
        style.textContent = `
            .bg-indigo-600, .bg-blue-600 { background-color: ${variants.accent} !important; }
            .bg-indigo-600:hover, .hover\\:bg-indigo-700:hover,
            .bg-blue-600:hover, .hover\\:bg-blue-700:hover { background-color: ${variants.accentHover} !important; }
            .text-indigo-400, .text-indigo-500 { color: ${variants.accent} !important; }
            .text-blue-300 { color: ${variants.accentHover} !important; }
            .border-indigo-500 { border-color: ${variants.accent} !important; }
            .ring-indigo-500, .ring-blue-500 { --tw-ring-color: ${variants.accent} !important; }
            .focus\\:ring-blue-500:focus { --tw-ring-color: ${variants.accent} !important; }
            .from-blue-600 { --tw-gradient-from: ${variants.accent} !important; }
            .to-purple-600 { --tw-gradient-to: ${variants.accentHover} !important; }
            .shadow-blue-500\\/20, .shadow-indigo-500\\/20 {
                --tw-shadow-color: ${variants.accentLight} !important;
            }
            .bg-indigo-500\\/15, .bg-blue-500\\/10 {
                background-color: ${variants.accentLight} !important;
            }
            .accent-indigo-500 { accent-color: ${variants.accent} !important; }
        `;
    }, [accentColor]);

    // ── Apply compact mode ──
    useEffect(() => {
        const root = document.documentElement;
        let style = document.getElementById('theme-compact-mode');
        if (!style) {
            style = document.createElement('style');
            style.id = 'theme-compact-mode';
            document.head.appendChild(style);
        }

        if (compactMode) {
            root.classList.add('compact-mode');
            style.textContent = `
                .compact-mode .px-4 { padding-left: 0.75rem !important; padding-right: 0.75rem !important; }
                .compact-mode .py-3 { padding-top: 0.5rem !important; padding-bottom: 0.5rem !important; }
                .compact-mode .py-4 { padding-top: 0.65rem !important; padding-bottom: 0.65rem !important; }
                .compact-mode .py-6 { padding-top: 1rem !important; padding-bottom: 1rem !important; }
                .compact-mode .py-8 { padding-top: 1.25rem !important; padding-bottom: 1.25rem !important; }
                .compact-mode .px-6 { padding-left: 1rem !important; padding-right: 1rem !important; }
                .compact-mode .gap-3 { gap: 0.5rem !important; }
                .compact-mode .gap-4 { gap: 0.65rem !important; }
                .compact-mode .gap-6 { gap: 0.75rem !important; }
                .compact-mode .gap-8 { gap: 1rem !important; }
                .compact-mode .space-y-2 > * + * { margin-top: 0.35rem !important; }
                .compact-mode .space-y-4 > * + * { margin-top: 0.65rem !important; }
                .compact-mode .space-y-6 > * + * { margin-top: 0.75rem !important; }
                .compact-mode .mb-4 { margin-bottom: 0.65rem !important; }
                .compact-mode .mb-6 { margin-bottom: 0.75rem !important; }
                .compact-mode .mb-8 { margin-bottom: 1rem !important; }
                .compact-mode .text-3xl { font-size: 1.5rem !important; }
                .compact-mode .text-xl { font-size: 1.1rem !important; }
                .compact-mode .rounded-2xl { border-radius: 0.75rem !important; }
                .compact-mode .rounded-xl { border-radius: 0.6rem !important; }
                .compact-mode .p-8 { padding: 1.25rem !important; }
                .compact-mode .p-6 { padding: 1rem !important; }
                .compact-mode .p-5 { padding: 0.85rem !important; }
            `;
        } else {
            root.classList.remove('compact-mode');
            style.textContent = '';
        }
    }, [compactMode]);

    // ── Apply font size ──
    useEffect(() => {
        const root = document.documentElement;
        const size = fontSizeMap[fontSize] || fontSizeMap.medium;
        root.style.fontSize = size;
    }, [fontSize]);

    // ── Debounced backend save helper ──
    const saveToBackend = useCallback((data) => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
            api.patch('/api/settings/appearance', data).catch((err) => {
                console.warn('Failed to save appearance to backend:', err.message);
            });
        }, 500);
    }, []);

    // ── Setters ──
    const setTheme = useCallback((themeName, { skipAnimation = false } = {}) => {
        // ── Animated theme transition ──
        // 1. Create overlay with the NEW theme's background color
        // 2. Animate it across the screen using clip-path
        // 3. Apply the actual theme while overlay covers the screen
        // 4. Remove overlay with fade-out

        const applyTheme = () => {
            setCurrentThemeState(themeName);
            localStorage.setItem('theme', themeName);
            saveToBackend({ theme: themeName });
        };

        // Skip animation if requested, same theme, or hidden document
        if (skipAnimation || themeName === currentTheme || document.hidden) {
            applyTheme();
            return;
        }

        // Prevent double-transitions
        if (document.body.classList.contains('theme-transitioning')) {
            applyTheme();
            return;
        }

        const newThemeData = themes[themeName === 'auto' ? systemTheme : themeName];
        const overlayColor = newThemeData?.colors?.bgPrimary || '#09090b';

        // Create overlay
        const overlay = document.createElement('div');
        overlay.id = 'theme-transition-overlay';
        overlay.style.cssText = `
            position: fixed; inset: 0; z-index: 99999;
            background: ${overlayColor};
            clip-path: polygon(0 0, 0 0, 0 0);
            pointer-events: none;
            transition: clip-path 0.4s cubic-bezier(0.65, 0, 0.35, 1);
        `;
        document.body.appendChild(overlay);
        document.body.classList.add('theme-transitioning');

        // Force reflow, then expand overlay diagonally
        overlay.getBoundingClientRect();
        overlay.style.clipPath = 'polygon(0 0, 200% 0, 0 200%)';

        // After overlay covers screen, apply theme and fade out
        setTimeout(() => {
            applyTheme();

            // Start the fade-out after a brief moment for the theme to apply
            setTimeout(() => {
                overlay.style.transition = 'opacity 0.35s ease-out';
                overlay.style.opacity = '0';

                setTimeout(() => {
                    overlay.remove();
                    document.body.classList.remove('theme-transitioning');
                }, 350);
            }, 80);
        }, 400);
    }, [currentTheme, systemTheme, saveToBackend]);

    const setAccentColor = useCallback((color) => {
        if (!/^#[0-9a-fA-F]{6}$/.test(color)) return;
        setAccentColorState(color);
        localStorage.setItem('accentColor', color);
        saveToBackend({ accentColor: color });
    }, [saveToBackend]);

    const setCompactMode = useCallback((enabled) => {
        setCompactModeState(enabled);
        localStorage.setItem('compactMode', String(enabled));
        saveToBackend({ compactMode: enabled });
    }, [saveToBackend]);

    const setFontSize = useCallback((size) => {
        setFontSizeState(size);
        localStorage.setItem('fontSize', size);
        saveToBackend({ fontSize: size });
    }, [saveToBackend]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        };
    }, []);

    const value = {
        // Theme
        currentTheme,
        setTheme,
        themes,
        effectiveTheme,
        systemTheme,
        // Accent
        accentColor,
        setAccentColor,
        // Compact
        compactMode,
        setCompactMode,
        // Font size
        fontSize,
        setFontSize,
    };

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
};

export default ThemeContext;
