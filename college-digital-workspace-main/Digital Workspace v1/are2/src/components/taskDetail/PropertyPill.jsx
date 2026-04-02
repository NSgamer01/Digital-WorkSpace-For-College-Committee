import React from 'react';

const PropertyPill = ({ icon, label, children, onClick, className = '' }) => {
    return (
        <div
            className={`property-pill ${className}`}
            onClick={onClick}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 10px',
                borderRadius: 6,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                position: 'relative',
                userSelect: 'none',
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
            }}
        >
            {icon && <span style={{ fontSize: 13, opacity: 0.7 }}>{icon}</span>}
            {label && (
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 500, marginRight: 2 }}>
                    {label}
                </span>
            )}
            {children}
        </div>
    );
};

export default PropertyPill;
