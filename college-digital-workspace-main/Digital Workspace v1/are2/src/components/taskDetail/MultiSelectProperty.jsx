import React, { useState } from 'react';
import PropertyPill from './PropertyPill';
import PropertyDropdown from './PropertyDropdown';

const colorMap = {
    Linkedin: { bg: 'rgba(59,130,246,0.2)', text: '#3b82f6' },
    Twitter: { bg: 'rgba(6,182,212,0.2)', text: '#06b6d4' },
    Facebook: { bg: 'rgba(59,130,246,0.2)', text: '#3b82f6' },
    Instagram: { bg: 'rgba(236,72,153,0.2)', text: '#ec4899' },
    TikTok: { bg: 'rgba(168,85,247,0.2)', text: '#a855f7' },
};

const defaultColor = { bg: 'rgba(139,92,246,0.2)', text: '#8b5cf6' };

const MultiSelectProperty = ({ value = [], options = [], label = 'Platform', icon = '💬', onChange }) => {
    const [open, setOpen] = useState(false);

    const toggle = (opt) => {
        const next = value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt];
        onChange(next);
    };

    const getColor = (v) => colorMap[v] || defaultColor;
    const visibleTags = value.slice(0, 2);
    const extra = value.length - 2;

    return (
        <div style={{ position: 'relative', display: 'inline-block' }}>
            <PropertyPill icon={icon} label={label} onClick={() => setOpen(!open)}>
                {value.length === 0 ? (
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>Empty</span>
                ) : (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {visibleTags.map((v) => {
                            const c = getColor(v);
                            return (
                                <span
                                    key={v}
                                    style={{
                                        fontSize: 11,
                                        fontWeight: 600,
                                        color: c.text,
                                        background: c.bg,
                                        padding: '2px 7px',
                                        borderRadius: 4,
                                    }}
                                >
                                    {v}
                                </span>
                            );
                        })}
                        {extra > 0 && (
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>+{extra}</span>
                        )}
                    </span>
                )}
            </PropertyPill>
            <PropertyDropdown isOpen={open} onClose={() => setOpen(false)} searchable>
                {(search) => {
                    const filtered = options.filter((o) => o.toLowerCase().includes(search.toLowerCase()));
                    return filtered.map((opt) => {
                        const selected = value.includes(opt);
                        const c = getColor(opt);
                        return (
                            <button
                                key={opt}
                                onClick={() => toggle(opt)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    width: '100%',
                                    padding: '7px 10px',
                                    background: selected ? 'rgba(99,102,241,0.1)' : 'transparent',
                                    border: 'none',
                                    borderRadius: 6,
                                    color: 'rgba(255,255,255,0.9)',
                                    fontSize: 13,
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    transition: 'background 0.15s',
                                }}
                                onMouseEnter={(e) => { if (!selected) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                                onMouseLeave={(e) => { if (!selected) e.currentTarget.style.background = 'transparent'; }}
                            >
                                <span style={{
                                    width: 16, height: 16, borderRadius: 4,
                                    border: selected ? 'none' : '1.5px solid rgba(255,255,255,0.3)',
                                    background: selected ? '#6366f1' : 'transparent',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 10, color: 'white', flexShrink: 0,
                                }}>
                                    {selected && '✓'}
                                </span>
                                <span style={{
                                    padding: '1px 6px', borderRadius: 4,
                                    background: c.bg, color: c.text, fontSize: 12, fontWeight: 500,
                                }}>
                                    {opt}
                                </span>
                            </button>
                        );
                    });
                }}
            </PropertyDropdown>
        </div>
    );
};

export default MultiSelectProperty;
