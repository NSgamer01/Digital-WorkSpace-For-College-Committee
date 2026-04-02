import React, { useEffect, useRef, useState } from 'react';

const PropertyDropdown = ({ isOpen, onClose, children, searchable = false, className = '' }) => {
    const ref = useRef(null);
    const [search, setSearch] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        const handleClick = (e) => {
            if (ref.current && !ref.current.contains(e.target)) onClose();
        };
        const handleKey = (e) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('mousedown', handleClick);
        document.addEventListener('keydown', handleKey);
        return () => {
            document.removeEventListener('mousedown', handleClick);
            document.removeEventListener('keydown', handleKey);
        };
    }, [isOpen, onClose]);

    useEffect(() => {
        if (!isOpen) setSearch('');
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div
            ref={ref}
            className={`property-dropdown ${className}`}
            style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: 6,
                minWidth: 220,
                background: 'rgba(30,30,35,0.98)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10,
                boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
                zIndex: 100,
                overflow: 'hidden',
                animation: 'dropdownFadeIn 0.15s ease-out',
            }}
        >
            {searchable && (
                <div style={{ padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <input
                        autoFocus
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search..."
                        style={{
                            width: '100%',
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 6,
                            padding: '6px 10px',
                            color: 'white',
                            fontSize: 13,
                            outline: 'none',
                        }}
                    />
                </div>
            )}
            <div style={{ padding: 4, maxHeight: 280, overflowY: 'auto' }}>
                {typeof children === 'function' ? children(search) : children}
            </div>
        </div>
    );
};

export const DropdownItem = ({ icon, label, selected, color, onClick }) => (
    <button
        onClick={onClick}
        style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: '100%',
            padding: '7px 10px',
            background: selected ? 'rgba(99,102,241,0.15)' : 'transparent',
            border: 'none',
            borderRadius: 6,
            color: color || 'rgba(255,255,255,0.9)',
            fontSize: 13,
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => { if (!selected) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
        onMouseLeave={(e) => { if (!selected) e.currentTarget.style.background = 'transparent'; }}
    >
        {icon && <span style={{ fontSize: 14, width: 20, textAlign: 'center' }}>{icon}</span>}
        <span style={{ flex: 1 }}>{label}</span>
        {selected && <span style={{ color: '#6366f1', fontSize: 14 }}>✓</span>}
    </button>
);

export default PropertyDropdown;
