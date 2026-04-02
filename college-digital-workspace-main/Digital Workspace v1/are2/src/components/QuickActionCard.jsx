import React from 'react';

const QuickActionCard = ({ title, icon, onClick }) => {
    return (
        <button
            onClick={onClick}
            className="bg-zinc-800/70 hover:bg-zinc-700 border border-zinc-700 rounded-xl p-6 flex flex-col items-center justify-center gap-3 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-blue-500/10"
        >
            <span className="text-3xl">{icon}</span>
            <span className="text-white font-medium text-sm">{title}</span>
        </button>
    );
};

export default QuickActionCard;
