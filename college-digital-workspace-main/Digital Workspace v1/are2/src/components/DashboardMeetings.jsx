// ============================================
// src/components/DashboardMeetings.jsx
// ============================================
// Self-contained widget for the Dashboard page.
// Fetches its own data using useMeetings hook.
// Manages its own edit modal state.
// ============================================

import React, { useState } from 'react';
import useMeetings from '../hooks/useMeetings';
import UpcomingMeetings from './UpcomingMeetings';
import MeetingModal from './MeetingModal';
import { useCommittee } from '../contexts/CommitteeContext';

const DashboardMeetings = () => {
    const { meetings, loading, error, refresh, createMeeting, updateMeeting, deleteMeeting } = useMeetings({
        upcoming: true,
        limit: 5,
    });

    const [showEditModal, setShowEditModal] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedMeeting, setSelectedMeeting] = useState(null);
    const { currentCommittee } = useCommittee();

    const handleEdit = (meeting) => {
        setSelectedMeeting(meeting);
        setShowEditModal(true);
    };

    const handleEditSubmit = async (formData) => {
        await updateMeeting(selectedMeeting.id, formData);
        setShowEditModal(false);
        setSelectedMeeting(null);
    };

    const handleCreateSubmit = async (formData) => {
        await createMeeting(formData);
        setShowCreateModal(false);
    };

    const handleDelete = async (meetingId) => {
        await deleteMeeting(meetingId);
        setShowEditModal(false);
        setSelectedMeeting(null);
    };

    return (
        <>
            <UpcomingMeetings
                meetings={meetings}
                loading={loading}
                error={error}
                onEdit={handleEdit}
                onDelete={(meetingId) => {
                    if (window.confirm('Are you sure you want to delete this meeting?')) {
                        deleteMeeting(meetingId);
                    }
                }}
                onCreate={() => setShowCreateModal(true)}
                maxItems={5}
                title="Upcoming Meetings"
                showViewAll={true}
                compact={true}
            />

            {showCreateModal && (
                <MeetingModal
                    mode="create"
                    onSubmit={handleCreateSubmit}
                    onClose={() => setShowCreateModal(false)}
                    committeeSlug={currentCommittee?.slug}
                />
            )}

            {showEditModal && selectedMeeting && (
                <MeetingModal
                    mode="edit"
                    initialData={selectedMeeting}
                    onSubmit={handleEditSubmit}
                    onDelete={handleDelete}
                    onClose={() => { setShowEditModal(false); setSelectedMeeting(null); }}
                    committeeSlug={currentCommittee?.slug}
                />
            )}
        </>
    );
};

export default DashboardMeetings;
