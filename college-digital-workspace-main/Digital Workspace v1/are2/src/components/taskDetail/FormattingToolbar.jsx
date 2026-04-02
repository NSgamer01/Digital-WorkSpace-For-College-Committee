import React, { useEffect, useRef, useState } from 'react';

const actions = [
    { key: 'bold', icon: 'B', label: 'Bold', shortcut: 'Ctrl+B', style: { fontWeight: 800 } },
    { key: 'italic', icon: 'I', label: 'Italic', shortcut: 'Ctrl+I', style: { fontStyle: 'italic' } },
    { key: 'underline', icon: 'U', label: 'Underline', shortcut: 'Ctrl+U', style: { textDecoration: 'underline' } },
    { key: 'strikeThrough', icon: 'S', label: 'Strike', shortcut: '', style: { textDecoration: 'line-through' } },
    { key: 'code', icon: '⟨/⟩', label: 'Code', shortcut: 'Ctrl+E', style: { fontFamily: 'monospace', fontSize: 12 } },
    { key: 'link', icon: '🔗', label: 'Link', shortcut: 'Ctrl+K', style: {} },
];

const sep = { key: 'sep', separator: true };

const allActions = [
    actions[0], actions[1], actions[2], actions[3],
    sep,
    actions[4], actions[5],
];

const FormattingToolbar = ({ position, visible, onFormat }) => {
    const ref = useRef(null);
    const [linkMode, setLinkMode] = useState(false);
    const [linkUrl, setLinkUrl] = useState('');
    const linkInputRef = useRef(null);

    useEffect(() => {
        if (linkMode && linkInputRef.current) linkInputRef.current.focus();
    }, [linkMode]);

    useEffect(() => {
        if (!visible) { setLinkMode(false); setLinkUrl(''); }
    }, [visible]);

    if (!visible || !position) return null;

    const handleAction = (action) => {
        if (action.key === 'link') {
            setLinkMode(true);
            return;
        }
        onFormat(action.key);
    };

    const handleLinkSubmit = (e) => {
        e.preventDefault();
        if (linkUrl.trim()) {
            onFormat('createLink', linkUrl.trim());
        }
        setLinkMode(false);
        setLinkUrl('');
    };

    const style = {
        position: 'fixed',
        left: Math.max(8, Math.min(position.x - 140, window.innerWidth - 310)),
        top: Math.max(8, position.y - 44),
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        padding: '4px 6px',
        background: 'rgba(24,24,28,0.97)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 10,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        zIndex: 250,
        animation: 'dropdownFadeIn 0.1s ease-out',
    };

    if (linkMode) {
        return (
            <div ref={ref} style={style}>
                <form onSubmit={handleLinkSubmit} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input
                        ref={linkInputRef}
                        value={linkUrl}
                        onChange={(e) => setLinkUrl(e.target.value)}
                        placeholder="Paste URL..."
                        style={{
                            width: 200,
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.12)',
                            borderRadius: 6,
                            padding: '4px 8px',
                            color: 'white',
                            fontSize: 12,
                            outline: 'none',
                        }}
                        onKeyDown={(e) => { if (e.key === 'Escape') { setLinkMode(false); setLinkUrl(''); } }}
                    />
                    <button
                        type="submit"
                        style={{
                            padding: '4px 10px',
                            borderRadius: 6,
                            border: 'none',
                            background: '#6366f1',
                            color: 'white',
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer',
                        }}
                    >
                        ↵
                    </button>
                </form>
            </div>
        );
    }

    return (
        <div ref={ref} style={style}>
            {allActions.map((action, i) => {
                if (action.separator) {
                    return (
                        <div
                            key={`sep-${i}`}
                            style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)', margin: '0 2px' }}
                        />
                    );
                }
                return (
                    <button
                        key={action.key}
                        onClick={() => handleAction(action)}
                        title={action.label + (action.shortcut ? ` (${action.shortcut})` : '')}
                        style={{
                            width: 30,
                            height: 28,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: 6,
                            border: 'none',
                            background: 'transparent',
                            color: 'rgba(255,255,255,0.7)',
                            fontSize: 13,
                            cursor: 'pointer',
                            transition: 'all 0.1s',
                            ...action.style,
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                            e.currentTarget.style.color = 'white';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
                        }}
                    >
                        {action.icon}
                    </button>
                );
            })}
        </div>
    );
};

export default FormattingToolbar;
