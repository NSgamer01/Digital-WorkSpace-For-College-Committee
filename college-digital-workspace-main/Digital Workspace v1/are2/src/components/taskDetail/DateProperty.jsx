import React, { useState, useRef, useEffect } from 'react';
import DatePickerModal from '../DatePickerModal';

const DateProperty = ({ value, label = 'Due date', onChange }) => {
    const [open, setOpen] = useState(false);
    const [showPicker, setShowPicker] = useState(false);
    const ref = useRef(null);

    const formatDate = (d) => {
        if (!d) return 'Empty';
        let date;
        if (typeof d === 'string') {
            // If it's just a date string like "2026-03-03", add time to avoid timezone issues
            // If it already has time info (contains 'T'), use as-is
            date = d.includes('T') ? new Date(d) : new Date(d + 'T00:00:00');
        } else if (d?.toDate) {
            date = d.toDate();
        } else {
            date = new Date(d);
        }
        if (isNaN(date.getTime())) return 'Empty';
        return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    };

    useEffect(() => {
        if (!open) return;
        const handle = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        const handleKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', handle);
        document.addEventListener('keydown', handleKey);
        return () => { document.removeEventListener('mousedown', handle); document.removeEventListener('keydown', handleKey); };
    }, [open]);

    const quickOptions = [
        { label: 'Today', value: new Date().toISOString().split('T')[0] },
        { label: 'Tomorrow', value: new Date(Date.now() + 86400000).toISOString().split('T')[0] },
        { label: 'Next week', value: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0] },
    ];

    return (
        <div className="td-property" ref={ref} onClick={() => setOpen(!open)} style={{ position: 'relative' }}>
            <span className="td-property-label">📅 {label}</span>
            <span className="td-property-value" style={{ color: value ? 'var(--text-secondary)' : 'var(--text-tertiary)' }}>
                {formatDate(value)}
            </span>
            {open && (
                <div className="td-dropdown" style={{ left: 0, right: 'auto', top: '100%', minWidth: 240 }}>
                    {/* Quick options */}
                    {quickOptions.map((opt) => (
                        <button
                            key={opt.label}
                            className="td-dropdown-item"
                            onClick={(e) => { e.stopPropagation(); onChange(opt.value); setOpen(false); }}
                        >
                            {opt.label}
                        </button>
                    ))}
                    <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0', padding: '8px 4px 4px' }}>
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setShowPicker(true); }}
                            className="td-dropdown-item"
                            style={{ justifyContent: 'center', fontSize: 12 }}
                        >
                            📅 Pick from calendar
                        </button>
                    </div>
                    {value && (
                        <button
                            className="td-dropdown-item danger"
                            onClick={(e) => { e.stopPropagation(); onChange(''); setOpen(false); }}
                            style={{ fontSize: 12, marginTop: 2, justifyContent: 'center' }}
                        >
                            Clear date
                        </button>
                    )}
                </div>
            )}
            {showPicker && (
                <DatePickerModal
                    value={typeof value === 'string' ? value : ''}
                    onConfirm={(d) => { onChange(d); setShowPicker(false); setOpen(false); }}
                    onClose={() => setShowPicker(false)}
                />
            )}
        </div>
    );
};

export default DateProperty;
