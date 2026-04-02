// ============================================
// src/components/MeetingModal.jsx
// ============================================
// Create/Edit modal for meetings.
// Features:
//   • Google Meet link generation
//   • Optional Google Calendar sync
//   • Attendee selection from committee members
//   • Color picker, all-day toggle, validation
// ============================================

import React, { useState, useEffect, useRef } from 'react';
import AttendeeSelector from './AttendeeSelector';
import googleCalendar from '../services/googleCalendar';

const COLOR_PRESETS = [
    '#6366f1', // indigo
    '#3b82f6', // blue
    '#10b981', // green
    '#f59e0b', // amber
    '#ef4444', // red
    '#ec4899', // pink
    '#8b5cf6', // purple
    '#06b6d4', // cyan
];

// ── Helper: format Date to datetime-local string ─
function toDatetimeLocal(date) {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── Helper: get next hour ────────────────────────
function getNextHour() {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() + 1);
    return d;
}

const MeetingModal = ({
    mode = 'create',
    initialData = null,
    slot = null,
    onSubmit,
    onDelete,
    onClose,
    committeeSlug,
}) => {
    const isEdit = mode === 'edit';
    const attendeeSelectorRef = useRef(null);

    // ── Form state ────────────────────────────────
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [allDay, setAllDay] = useState(false);
    const [location, setLocation] = useState('');
    const [meetingLink, setMeetingLink] = useState('');
    const [color, setColor] = useState('#6366f1');
    const [attendees, setAttendees] = useState([]);
    const [status, setStatus] = useState('scheduled');
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});

    // ── Meet generation state ─────────────────────
    const [generatingMeet, setGeneratingMeet] = useState(false);
    const [meetError, setMeetError] = useState('');

    // ── Google Calendar sync state ────────────────
    const [syncStatus, setSyncStatus] = useState(''); // '', 'syncing', 'synced', 'failed'
    const isGoogleConnected = googleCalendar.isAuthenticated;

    // ── Pre-fill form ─────────────────────────────
    useEffect(() => {
        if (isEdit && initialData) {
            setTitle(initialData.title || '');
            setDescription(initialData.description || '');
            setStartTime(toDatetimeLocal(initialData.start));
            setEndTime(toDatetimeLocal(initialData.end));
            setAllDay(initialData.allDay || false);
            setLocation(initialData.location || '');
            setMeetingLink(initialData.meetingLink || '');
            setColor(initialData.color || '#6366f1');
            setAttendees(
                (initialData.attendees || []).map((a) => (typeof a === 'string' ? a : a.id)).filter(Boolean)
            );
            setStatus(initialData.status || 'scheduled');
        } else if (!isEdit) {
            if (slot) {
                setStartTime(toDatetimeLocal(slot.start));
                setEndTime(toDatetimeLocal(slot.end));
            } else {
                const start = getNextHour();
                const end = new Date(start.getTime() + 60 * 60 * 1000);
                setStartTime(toDatetimeLocal(start));
                setEndTime(toDatetimeLocal(end));
            }
            setColor('#6366f1');
            setAttendees([]);
            setStatus('scheduled');
        }
    }, [isEdit, initialData, slot]);

    // ── Validation ────────────────────────────────
    const validate = () => {
        const errs = {};
        if (!title.trim()) errs.title = 'Title is required';
        if (!allDay) {
            if (!startTime) errs.startTime = 'Start time is required';
            if (!endTime) errs.endTime = 'End time is required';
            if (startTime && endTime && new Date(startTime) >= new Date(endTime)) {
                errs.endTime = 'End time must be after start time';
            }
        }
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    // ── Generate Google Meet link ─────────────────
    const handleGenerateMeet = async () => {
        if (!title.trim()) {
            setMeetError('Enter a title first');
            return;
        }
        if (!startTime || !endTime) {
            setMeetError('Set start and end time first');
            return;
        }

        if (!googleCalendar.isAuthenticated) {
            setMeetError('Connect Google Calendar first (from the Calendar page)');
            return;
        }

        setGeneratingMeet(true);
        setMeetError('');
        try {
            const link = await googleCalendar.generateMeetLink(
                title.trim(),
                new Date(startTime).toISOString(),
                new Date(endTime).toISOString()
            );
            setMeetingLink(link);
        } catch (err) {
            console.error('Meet generation error:', err);
            setMeetError(err.message || 'Failed to generate Meet link');
        } finally {
            setGeneratingMeet(false);
        }
    };

    // ── Submit ────────────────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) return;

        setSaving(true);
        try {
            let st, et;
            if (allDay) {
                const startDate = new Date(startTime || new Date());
                startDate.setHours(0, 0, 0, 0);
                const endDate = new Date(endTime || startTime || new Date());
                endDate.setHours(23, 59, 59, 999);
                st = startDate.toISOString();
                et = endDate.toISOString();
            } else {
                st = new Date(startTime).toISOString();
                et = new Date(endTime).toISOString();
            }

            const formData = {
                title: title.trim(),
                description: description.trim(),
                startTime: st,
                endTime: et,
                allDay,
                location: location.trim(),
                meetingLink: meetingLink.trim() || null,
                color,
                attendees,
            };

            if (isEdit) {
                formData.status = status;
            }

            // 1. Save to PostgreSQL (the source of truth)
            await onSubmit(formData);

            // 2. Auto-sync to Google Calendar when connected (fire-and-forget)
            if (isGoogleConnected && !isEdit) {
                setSyncStatus('syncing');
                try {
                    const emails = attendeeSelectorRef.current?.getMemberEmails?.(attendees) || [];
                    const result = await googleCalendar.syncMeetingToGoogleCalendar(
                        {
                            title: formData.title,
                            description: formData.description,
                            startTime: st,
                            endTime: et,
                            location: formData.location,
                            meetingLink: formData.meetingLink,
                            allDay: formData.allDay,
                        },
                        emails
                    );
                    setSyncStatus(result ? 'synced' : 'failed');
                    if (result) {
                        console.log('Meeting synced to Google Calendar:', result);
                    }
                } catch {
                    setSyncStatus('failed');
                }
            }
        } catch (err) {
            console.error('Meeting submit error:', err);
            setErrors({ submit: err.message || 'Failed to save meeting' });
        } finally {
            setSaving(false);
        }
    };

    // ── Delete ────────────────────────────────────
    const handleDelete = () => {
        if (window.confirm('Are you sure you want to delete this meeting?')) {
            onDelete(initialData.id);
        }
    };

    // ── Format dates for display in edit mode info ─
    const formatInfoDate = (dateStr) => {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    return (
        <div style={styles.overlay} onClick={onClose}>
            <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div style={styles.header}>
                    <h2 style={styles.headerTitle}>
                        {isEdit ? 'Edit Meeting' : 'Create Meeting'}
                    </h2>
                    <button style={styles.closeBtn} onClick={onClose}>✕</button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} style={styles.body}>
                    {/* Title */}
                    <div style={styles.field}>
                        <label style={styles.label}>Title *</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Meeting title"
                            style={{
                                ...styles.input,
                                ...(errors.title ? styles.inputError : {}),
                            }}
                        />
                        {errors.title && <span style={styles.errorMsg}>{errors.title}</span>}
                    </div>

                    {/* Description */}
                    <div style={styles.field}>
                        <label style={styles.label}>Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Add description..."
                            rows={3}
                            style={styles.textarea}
                        />
                    </div>

                    {/* All Day */}
                    <div style={styles.checkboxRow}>
                        <input
                            type="checkbox"
                            id="allDay"
                            checked={allDay}
                            onChange={(e) => setAllDay(e.target.checked)}
                            style={styles.checkboxInput}
                        />
                        <label htmlFor="allDay" style={styles.checkboxLabel}>All day event</label>
                    </div>

                    {/* Start & End */}
                    {!allDay && (
                        <div style={styles.dateRow}>
                            <div style={{ flex: 1 }}>
                                <label style={styles.label}>Start *</label>
                                <input
                                    type="datetime-local"
                                    value={startTime}
                                    onChange={(e) => setStartTime(e.target.value)}
                                    style={{
                                        ...styles.input,
                                        ...(errors.startTime ? styles.inputError : {}),
                                    }}
                                />
                                {errors.startTime && <span style={styles.errorMsg}>{errors.startTime}</span>}
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={styles.label}>End *</label>
                                <input
                                    type="datetime-local"
                                    value={endTime}
                                    onChange={(e) => setEndTime(e.target.value)}
                                    style={{
                                        ...styles.input,
                                        ...(errors.endTime ? styles.inputError : {}),
                                    }}
                                />
                                {errors.endTime && <span style={styles.errorMsg}>{errors.endTime}</span>}
                            </div>
                        </div>
                    )}
                    {allDay && (
                        <div style={styles.dateRow}>
                            <div style={{ flex: 1 }}>
                                <label style={styles.label}>Start Date *</label>
                                <input
                                    type="date"
                                    value={startTime ? startTime.split('T')[0] : ''}
                                    onChange={(e) => setStartTime(e.target.value + 'T00:00')}
                                    style={styles.input}
                                />
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={styles.label}>End Date *</label>
                                <input
                                    type="date"
                                    value={endTime ? endTime.split('T')[0] : ''}
                                    onChange={(e) => setEndTime(e.target.value + 'T23:59')}
                                    style={styles.input}
                                />
                            </div>
                        </div>
                    )}

                    {/* Location */}
                    <div style={styles.field}>
                        <label style={styles.label}>Location</label>
                        <input
                            type="text"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            placeholder="Room 204, Main Building"
                            style={styles.input}
                        />
                    </div>

                    {/* ── Meeting Link + Meet Generation ───────── */}
                    <div style={styles.field}>
                        <label style={styles.label}>Meeting Link</label>
                        <div style={styles.meetLinkRow}>
                            <input
                                type="url"
                                value={meetingLink}
                                onChange={(e) => { setMeetingLink(e.target.value); setMeetError(''); }}
                                placeholder="https://meet.google.com/abc-defg-hij"
                                style={{ ...styles.input, flex: 1 }}
                            />
                            <button
                                type="button"
                                onClick={handleGenerateMeet}
                                disabled={generatingMeet}
                                style={{
                                    ...styles.meetBtn,
                                    opacity: generatingMeet ? 0.6 : 1,
                                }}
                                title={
                                    isGoogleConnected
                                        ? 'Generate a Google Meet link automatically'
                                        : 'Connect Google Calendar first from the Calendar page'
                                }
                            >
                                {generatingMeet ? (
                                    <>
                                        <span style={styles.miniSpinner} />
                                        Generating...
                                    </>
                                ) : (
                                    <>📹 Generate Meet</>
                                )}
                            </button>
                        </div>
                        {meetError && <span style={styles.errorMsg}>{meetError}</span>}
                        {meetingLink && meetingLink.includes('meet.google.com') && (
                            <div style={styles.meetSuccess}>
                                ✅ Google Meet link ready
                            </div>
                        )}
                    </div>

                    {/* Color Picker */}
                    <div style={styles.field}>
                        <label style={styles.label}>Color</label>
                        <div style={styles.colorRow}>
                            {COLOR_PRESETS.map((c) => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => setColor(c)}
                                    style={{
                                        ...styles.colorCircle,
                                        backgroundColor: c,
                                        boxShadow: color === c
                                            ? `0 0 0 3px var(--cardBg), 0 0 0 5px ${c}`
                                            : 'none',
                                        transform: color === c ? 'scale(1.15)' : 'scale(1)',
                                    }}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Attendees */}
                    <div style={styles.field}>
                        <label style={styles.label}>Attendees</label>
                        <AttendeeSelector
                            ref={attendeeSelectorRef}
                            selectedIds={attendees}
                            onChange={setAttendees}
                            committeeSlug={committeeSlug}
                        />
                    </div>

                    {/* Auto-sync indicator (create only) */}
                    {!isEdit && (
                        <div style={styles.syncBox}>
                            {isGoogleConnected ? (
                                <div style={styles.checkboxRow}>
                                    <span style={{ fontSize: '14px' }}>🔵</span>
                                    <span style={styles.checkboxLabel}>
                                        Will auto-sync to Google Calendar
                                    </span>
                                </div>
                            ) : (
                                <div style={styles.checkboxRow}>
                                    <span style={{ fontSize: '14px', opacity: 0.5 }}>⚪</span>
                                    <span style={{ ...styles.checkboxLabel, opacity: 0.5 }}>
                                        Connect Google Calendar to auto-sync
                                    </span>
                                </div>
                            )}
                            {syncStatus === 'syncing' && (
                                <div style={styles.syncStatusMsg}>
                                    <span style={styles.miniSpinner} /> Syncing to Google Calendar...
                                </div>
                            )}
                            {syncStatus === 'synced' && (
                                <div style={{ ...styles.syncStatusMsg, color: '#10b981' }}>
                                    ✅ Synced to Google Calendar
                                </div>
                            )}
                            {syncStatus === 'failed' && (
                                <div style={{ ...styles.syncStatusMsg, color: '#ef4444' }}>
                                    ⚠️ Google Calendar sync failed (meeting was saved)
                                </div>
                            )}
                        </div>
                    )}

                    {/* Status (edit only) */}
                    {isEdit && (
                        <div style={styles.field}>
                            <label style={styles.label}>Status</label>
                            <select
                                value={status}
                                onChange={(e) => setStatus(e.target.value)}
                                style={styles.select}
                            >
                                <option value="scheduled">Scheduled</option>
                                <option value="ongoing">Ongoing</option>
                                <option value="completed">Completed</option>
                                <option value="cancelled">Cancelled</option>
                            </select>
                        </div>
                    )}

                    {/* Edit mode info */}
                    {isEdit && initialData && (
                        <div style={styles.infoBox}>
                            {initialData.creatorName && (
                                <div style={styles.infoRow}>
                                    <span style={styles.infoLabel}>Created by:</span>
                                    <span style={styles.infoValue}>{initialData.creatorName}</span>
                                </div>
                            )}
                            {initialData.createdAt && (
                                <div style={styles.infoRow}>
                                    <span style={styles.infoLabel}>Created:</span>
                                    <span style={styles.infoValue}>{formatInfoDate(initialData.createdAt)}</span>
                                </div>
                            )}
                            {initialData.updatedAt && (
                                <div style={styles.infoRow}>
                                    <span style={styles.infoLabel}>Last updated:</span>
                                    <span style={styles.infoValue}>{formatInfoDate(initialData.updatedAt)}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Submit error */}
                    {errors.submit && (
                        <div style={styles.submitError}>{errors.submit}</div>
                    )}

                    {/* Footer */}
                    <div style={styles.footer}>
                        <div>
                            {isEdit && onDelete && (
                                <button
                                    type="button"
                                    onClick={handleDelete}
                                    style={styles.deleteBtn}
                                    disabled={saving}
                                >
                                    Delete
                                </button>
                            )}
                        </div>
                        <div style={styles.footerRight}>
                            <button
                                type="button"
                                onClick={onClose}
                                style={styles.cancelBtn}
                                disabled={saving}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                style={{
                                    ...styles.submitBtn,
                                    opacity: saving ? 0.7 : 1,
                                }}
                                disabled={saving}
                            >
                                {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Meeting'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ── Styles ──────────────────────────────────────
const styles = {
    overlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
    },
    modal: {
        backgroundColor: 'var(--cardBg)',
        borderRadius: '16px',
        maxWidth: '600px',
        width: '95%',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 24px 48px rgba(0, 0, 0, 0.3)',
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '20px 24px',
        borderBottom: '1px solid var(--border)',
        position: 'sticky',
        top: 0,
        backgroundColor: 'var(--cardBg)',
        zIndex: 1,
    },
    headerTitle: {
        fontSize: '18px',
        fontWeight: '700',
        color: 'var(--textPrimary)',
        margin: 0,
    },
    closeBtn: {
        background: 'none',
        border: 'none',
        color: 'var(--textTertiary)',
        fontSize: '18px',
        cursor: 'pointer',
        padding: '4px',
        lineHeight: 1,
        borderRadius: '6px',
        transition: 'color 0.2s',
    },
    body: {
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '18px',
    },
    field: {
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
    },
    label: {
        fontSize: '13px',
        fontWeight: '600',
        color: 'var(--textSecondary)',
    },
    input: {
        padding: '10px 14px',
        borderRadius: '10px',
        border: '1px solid var(--inputBorder, var(--border))',
        backgroundColor: 'var(--inputBg, var(--bgSecondary))',
        color: 'var(--textPrimary)',
        fontSize: '14px',
        outline: 'none',
        transition: 'border-color 0.2s',
        width: '100%',
        boxSizing: 'border-box',
    },
    inputError: {
        borderColor: 'var(--error, #ef4444)',
    },
    textarea: {
        padding: '10px 14px',
        borderRadius: '10px',
        border: '1px solid var(--inputBorder, var(--border))',
        backgroundColor: 'var(--inputBg, var(--bgSecondary))',
        color: 'var(--textPrimary)',
        fontSize: '14px',
        outline: 'none',
        resize: 'vertical',
        fontFamily: 'inherit',
        width: '100%',
        boxSizing: 'border-box',
    },
    select: {
        padding: '10px 14px',
        borderRadius: '10px',
        border: '1px solid var(--inputBorder, var(--border))',
        backgroundColor: 'var(--inputBg, var(--bgSecondary))',
        color: 'var(--textPrimary)',
        fontSize: '14px',
        outline: 'none',
        cursor: 'pointer',
        width: '100%',
        boxSizing: 'border-box',
    },
    errorMsg: {
        fontSize: '12px',
        color: 'var(--error, #ef4444)',
    },
    checkboxRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    checkboxInput: {
        accentColor: 'var(--accent)',
        width: '16px',
        height: '16px',
        cursor: 'pointer',
    },
    checkboxLabel: {
        fontSize: '14px',
        color: 'var(--textPrimary)',
        cursor: 'pointer',
    },
    dateRow: {
        display: 'flex',
        gap: '12px',
    },
    // ── Meeting Link + Meet Button ──────────────
    meetLinkRow: {
        display: 'flex',
        gap: '8px',
        alignItems: 'stretch',
    },
    meetBtn: {
        padding: '10px 14px',
        borderRadius: '10px',
        border: '1px solid rgba(66, 133, 244, 0.3)',
        backgroundColor: 'rgba(66, 133, 244, 0.08)',
        color: '#4285f4',
        fontSize: '12px',
        fontWeight: '600',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        transition: 'background-color 0.2s',
        flexShrink: 0,
    },
    meetSuccess: {
        fontSize: '12px',
        color: '#10b981',
        fontWeight: '500',
        marginTop: '2px',
    },
    miniSpinner: {
        display: 'inline-block',
        width: '12px',
        height: '12px',
        border: '2px solid rgba(66, 133, 244, 0.3)',
        borderTopColor: '#4285f4',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
    },
    // ── Google Calendar Sync ────────────────────
    syncBox: {
        padding: '14px',
        borderRadius: '10px',
        border: '1px solid var(--border)',
        backgroundColor: 'var(--bgTertiary)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
    },
    syncHint: {
        fontSize: '12px',
        color: 'var(--textTertiary)',
        margin: '0 0 0 24px',
        lineHeight: 1.4,
    },
    syncStatusMsg: {
        fontSize: '12px',
        fontWeight: '500',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        marginLeft: '24px',
    },
    // ── Color picker ────────────────────────────
    colorRow: {
        display: 'flex',
        gap: '10px',
        flexWrap: 'wrap',
    },
    colorCircle: {
        width: '28px',
        height: '28px',
        borderRadius: '50%',
        border: 'none',
        cursor: 'pointer',
        transition: 'transform 0.15s, box-shadow 0.15s',
        padding: 0,
    },
    // ── Info box ─────────────────────────────────
    infoBox: {
        padding: '12px 14px',
        borderRadius: '10px',
        backgroundColor: 'var(--bgTertiary)',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
    },
    infoRow: {
        display: 'flex',
        gap: '6px',
        fontSize: '12px',
    },
    infoLabel: {
        color: 'var(--textTertiary)',
        fontWeight: '500',
    },
    infoValue: {
        color: 'var(--textSecondary)',
    },
    submitError: {
        padding: '10px 14px',
        borderRadius: '8px',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        color: 'var(--error, #ef4444)',
        fontSize: '13px',
        textAlign: 'center',
    },
    footer: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: '16px',
        borderTop: '1px solid var(--border)',
    },
    footerRight: {
        display: 'flex',
        gap: '10px',
    },
    deleteBtn: {
        padding: '10px 18px',
        borderRadius: '10px',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        color: '#f87171',
        fontSize: '13px',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'background-color 0.2s',
    },
    cancelBtn: {
        padding: '10px 18px',
        borderRadius: '10px',
        border: '1px solid var(--border)',
        backgroundColor: 'transparent',
        color: 'var(--textSecondary)',
        fontSize: '13px',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'background-color 0.2s',
    },
    submitBtn: {
        padding: '10px 24px',
        borderRadius: '10px',
        border: 'none',
        backgroundColor: 'var(--accent)',
        color: '#fff',
        fontSize: '13px',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'opacity 0.2s',
    },
};

export default MeetingModal;
