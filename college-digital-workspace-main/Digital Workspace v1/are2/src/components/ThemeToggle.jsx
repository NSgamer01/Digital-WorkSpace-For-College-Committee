// ============================================
// src/components/ThemeToggle.jsx
// ============================================
// Animated theme toggle with diagonal-slide transition.
// Integrates with ThemeContext to cycle through all themes.
// ============================================

import React, { useState, useCallback, useMemo } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import './ThemeToggle.css';

// Theme cycle order and metadata
const THEME_CYCLE = ['dark', 'light', 'purple', 'ocean', 'auto'];
const THEME_META = {
    dark: { icon: '🌙', label: 'Dark', color: '#1a1a1a' },
    light: { icon: '☀️', label: 'Light', color: '#f8f9fa' },
    purple: { icon: '🔮', label: 'Purple', color: '#1a1025' },
    ocean: { icon: '🌊', label: 'Ocean', color: '#0a192f' },
    auto: { icon: '🔄', label: 'Auto', color: '#2a2a2a' },
};

const ThemeToggle = () => {
    const { currentTheme, setTheme } = useTheme();
    const [isTransitioning, setIsTransitioning] = useState(false);

    const currentMeta = useMemo(() => THEME_META[currentTheme] || THEME_META.dark, [currentTheme]);

    const getNextTheme = useCallback(() => {
        const idx = THEME_CYCLE.indexOf(currentTheme);
        return THEME_CYCLE[(idx + 1) % THEME_CYCLE.length];
    }, [currentTheme]);

    const toggleTheme = useCallback((e) => {
        if (isTransitioning) return;

        const nextTheme = getNextTheme();
        const nextMeta = THEME_META[nextTheme] || THEME_META.dark;
        setIsTransitioning(true);

        // Get click position from button center
        const btn = e.currentTarget;
        const rect = btn.getBoundingClientRect();
        const clickX = ((rect.left + rect.width / 2) / window.innerWidth) * 100;
        const clickY = ((rect.top + rect.height / 2) / window.innerHeight) * 100;

        // Create overlay for the animation
        const overlay = document.createElement('div');
        overlay.className = 'theme-transition-overlay diagonal';
        overlay.style.setProperty('--clickX', `${clickX}%`);
        overlay.style.setProperty('--clickY', `${clickY}%`);
        overlay.style.setProperty('--transitionColor', nextMeta.color);
        document.body.appendChild(overlay);

        // Set transitioning attribute for page content animations
        document.documentElement.setAttribute('data-theme-transitioning', 'true');

        // Trigger animation
        requestAnimationFrame(() => {
            overlay.classList.add('active');
        });

        // Switch theme halfway through animation (300ms in a 600ms animation)
        setTimeout(() => {
            setTheme(nextTheme, { skipAnimation: true });
        }, 300);

        // Clean up
        setTimeout(() => {
            if (overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
            document.documentElement.removeAttribute('data-theme-transitioning');
            setIsTransitioning(false);
        }, 600);
    }, [currentTheme, isTransitioning, getNextTheme, setTheme]);

    const nextTheme = getNextTheme();
    const nextMeta = THEME_META[nextTheme] || THEME_META.dark;

    return (
        <button
            className={`theme-toggle-btn ${isTransitioning ? 'transitioning' : ''}`}
            onClick={toggleTheme}
            disabled={isTransitioning}
            title={`Switch to ${nextMeta.label} theme`}
            aria-label={`Switch to ${nextMeta.label} theme`}
        >
            <span className="theme-toggle-icon">
                {currentMeta.icon}
            </span>
        </button>
    );
};

export default ThemeToggle;
