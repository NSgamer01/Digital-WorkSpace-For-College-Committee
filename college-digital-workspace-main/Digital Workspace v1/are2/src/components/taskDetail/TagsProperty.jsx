import React, { useState, useRef, useEffect } from 'react';
import PropertyPill from './PropertyPill';

const tagColors = [
    { bg: 'rgba(59,130,246,0.2)', text: '#3b82f6' },
    { bg: 'rgba(139,92,246,0.2)', text: '#8b5cf6' },
    { bg: 'rgba(34,197,94,0.2)', text: '#22c55e' },
    { bg: 'rgba(236,72,153,0.2)', text: '#ec4899' },
    { bg: 'rgba(234,179,8,0.2)', text: '#eab308' },
    { bg: 'rgba(6,182,212,0.2)', text: '#06b6d4' },
    { bg: 'rgba(249,115,22,0.2)', text: '#f97316' },
];

const getTagColor = (tag) => tagColors[Math.abs([...tag].reduce((a, c) => a + c.charCodeAt(0), 0)) % tagColors.length];

const TagsProperty = ({ value = [], onChange, allTags = [] }) => {
    const [open, setOpen] = useState(false);
    const [input, setInput] = useState('');
    const ref = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        if (!open) return;
        const handle = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        const handleKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', handle);
        document.addEventListener('keydown', handleKey);
        return () => { document.removeEventListener('mousedown', handle); document.removeEventListener('keydown', handleKey); };
    }, [open]);

    useEffect(() => {
        if (open && inputRef.current) inputRef.current.focus();
    }, [open]);

    const handleAdd = (tag) => {
        if (!value.includes(tag)) onChange([...value, tag]);
        setInput('');
    };

    const handleRemove = (tag) => onChange(value.filter((v) => v !== tag));

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && input.trim()) {
            e.preventDefault();
            handleAdd(input.trim());
        }
        if (e.key === 'Backspace' && !input && value.length) {
            handleRemove(value[value.length - 1]);
        }
    };

    const suggestions = [...new Set([...allTags])].filter(
        (t) => !value.includes(t) && t.toLowerCase().includes(input.toLowerCase())
    );

    return (
        <div style={{ position: 'relative', display: 'inline-block' }} ref={ref}>
            <PropertyPill icon="🏷️" label="Tags" onClick={() => setOpen(!open)}>
                {value.length === 0 ? (
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>Empty</span>
                ) : (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                        {value.slice(0, 3).map((t) => {
                            const c = getTagColor(t);
                            return (
                                <span
                                    key={t}
                                    style={{
                                        fontSize: 11, fontWeight: 600, color: c.text, background: c.bg,
                                        padding: '2px 7px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 4,
                                    }}
                                >
                                    {t}
                                </span>
                            );
                        })}
                        {value.length > 3 && (
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>+{value.length - 3}</span>
                        )}
                    </span>
                )}
            </PropertyPill>
            {open && (
                <div
                    style={{
                        position: 'absolute', top: '100%', left: 0, marginTop: 6, minWidth: 260,
                        background: 'rgba(30,30,35,0.98)', border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 10, boxShadow: '0 12px 40px rgba(0,0,0,0.5)', zIndex: 100,
                        animation: 'dropdownFadeIn 0.15s ease-out',
                    }}
                >
                    {/* Selected tags */}
                    <div style={{ padding: '8px 10px', display: 'flex', flexWrap: 'wrap', gap: 4, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                        {value.map((t) => {
                            const c = getTagColor(t);
                            return (
                                <span
                                    key={t}
                                    style={{
                                        fontSize: 11, fontWeight: 600, color: c.text, background: c.bg,
                                        padding: '3px 8px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 4,
                                    }}
                                >
                                    {t}
                                    <button
                                        onClick={() => handleRemove(t)}
                                        style={{
                                            background: 'none', border: 'none', color: c.text, cursor: 'pointer',
                                            padding: 0, fontSize: 12, lineHeight: 1, opacity: 0.7,
                                        }}
                                    >
                                        ×
                                    </button>
                                </span>
                            );
                        })}
                        <input
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Add tag..."
                            style={{
                                flex: 1, minWidth: 80, background: 'transparent', border: 'none',
                                color: 'white', fontSize: 13, outline: 'none', padding: '2px 0',
                            }}
                        />
                    </div>
                    {/* Suggestions */}
                    <div style={{ padding: 4, maxHeight: 200, overflowY: 'auto' }}>
                        {suggestions.map((t) => (
                            <button
                                key={t}
                                onClick={() => handleAdd(t)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                                    padding: '6px 10px', background: 'transparent', border: 'none',
                                    borderRadius: 6, color: 'rgba(255,255,255,0.8)', fontSize: 13,
                                    cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s',
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                                <span style={{ padding: '1px 6px', borderRadius: 4, background: getTagColor(t).bg, color: getTagColor(t).text, fontSize: 12, fontWeight: 500 }}>
                                    {t}
                                </span>
                            </button>
                        ))}
                        {input.trim() && !allTags.includes(input.trim()) && !value.includes(input.trim()) && (
                            <button
                                onClick={() => handleAdd(input.trim())}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 6, width: '100%',
                                    padding: '6px 10px', background: 'transparent', border: 'none',
                                    borderRadius: 6, color: '#6366f1', fontSize: 13, cursor: 'pointer',
                                    textAlign: 'left',
                                }}
                            >
                                + Create "{input.trim()}"
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default TagsProperty;
