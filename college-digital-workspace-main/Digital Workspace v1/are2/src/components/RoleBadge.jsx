// ============================================
// src/components/RoleBadge.jsx — Reusable Role Badge
// ============================================
// Colored pill badge showing a committee role.
// Uses ROLE_LABELS and ROLE_COLORS from roles.js.
// ============================================

import React from 'react';
import { ROLE_LABELS, ROLE_COLORS } from '../constants/roles';

const sizeStyles = {
    small: {
        padding: '2px 8px',
        fontSize: '10px',
        borderRadius: '8px',
    },
    medium: {
        padding: '4px 12px',
        fontSize: '12px',
        borderRadius: '10px',
    },
    large: {
        padding: '6px 16px',
        fontSize: '14px',
        borderRadius: '12px',
    },
};

export default function RoleBadge({ role, size = 'medium' }) {
    const normalizedRole = (role || '').toLowerCase();
    const label = ROLE_LABELS[normalizedRole] || role || 'Member';
    const color = ROLE_COLORS[normalizedRole] || '#64748b';
    const sizing = sizeStyles[size] || sizeStyles.medium;

    return (
        <span
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.3px',
                color: color,
                background: `${color}18`,
                border: `1px solid ${color}30`,
                whiteSpace: 'nowrap',
                lineHeight: 1.4,
                ...sizing,
            }}
        >
            {label}
        </span>
    );
}
