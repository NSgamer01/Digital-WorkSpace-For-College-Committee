import React, { useState, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { publishAnnouncement } from '../../services/announcementService';
import DatePickerModal from '../DatePickerModal';
import TimePickerModal from '../TimePickerModal';

// ── Toggle Switch ──────────────────────────────────────────────────
const ToggleSwitch = ({ label, enabled, onChange, icon }) => (
    <div className="flex items-center justify-between py-2">
        <div className="flex items-center gap-2.5">
            <span className="text-base">{icon}</span>
            <span className="text-sm text-zinc-300 font-medium">{label}</span>
        </div>
        <button
            type="button"
            onClick={() => onChange(!enabled)}
            className={`relative w-11 h-6 rounded-full transition-all duration-300 cursor-pointer flex-shrink-0
                ${enabled
                    ? 'bg-gradient-to-r from-purple-600 to-purple-500 shadow-[0_0_12px_rgba(147,51,234,0.3)]'
                    : 'bg-zinc-700'
                }`}
        >
            <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-300
                    ${enabled ? 'translate-x-5' : 'translate-x-0'}`}
            />
        </button>
    </div>
);

// ── Category Badge Colors ──────────────────────────────────────────
const CATEGORY_STYLES = {
    general: { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/20', dot: 'bg-blue-400' },
    event: { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/20', dot: 'bg-purple-400' },
    urgent: { bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/20', dot: 'bg-red-400' },
};

// ═══════════════════════════════════════════════════════════════════
//  REUSABLE ANNOUNCEMENT FORM MODAL
//
//  Props:
//    isOpen   – boolean controlling visibility
//    onClose  – callback to close the modal
// ═══════════════════════════════════════════════════════════════════
const AnnouncementForm = ({ isOpen, onClose }) => {
    // ── Form state ──
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [eventDate, setEventDate] = useState('');
    const [eventTime, setEventTime] = useState('');
    const [category, setCategory] = useState('general');
    const [pinned, setPinned] = useState(false);
    const [notifyAll, setNotifyAll] = useState(false);
    const [mediaFile, setMediaFile] = useState(null);
    const [mediaPreview, setMediaPreview] = useState(null);
    const [mediaType, setMediaType] = useState(null);

    // ── Sub-modal state ──
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);

    // ── Loading state ──
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fileInputRef = useRef(null);

    // ── Media handler ──
    const handleMediaSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');
        if (!isImage && !isVideo) return;

        setMediaFile(file);
        setMediaType(isImage ? 'image' : 'video');

        const reader = new FileReader();
        reader.onload = (ev) => setMediaPreview(ev.target.result);
        reader.readAsDataURL(file);
    };

    const removeMedia = () => {
        setMediaFile(null);
        setMediaPreview(null);
        setMediaType(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // ── Reset form ──
    const resetForm = () => {
        setTitle('');
        setDescription('');
        setEventDate('');
        setEventTime('');
        setCategory('general');
        setPinned(false);
        setNotifyAll(false);
        removeMedia();
    };

    // ── Submit — writes to PostgreSQL via announcementService ──
    const { user } = useAuth();

    const handleSubmit = async () => {
        if (!title.trim()) return;
        if (!user) {
            console.error('❌ No authenticated user.');
            return;
        }

        setIsSubmitting(true);

        try {
            // Publish via announcementService
            await publishAnnouncement({
                senderId: user.id,
                senderName: user.name || user.email || 'Unknown',
                title: title.trim(),
                description: description.trim(),
                eventDate: eventDate || null,
                eventTime: eventTime || null,
                category,
                pinned,
                notifyAll,
                mediaUrl: null,
                mediaFileName: mediaFile?.name || null,
                mediaType: mediaType || null,
            });

            resetForm();
            onClose();
        } catch (error) {
            console.error('❌ Error creating announcement:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    const catStyle = CATEGORY_STYLES[category];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ overflow: 'hidden' }}>
            {/* ── Backdrop ── */}
            <div
                className="absolute inset-0 backdrop-blur-md"
                style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
                onClick={onClose}
            />

            {/* ── Modal Container ── */}
            <div
                className="relative w-[90%] max-w-[850px] max-h-[85vh] bg-zinc-900 border border-zinc-700/50 rounded-2xl overflow-hidden"
                style={{
                    boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
                    animation: 'announcementModalIn 0.25s ease-out',
                }}
            >
                {/* ── Top Accent Bar ── */}
                <div className="h-1 w-full bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-500" />

                {/* ── Header ── */}
                <div className="flex items-center justify-between px-8 pt-6 pb-2">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/20 flex items-center justify-center">
                            <span className="text-lg">📢</span>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white tracking-tight">New Announcement</h2>
                            <p className="text-xs text-zinc-500 mt-0.5">Create a workspace announcement</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700/50 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 transition-all cursor-pointer"
                        aria-label="Close"
                    >
                        ✕
                    </button>
                </div>

                {/* ── Scrollable Content ── */}
                <div className="px-8 pb-6 pt-4 overflow-y-auto custom-scroll" style={{ maxHeight: '60vh' }}>
                    <div className="space-y-6">

                        {/* ═══ Title ═══ */}
                        <div>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Untitled Announcement"
                                className="w-full bg-transparent text-2xl font-bold text-white placeholder-zinc-600 outline-none border-none py-2 tracking-tight"
                                autoFocus
                            />
                            <div className="h-px bg-zinc-800 mt-1" />
                        </div>

                        {/* ═══ Description ═══ */}
                        <div>
                            <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                                Description
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={6}
                                placeholder="Write your announcement details here..."
                                className="w-full bg-zinc-800/50 border border-zinc-700/40 rounded-xl px-5 py-4 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all resize-none leading-relaxed"
                            />
                        </div>

                        {/* ═══ Date & Time Row ═══ */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Date */}
                            <div>
                                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                                    Event Date
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setShowDatePicker(true)}
                                    className="w-full bg-zinc-800/50 border border-zinc-700/40 rounded-xl px-4 py-3 text-left flex items-center gap-3 hover:border-zinc-600 transition-all cursor-pointer group"
                                >
                                    <span className="text-base opacity-60 group-hover:opacity-100 transition-opacity">📅</span>
                                    <span className={`text-sm ${eventDate ? 'text-white' : 'text-zinc-500'}`}>
                                        {eventDate
                                            ? new Date(eventDate + 'T00:00:00').toLocaleDateString('en-US', {
                                                weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
                                            })
                                            : 'Select date'
                                        }
                                    </span>
                                </button>
                            </div>

                            {/* Time */}
                            <div>
                                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                                    Event Time
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setShowTimePicker(true)}
                                    className="w-full bg-zinc-800/50 border border-zinc-700/40 rounded-xl px-4 py-3 text-left flex items-center gap-3 hover:border-zinc-600 transition-all cursor-pointer group"
                                >
                                    <span className="text-base opacity-60 group-hover:opacity-100 transition-opacity">🕐</span>
                                    <span className={`text-sm ${eventTime ? 'text-white' : 'text-zinc-500'}`}>
                                        {eventTime || 'Select time'}
                                    </span>
                                </button>
                            </div>
                        </div>

                        {/* ═══ Media Upload ═══ */}
                        <div>
                            <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                                Media
                            </label>

                            {!mediaPreview ? (
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full bg-zinc-800/30 border-2 border-dashed border-zinc-700/50 rounded-xl py-10 flex flex-col items-center gap-3 hover:border-purple-500/40 hover:bg-purple-500/5 transition-all cursor-pointer group"
                                >
                                    <div className="w-12 h-12 rounded-xl bg-zinc-800 border border-zinc-700/50 flex items-center justify-center group-hover:border-purple-500/30 transition-all">
                                        <svg className="w-6 h-6 text-zinc-500 group-hover:text-purple-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                                        </svg>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-sm text-zinc-400 group-hover:text-zinc-300 transition-colors">
                                            Click to upload image or video
                                        </p>
                                        <p className="text-xs text-zinc-600 mt-1">PNG, JPG, GIF, MP4, WebM</p>
                                    </div>
                                </button>
                            ) : (
                                <div className="relative rounded-xl overflow-hidden border border-zinc-700/40 bg-zinc-800/40">
                                    {mediaType === 'image' ? (
                                        <img
                                            src={mediaPreview}
                                            alt="Preview"
                                            className="w-full max-h-[300px] object-cover"
                                        />
                                    ) : (
                                        <video
                                            src={mediaPreview}
                                            controls
                                            className="w-full max-h-[300px] object-contain bg-black"
                                        />
                                    )}
                                    {/* Remove button */}
                                    <button
                                        type="button"
                                        onClick={removeMedia}
                                        className="absolute top-3 right-3 w-8 h-8 rounded-lg bg-black/70 backdrop-blur-sm border border-zinc-600/50 flex items-center justify-center text-zinc-300 hover:text-red-400 hover:border-red-500/30 transition-all cursor-pointer"
                                    >
                                        ✕
                                    </button>
                                    {/* File name badge */}
                                    <div className="absolute bottom-3 left-3 px-3 py-1.5 bg-black/70 backdrop-blur-sm rounded-lg border border-zinc-600/40">
                                        <p className="text-xs text-zinc-300 truncate max-w-[200px]">{mediaFile?.name}</p>
                                    </div>
                                </div>
                            )}

                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*,video/*"
                                onChange={handleMediaSelect}
                                className="hidden"
                            />
                        </div>

                        {/* ═══ Options Section ═══ */}
                        <div className="bg-zinc-800/30 border border-zinc-700/30 rounded-xl px-5 py-3 space-y-1">
                            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Options</p>

                            {/* Category */}
                            <div className="flex items-center justify-between py-2">
                                <div className="flex items-center gap-2.5">
                                    <span className="text-base">🏷️</span>
                                    <span className="text-sm text-zinc-300 font-medium">Category</span>
                                </div>
                                <div className="relative">
                                    <select
                                        value={category}
                                        onChange={(e) => setCategory(e.target.value)}
                                        className={`appearance-none text-xs font-semibold uppercase tracking-wider pl-5 pr-7 py-1.5 rounded-lg border cursor-pointer outline-none transition-all
                                            ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}
                                        style={{ backgroundImage: 'none' }}
                                    >
                                        <option value="general">General</option>
                                        <option value="event">Event</option>
                                        <option value="urgent">Urgent</option>
                                    </select>
                                    {/* Colored dot */}
                                    <span className={`absolute left-2 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full ${catStyle.dot}`} />
                                    {/* Dropdown arrow */}
                                    <svg className={`absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none ${catStyle.text}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                                    </svg>
                                </div>
                            </div>

                            <div className="h-px bg-zinc-700/30" />

                            {/* Pin Toggle */}
                            <ToggleSwitch
                                label="Pin Announcement"
                                icon="📌"
                                enabled={pinned}
                                onChange={setPinned}
                            />

                            <div className="h-px bg-zinc-700/30" />

                            {/* Notify All Toggle */}
                            <ToggleSwitch
                                label="Notify All Members"
                                icon="🔔"
                                enabled={notifyAll}
                                onChange={setNotifyAll}
                            />
                        </div>
                    </div>
                </div>

                {/* ── Footer Actions ── */}
                <div className="px-8 py-5 border-t border-zinc-800 bg-zinc-900/80 flex items-center justify-between">
                    <p className="text-xs text-zinc-600">
                        {title.trim() ? `"${title.trim().slice(0, 40)}${title.trim().length > 40 ? '…' : ''}"` : 'Untitled'}
                        {' · '}
                        <span className={`uppercase font-semibold ${catStyle.text}`}>{category}</span>
                    </p>
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => { resetForm(); onClose(); }}
                            disabled={isSubmitting}
                            className="px-5 py-2.5 rounded-xl text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 border border-transparent hover:border-zinc-700/50 transition-all cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={isSubmitting || !title.trim()}
                            className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none cursor-pointer flex items-center gap-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <span
                                        className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                                        style={{ animation: 'spin 0.7s linear infinite' }}
                                    />
                                    Publishing...
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                                    </svg>
                                    Publish
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Sub-modals (Date & Time pickers) ── */}
            {showDatePicker && (
                <DatePickerModal
                    value={eventDate}
                    onConfirm={(d) => { setEventDate(d); setShowDatePicker(false); }}
                    onClose={() => setShowDatePicker(false)}
                />
            )}

            {showTimePicker && (
                <TimePickerModal
                    value={eventTime}
                    onConfirm={(t) => { setEventTime(t); setShowTimePicker(false); }}
                    onClose={() => setShowTimePicker(false)}
                />
            )}

            {/* ── Keyframes ── */}
            <style>{`
                @keyframes announcementModalIn {
                    from { opacity: 0; transform: scale(0.95); }
                    to   { opacity: 1; transform: scale(1);    }
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default AnnouncementForm;
