// ============================================
// src/pages/Calendar.jsx
// ============================================
// Main Calendar page with react-big-calendar
// + upcoming sidebar + CRUD modals.
// ============================================

import React, { useState, useCallback, useMemo } from 'react';
import { Calendar as BigCalendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './Calendar.css';

import useCalendar from '../hooks/useCalendar';
import { useCommittee } from '../contexts/CommitteeContext';
import UpcomingMeetings from '../components/UpcomingMeetings';
import MeetingModal from '../components/MeetingModal';
import GoogleEventDetail from '../components/GoogleEventDetail';

const localizer = momentLocalizer(moment);

const VIEWS = ['month', 'week', 'day', 'agenda'];

const Calendar = () => {
    const {
        allEvents,
        meetings,
        googleEvents,
        loading,
        error,
        isGoogleConnected,
        isGoogleLoading,
        googleError,
        connectGoogle,
        disconnectGoogle,
        createMeeting,
        updateMeeting,
        deleteMeeting,
        refreshMeetings,
        setDateRange,
        upcomingMeetings,
    } = useCalendar();

    const { currentCommittee } = useCommittee();

    // ── View state ────────────────────────────────
    const [currentView, setCurrentView] = useState('month');
    const [currentDate, setCurrentDate] = useState(new Date());

    // ── Modal state ───────────────────────────────
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showGoogleDetail, setShowGoogleDetail] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [googleDetailEvent, setGoogleDetailEvent] = useState(null);

    // ── Google dropdown ───────────────────────────
    const [showGoogleDropdown, setShowGoogleDropdown] = useState(false);

    // ── Handlers ──────────────────────────────────
    const handleSelectSlot = useCallback(({ start, end }) => {
        setSelectedSlot({ start, end });
        setShowCreateModal(true);
    }, []);

    const handleSelectEvent = useCallback((event) => {
        if (event.source === 'google') {
            setGoogleDetailEvent(event);
            setShowGoogleDetail(true);
        } else {
            setSelectedEvent(event);
            setShowEditModal(true);
        }
    }, []);

    const handleNavigate = useCallback((date) => {
        setCurrentDate(date);
    }, []);

    const handleViewChange = useCallback((view) => {
        setCurrentView(view);
    }, []);

    const handleRangeChange = useCallback((range) => {
        let start, end;
        if (Array.isArray(range)) {
            start = range[0];
            end = range[range.length - 1];
        } else if (range.start && range.end) {
            start = range.start;
            end = range.end;
        }
        if (start && end) {
            setDateRange({ start, end });
        }
    }, [setDateRange]);

    const handleEditMeeting = useCallback((meeting) => {
        setSelectedEvent(meeting);
        setShowEditModal(true);
    }, []);

    const handleCreateSubmit = useCallback(async (formData) => {
        await createMeeting(formData);
        setShowCreateModal(false);
        setSelectedSlot(null);
    }, [createMeeting]);

    const handleEditSubmit = useCallback(async (formData) => {
        await updateMeeting(selectedEvent.id, formData);
        setShowEditModal(false);
        setSelectedEvent(null);
    }, [updateMeeting, selectedEvent]);

    const handleDelete = useCallback(async (meetingId) => {
        await deleteMeeting(meetingId);
        setShowEditModal(false);
        setSelectedEvent(null);
    }, [deleteMeeting]);

    // ── Event style getter ────────────────────────
    const eventStyleGetter = useCallback((event) => {
        let style;
        if (event.source === 'google') {
            style = {
                backgroundColor: '#4285f4',
                opacity: 0.85,
                border: '1px solid #1a73e8',
                borderRadius: '4px',
                color: 'white',
                fontSize: '12px',
            };
        } else {
            style = {
                backgroundColor: event.color || '#6366f1',
                opacity: event.status === 'cancelled' ? 0.4 : 0.9,
                border: 'none',
                borderRadius: '4px',
                color: 'white',
                fontSize: '12px',
            };
        }
        return { style };
    }, []);

    // ── Navigation helpers ────────────────────────
    const goToday = () => setCurrentDate(new Date());

    const goPrev = () => {
        const d = new Date(currentDate);
        if (currentView === 'month') d.setMonth(d.getMonth() - 1);
        else if (currentView === 'week') d.setDate(d.getDate() - 7);
        else if (currentView === 'day') d.setDate(d.getDate() - 1);
        else d.setMonth(d.getMonth() - 1);
        setCurrentDate(d);
    };

    const goNext = () => {
        const d = new Date(currentDate);
        if (currentView === 'month') d.setMonth(d.getMonth() + 1);
        else if (currentView === 'week') d.setDate(d.getDate() + 7);
        else if (currentView === 'day') d.setDate(d.getDate() + 1);
        else d.setMonth(d.getMonth() + 1);
        setCurrentDate(d);
    };

    const headerLabel = useMemo(() => {
        if (currentView === 'month') {
            return moment(currentDate).format('MMMM YYYY');
        } else if (currentView === 'week') {
            const start = moment(currentDate).startOf('week');
            const end = moment(currentDate).endOf('week');
            return `${start.format('MMM D')} - ${end.format('MMM D, YYYY')}`;
        } else if (currentView === 'day') {
            return moment(currentDate).format('dddd, MMMM D, YYYY');
        }
        return moment(currentDate).format('MMMM YYYY');
    }, [currentDate, currentView]);

    // ── Stats ─────────────────────────────────────
    const pgCount = meetings.length;
    const gCount = googleEvents.length;

    return (
        <div style={styles.page}>
            {/* ── Page header ────────────────────────── */}
            <div style={styles.pageHeader}>
                <div>
                    <h1 style={styles.pageTitle}>Calendar</h1>
                    <p style={styles.pageSubtitle}>Manage your meetings and schedule</p>
                </div>
                <div style={styles.headerActions}>
                    <button style={styles.createBtn} onClick={() => setShowCreateModal(true)}>
                        + Create
                    </button>

                    {/* Google Calendar button */}
                    <div style={{ position: 'relative' }}>
                        {isGoogleLoading ? (
                            <button style={styles.googleBtnLoading} disabled>
                                <span style={styles.spinner} /> Connecting...
                            </button>
                        ) : isGoogleConnected ? (
                            <>
                                <button
                                    style={styles.googleBtnConnected}
                                    onClick={() => setShowGoogleDropdown(!showGoogleDropdown)}
                                >
                                    🔵 Google Connected ✓
                                </button>
                                {showGoogleDropdown && (
                                    <div style={styles.googleDropdown}>
                                        <button
                                            style={styles.googleDropdownItem}
                                            onClick={() => { disconnectGoogle(); setShowGoogleDropdown(false); }}
                                        >
                                            Disconnect Google Calendar
                                        </button>
                                    </div>
                                )}
                            </>
                        ) : (
                            <button style={styles.googleBtn} onClick={connectGoogle}>
                                🔵 Connect Google
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Google error banner */}
            {googleError && (
                <div style={styles.errorBanner}>
                    ⚠️ {googleError}
                    <button style={styles.dismissBtn} onClick={() => { }}>✕</button>
                </div>
            )}

            {/* Stats bar */}
            <div style={styles.statsBar}>
                <span style={styles.statItem}>📋 {pgCount} Meetings</span>
                <span style={styles.statItem}>🔵 {gCount} Google</span>
                <span style={styles.statItem}>Σ {pgCount + gCount} Total</span>
            </div>

            {/* ── Two-column layout ─────────────────── */}
            <div className="calendar-layout" style={styles.layout}>
                {/* Left: Calendar */}
                <div style={styles.calendarColumn}>
                    {/* Custom toolbar */}
                    <div style={styles.toolbar}>
                        <div style={styles.toolbarLeft}>
                            <button style={styles.navBtn} onClick={goPrev}>‹</button>
                            <h2 style={styles.navTitle}>{headerLabel}</h2>
                            <button style={styles.navBtn} onClick={goNext}>›</button>
                        </div>
                        <div style={styles.toolbarRight}>
                            <button
                                style={{
                                    ...styles.todayBtn,
                                    ...(moment(currentDate).isSame(new Date(), 'day') ? styles.todayBtnActive : {}),
                                }}
                                onClick={goToday}
                            >
                                Today
                            </button>
                            {VIEWS.map((v) => (
                                <button
                                    key={v}
                                    style={{
                                        ...styles.viewBtn,
                                        ...(currentView === v ? styles.viewBtnActive : {}),
                                    }}
                                    onClick={() => setCurrentView(v)}
                                >
                                    {v.charAt(0).toUpperCase() + v.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* BigCalendar */}
                    <div style={styles.calendarWrapper}>
                        <BigCalendar
                            localizer={localizer}
                            events={allEvents}
                            startAccessor="start"
                            endAccessor="end"
                            titleAccessor="title"
                            allDayAccessor="allDay"
                            view={currentView}
                            date={currentDate}
                            onNavigate={handleNavigate}
                            onView={handleViewChange}
                            onRangeChange={handleRangeChange}
                            onSelectSlot={handleSelectSlot}
                            onSelectEvent={handleSelectEvent}
                            selectable
                            popup
                            defaultView="month"
                            eventPropGetter={eventStyleGetter}
                            style={{ height: 'calc(100vh - 280px)', minHeight: '500px' }}
                            views={VIEWS}
                            toolbar={false}
                        />
                    </div>
                </div>

                {/* Right: Upcoming sidebar */}
                <div className="calendar-sidebar" style={styles.sidebar}>
                    <UpcomingMeetings
                        meetings={upcomingMeetings}
                        loading={loading}
                        onEdit={handleEditMeeting}
                        onDelete={(meetingId) => {
                            if (window.confirm('Are you sure you want to delete this meeting?')) {
                                deleteMeeting(meetingId);
                            }
                        }}
                        onCreate={() => setShowCreateModal(true)}
                        maxItems={7}
                        compact={true}
                    />
                </div>
            </div>

            {/* ── Modals ────────────────────────────── */}
            {showCreateModal && (
                <MeetingModal
                    mode="create"
                    slot={selectedSlot}
                    onSubmit={handleCreateSubmit}
                    onClose={() => { setShowCreateModal(false); setSelectedSlot(null); }}
                    committeeSlug={currentCommittee?.slug}
                />
            )}

            {showEditModal && selectedEvent && (
                <MeetingModal
                    mode="edit"
                    initialData={selectedEvent}
                    onSubmit={handleEditSubmit}
                    onDelete={handleDelete}
                    onClose={() => { setShowEditModal(false); setSelectedEvent(null); }}
                    committeeSlug={currentCommittee?.slug}
                />
            )}

            {showGoogleDetail && googleDetailEvent && (
                <GoogleEventDetail
                    event={googleDetailEvent}
                    onClose={() => { setShowGoogleDetail(false); setGoogleDetailEvent(null); }}
                />
            )}
        </div>
    );
};

// ── Styles ──────────────────────────────────────
const styles = {
    page: {
        padding: '0',
    },
    pageHeader: {
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: '16px',
    },
    pageTitle: {
        fontSize: '28px',
        fontWeight: '700',
        color: 'var(--textPrimary)',
        margin: '0 0 4px 0',
    },
    pageSubtitle: {
        fontSize: '14px',
        color: 'var(--textTertiary)',
        margin: 0,
    },
    headerActions: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
    },
    createBtn: {
        padding: '10px 20px',
        borderRadius: '10px',
        border: 'none',
        backgroundColor: 'var(--accent)',
        color: '#fff',
        fontSize: '13px',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'background-color 0.2s',
    },
    googleBtn: {
        padding: '10px 16px',
        borderRadius: '10px',
        border: '1px solid var(--border)',
        backgroundColor: 'transparent',
        color: 'var(--textSecondary)',
        fontSize: '13px',
        fontWeight: '500',
        cursor: 'pointer',
        transition: 'background-color 0.2s',
    },
    googleBtnConnected: {
        padding: '10px 16px',
        borderRadius: '10px',
        border: '1px solid rgba(66, 133, 244, 0.3)',
        backgroundColor: 'rgba(66, 133, 244, 0.08)',
        color: '#4285f4',
        fontSize: '13px',
        fontWeight: '500',
        cursor: 'pointer',
        transition: 'background-color 0.2s',
    },
    googleBtnLoading: {
        padding: '10px 16px',
        borderRadius: '10px',
        border: '1px solid var(--border)',
        backgroundColor: 'transparent',
        color: 'var(--textTertiary)',
        fontSize: '13px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        cursor: 'default',
    },
    spinner: {
        display: 'inline-block',
        width: '14px',
        height: '14px',
        border: '2px solid var(--border)',
        borderTopColor: 'var(--accent)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
    },
    googleDropdown: {
        position: 'absolute',
        right: 0,
        top: '100%',
        marginTop: '4px',
        backgroundColor: 'var(--cardBg)',
        border: '1px solid var(--border)',
        borderRadius: '10px',
        boxShadow: '0 8px 24px var(--shadowMedium)',
        zIndex: 50,
        overflow: 'hidden',
        minWidth: '200px',
    },
    googleDropdownItem: {
        display: 'block',
        width: '100%',
        padding: '10px 14px',
        background: 'none',
        border: 'none',
        color: '#f87171',
        fontSize: '13px',
        textAlign: 'left',
        cursor: 'pointer',
    },
    errorBanner: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        borderRadius: '10px',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        color: '#f87171',
        fontSize: '13px',
        marginBottom: '12px',
    },
    dismissBtn: {
        background: 'none',
        border: 'none',
        color: '#f87171',
        cursor: 'pointer',
        fontSize: '14px',
    },
    statsBar: {
        display: 'flex',
        gap: '16px',
        marginBottom: '16px',
        fontSize: '13px',
        color: 'var(--textTertiary)',
    },
    statItem: {
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
    },
    layout: {
        display: 'flex',
        gap: '20px',
    },
    calendarColumn: {
        flex: 1,
        minWidth: 0,
    },
    sidebar: {
        width: '300px',
        minWidth: '280px',
        flexShrink: 0,
    },
    toolbar: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '16px',
        flexWrap: 'wrap',
        gap: '10px',
    },
    toolbarLeft: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    navBtn: {
        width: '32px',
        height: '32px',
        borderRadius: '8px',
        border: '1px solid var(--border)',
        backgroundColor: 'transparent',
        color: 'var(--textPrimary)',
        fontSize: '18px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background-color 0.15s',
    },
    navTitle: {
        fontSize: '18px',
        fontWeight: '700',
        color: 'var(--textPrimary)',
        margin: '0 4px',
        minWidth: '160px',
        textAlign: 'center',
    },
    toolbarRight: {
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
    },
    todayBtn: {
        padding: '7px 14px',
        borderRadius: '8px',
        border: '1px solid var(--border)',
        backgroundColor: 'transparent',
        color: 'var(--textSecondary)',
        fontSize: '13px',
        fontWeight: '500',
        cursor: 'pointer',
        marginRight: '8px',
        transition: 'background-color 0.15s',
    },
    todayBtnActive: {
        backgroundColor: 'var(--bgTertiary)',
        color: 'var(--textPrimary)',
    },
    viewBtn: {
        padding: '7px 14px',
        borderRadius: '8px',
        border: '1px solid var(--border)',
        backgroundColor: 'transparent',
        color: 'var(--textSecondary)',
        fontSize: '13px',
        fontWeight: '500',
        cursor: 'pointer',
        transition: 'background-color 0.15s',
    },
    viewBtnActive: {
        backgroundColor: 'var(--accent)',
        color: '#fff',
        border: '1px solid var(--accent)',
    },
    calendarWrapper: {
        borderRadius: '12px',
        overflow: 'hidden',
    },
};

export default Calendar;
