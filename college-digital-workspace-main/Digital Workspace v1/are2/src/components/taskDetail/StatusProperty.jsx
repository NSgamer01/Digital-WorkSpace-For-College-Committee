import React, { useState } from 'react';
import PropertyPill from './PropertyPill';
import PropertyDropdown, { DropdownItem } from './PropertyDropdown';

const statusConfig = [
    { label: 'Pending', value: 'pending', color: '#eab308', bg: 'rgba(234,179,8,0.2)', icon: '○' },
    { label: 'In Progress', value: 'inprogress', color: '#3b82f6', bg: 'rgba(59,130,246,0.2)', icon: '◐' },
    { label: 'Complete', value: 'complete', color: '#22c55e', bg: 'rgba(34,197,94,0.2)', icon: '✓' },
];

const valueToLabel = {};
statusConfig.forEach(s => { valueToLabel[s.value] = s.label; });

const StatusProperty = ({ value, onChange }) => {
    const [open, setOpen] = useState(false);
    const config = statusConfig.find((s) => s.value === value) || statusConfig[0];

    return (
        <div style={{ position: 'relative', display: 'inline-block' }}>
            <PropertyPill icon="⚡" label="Status" onClick={() => setOpen(!open)}>
                <span
                    style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: config.color,
                        background: config.bg,
                        padding: '2px 8px',
                        borderRadius: 4,
                    }}
                >
                    {config.icon} {config.label}
                </span>
            </PropertyPill>
            <PropertyDropdown isOpen={open} onClose={() => setOpen(false)}>
                {statusConfig.map((s) => (
                    <DropdownItem
                        key={s.value}
                        icon={s.icon}
                        label={s.label}
                        color={s.color}
                        selected={value === s.value}
                        onClick={() => { onChange(s.value); setOpen(false); }}
                    />
                ))}
            </PropertyDropdown>
        </div>
    );
};

export default StatusProperty;
