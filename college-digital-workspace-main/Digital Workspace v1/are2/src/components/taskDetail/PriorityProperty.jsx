import React, { useState } from 'react';
import PropertyPill from './PropertyPill';
import PropertyDropdown, { DropdownItem } from './PropertyDropdown';

const priorityConfig = [
    { label: 'Low', icon: '⬇️', color: '#71717a', bg: 'rgba(113,113,122,0.2)' },
    { label: 'Medium', icon: '➡️', color: '#eab308', bg: 'rgba(234,179,8,0.2)' },
    { label: 'High', icon: '⬆️', color: '#f97316', bg: 'rgba(249,115,22,0.2)' },
    { label: 'Urgent', icon: '🔥', color: '#ef4444', bg: 'rgba(239,68,68,0.2)' },
];

const legacyMap = { low: 'Low', medium: 'Medium', high: 'High' };

const PriorityProperty = ({ value, onChange }) => {
    const [open, setOpen] = useState(false);
    const display = legacyMap[value] || value || 'Medium';
    const config = priorityConfig.find((p) => p.label === display) || priorityConfig[1];

    return (
        <div style={{ position: 'relative', display: 'inline-block' }}>
            <PropertyPill icon="⭐" label="Priority" onClick={() => setOpen(!open)}>
                <span style={{
                    fontSize: 12, fontWeight: 600, color: config.color,
                    background: config.bg, padding: '2px 8px', borderRadius: 4,
                }}>
                    {config.icon} {display}
                </span>
            </PropertyPill>
            <PropertyDropdown isOpen={open} onClose={() => setOpen(false)}>
                {priorityConfig.map((p) => (
                    <DropdownItem
                        key={p.label}
                        icon={p.icon}
                        label={p.label}
                        color={p.color}
                        selected={display === p.label}
                        onClick={() => { onChange(p.label); setOpen(false); }}
                    />
                ))}
            </PropertyDropdown>
        </div>
    );
};

export default PriorityProperty;
