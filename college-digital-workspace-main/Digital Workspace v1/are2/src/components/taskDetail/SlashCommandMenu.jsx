import React, { useState, useRef, useEffect } from 'react';

const commands = [
    { type: 'paragraph', icon: '📝', label: 'Text', desc: 'Plain text block', shortcut: '' },
    { type: 'heading1', icon: '𝐇₁', label: 'Heading 1', desc: 'Big section heading', shortcut: '# ' },
    { type: 'heading2', icon: '𝐇₂', label: 'Heading 2', desc: 'Medium heading', shortcut: '## ' },
    { type: 'heading3', icon: '𝐇₃', label: 'Heading 3', desc: 'Small heading', shortcut: '### ' },
    { type: 'bullet', icon: '•', label: 'Bulleted list', desc: 'Unordered list', shortcut: '- ' },
    { type: 'numbered', icon: '1.', label: 'Numbered list', desc: 'Ordered list', shortcut: '1. ' },
    { type: 'checkbox', icon: '☑️', label: 'To-do list', desc: 'Track tasks with checkboxes', shortcut: '[] ' },
    { type: 'quote', icon: '❝', label: 'Quote', desc: 'Capture a quote', shortcut: '> ' },
    { type: 'code', icon: '⟨/⟩', label: 'Code', desc: 'Code snippet', shortcut: '```' },
    { type: 'divider', icon: '—', label: 'Divider', desc: 'Visual separator', shortcut: '---' },
    { type: 'image', icon: '🖼️', label: 'Image', desc: 'Upload or paste image', shortcut: '' },
    { type: 'callout', icon: '💡', label: 'Callout', desc: 'Highlighted info block', shortcut: '' },
];

const SlashCommandMenu = ({ position, onSelect, onClose, filter = '' }) => {
    const [idx, setIdx] = useState(0);
    const ref = useRef(null);
    const listRef = useRef(null);

    const filtered = commands.filter(
        (c) =>
            c.label.toLowerCase().includes(filter.toLowerCase()) ||
            c.type.toLowerCase().includes(filter.toLowerCase()) ||
            c.desc.toLowerCase().includes(filter.toLowerCase())
    );

    useEffect(() => setIdx(0), [filter]);

    /* Keyboard navigation */
    useEffect(() => {
        const handle = (e) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                e.stopPropagation();
                setIdx((i) => Math.min(i + 1, filtered.length - 1));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                e.stopPropagation();
                setIdx((i) => Math.max(i - 1, 0));
            } else if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                if (filtered[idx]) onSelect(filtered[idx].type);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        };
        document.addEventListener('keydown', handle, true);
        return () => document.removeEventListener('keydown', handle, true);
    }, [filtered, idx, onSelect, onClose]);

    /* Click outside */
    useEffect(() => {
        const handle = (e) => {
            if (ref.current && !ref.current.contains(e.target)) onClose();
        };
        document.addEventListener('mousedown', handle);
        return () => document.removeEventListener('mousedown', handle);
    }, [onClose]);

    /* Scroll selected into view */
    useEffect(() => {
        if (listRef.current) {
            const item = listRef.current.children[idx];
            if (item) item.scrollIntoView({ block: 'nearest' });
        }
    }, [idx]);

    if (!filtered.length) return null;

    /* Clamp position so it doesn't overflow viewport */
    const style = {
        position: 'fixed',
        left: Math.min(position.x, window.innerWidth - 280),
        top: Math.min(position.y, window.innerHeight - 360),
        width: 260,
        maxHeight: 340,
        background: 'rgba(24,24,28,0.98)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12,
        boxShadow: '0 16px 48px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04)',
        zIndex: 300,
        overflow: 'hidden',
        animation: 'dropdownFadeIn 0.12s ease-out',
    };

    return (
        <div ref={ref} style={style}>
            {/* Header */}
            <div
                style={{
                    padding: '8px 12px',
                    fontSize: 10,
                    fontWeight: 700,
                    color: 'rgba(255,255,255,0.3)',
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                }}
            >
                Basic blocks
            </div>

            {/* List */}
            <div ref={listRef} style={{ padding: 4, maxHeight: 290, overflowY: 'auto' }} className="custom-scroll">
                {filtered.map((cmd, i) => (
                    <button
                        key={cmd.type}
                        onClick={() => onSelect(cmd.type)}
                        onMouseEnter={() => setIdx(i)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            width: '100%',
                            padding: '7px 8px',
                            background: i === idx ? 'rgba(99,102,241,0.14)' : 'transparent',
                            border: 'none',
                            borderRadius: 8,
                            color: 'rgba(255,255,255,0.9)',
                            fontSize: 13,
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'background 0.08s',
                        }}
                    >
                        <span
                            style={{
                                width: 34,
                                height: 34,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.06)',
                                borderRadius: 8,
                                fontSize: 16,
                                flexShrink: 0,
                            }}
                        >
                            {cmd.icon}
                        </span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 500, lineHeight: 1.3 }}>{cmd.label}</div>
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', lineHeight: 1.3 }}>{cmd.desc}</div>
                        </span>
                        {cmd.shortcut && (
                            <span
                                style={{
                                    fontSize: 10,
                                    color: 'rgba(255,255,255,0.2)',
                                    background: 'rgba(255,255,255,0.04)',
                                    padding: '2px 5px',
                                    borderRadius: 4,
                                    flexShrink: 0,
                                    fontFamily: 'monospace',
                                }}
                            >
                                {cmd.shortcut}
                            </span>
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default SlashCommandMenu;
