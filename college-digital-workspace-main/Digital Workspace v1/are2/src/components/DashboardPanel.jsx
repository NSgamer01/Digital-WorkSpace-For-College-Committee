import React from 'react';

const DashboardPanel = ({ title, actionText, onAction, children }) => {
    return (
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 backdrop-blur-sm">
            {/* Header Section */}
            <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-white">{title}</h2>
                {actionText && (
                    <button
                        onClick={onAction}
                        className="text-blue-400 hover:underline cursor-pointer text-sm transition-all"
                    >
                        {actionText}
                    </button>
                )}
            </div>

            {/* Content Section */}
            <div>
                {children}
            </div>
        </div>
    );
};

export default DashboardPanel;
