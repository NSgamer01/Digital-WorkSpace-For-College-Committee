import React from 'react';

const StatCard = ({ title, value, icon, iconBg, textColor }) => {
    return (
        <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-6 hover:-translate-y-1 transition-all duration-300 backdrop-blur-sm">
            <div className="flex items-center justify-between">
                {/* Icon Section */}
                <div className={`${iconBg} rounded-lg w-14 h-14 flex items-center justify-center text-2xl`}>
                    {icon}
                </div>

                {/* Value and Title Section */}
                <div className="flex-1 text-right ml-4">
                    <p className={`text-3xl font-semibold ${textColor}`}>{value}</p>
                    <p className="text-zinc-400 text-sm mt-1">{title}</p>
                </div>
            </div>
        </div>
    );
};

export default StatCard;
