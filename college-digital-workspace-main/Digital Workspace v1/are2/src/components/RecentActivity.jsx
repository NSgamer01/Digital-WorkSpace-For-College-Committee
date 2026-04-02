import React, { useState, useEffect } from 'react';
import { getRecentActivity } from '../services/activityService';

const TYPE_ICONS = {
    task: '📝',
    meeting: '📅',
    announcement: '📢',
    upload: '📂',
};

function timeAgo(dateStr) {
    if (!dateStr) return '';
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

const RecentActivity = () => {
    const [activities, setActivities] = useState([]);

    useEffect(() => {
        let active = true;

        const fetchActivities = async () => {
            try {
                const list = await getRecentActivity(4);
                if (active) setActivities(list);
            } catch (error) {
                console.error('❌ Error fetching activities:', error);
                if (active) setActivities([]);
            }
        };

        fetchActivities();
        const interval = setInterval(fetchActivities, 30000);

        return () => { active = false; clearInterval(interval); };
    }, []);

    return (
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 backdrop-blur-sm">
            <h2 className="text-lg font-semibold text-white mb-4">Recent Activity</h2>

            {activities.length === 0 ? (
                <p className="text-zinc-500 text-sm py-4 text-center">No recent activity.</p>
            ) : (
                <div className="space-y-2">
                    {activities.map((activity) => (
                        <div
                            key={activity.id}
                            className="flex items-center justify-between bg-zinc-800/60 border border-zinc-700/40 rounded-xl px-4 py-2.5"
                        >
                            <div className="flex items-center gap-3">
                                <span className="text-xl">
                                    {TYPE_ICONS[activity.entity_type || activity.type] || '📌'}
                                </span>
                                <div>
                                    <p className="text-white text-sm font-medium">{activity.entity_name || activity.title}</p>
                                    {(() => {
                                        const detail = activity.details || activity.description;
                                        if (!detail) return null;
                                        // details is often a JSONB object like {name: 'file.pdf', size: 1024}
                                        if (typeof detail === 'object') {
                                            return <p className="text-zinc-400 text-xs">{detail.name || detail.action || JSON.stringify(detail)}</p>;
                                        }
                                        return <p className="text-zinc-400 text-xs">{detail}</p>;
                                    })()}
                                </div>
                            </div>
                            <span className="text-zinc-500 text-xs flex-shrink-0 ml-4">
                                {timeAgo(activity.created_at || activity.createdAt)}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default RecentActivity;
