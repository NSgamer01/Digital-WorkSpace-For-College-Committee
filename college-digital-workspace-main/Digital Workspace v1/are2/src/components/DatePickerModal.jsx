import React, { useState, useEffect, useMemo } from 'react';

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

const pad = (n) => String(n).padStart(2, '0');

/* ─── Format helpers ────────────────────────────────────────── */
function formatDisplay(dateStr) {
    if (!dateStr) return '';
    const d = dateStr.includes('T') ? new Date(dateStr) : new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function toYMD(year, month, day) {
    return `${year}-${pad(month + 1)}-${pad(day)}`;
}

/* ─── Date Picker Modal ─────────────────────────────────────── */
const DatePickerModal = ({ value, onConfirm, onClose, minDate }) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayStr = toYMD(today.getFullYear(), today.getMonth(), today.getDate());
    const minStr = minDate || todayStr;

    // Parse initial value or default to today
    let initDate = value ? (value.includes('T') ? new Date(value) : new Date(value + 'T00:00:00')) : today;
    // Guard against invalid date fallback
    if (isNaN(initDate.getTime())) { initDate = new Date(today); }

    const [viewYear, setViewYear] = useState(initDate.getFullYear());
    const [viewMonth, setViewMonth] = useState(initDate.getMonth());
    const [selectedDate, setSelectedDate] = useState(
        value || todayStr
    );

    // Close on Escape
    useEffect(() => {
        const handleKey = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [onClose]);

    // Build calendar grid
    const calendarDays = useMemo(() => {
        const firstDay = new Date(viewYear, viewMonth, 1).getDay();
        const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
        const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

        const cells = [];

        // Previous month trailing days
        for (let i = firstDay - 1; i >= 0; i--) {
            cells.push({ day: daysInPrevMonth - i, type: 'prev' });
        }

        // Current month days
        for (let d = 1; d <= daysInMonth; d++) {
            cells.push({ day: d, type: 'current' });
        }

        // Next month leading days
        const remaining = 42 - cells.length;
        for (let d = 1; d <= remaining; d++) {
            cells.push({ day: d, type: 'next' });
        }

        return cells;
    }, [viewYear, viewMonth]);

    const prevMonth = () => {
        if (viewMonth === 0) {
            setViewMonth(11);
            setViewYear((y) => y - 1);
        } else {
            setViewMonth((m) => m - 1);
        }
    };

    const nextMonth = () => {
        if (viewMonth === 11) {
            setViewMonth(0);
            setViewYear((y) => y + 1);
        } else {
            setViewMonth((m) => m + 1);
        }
    };

    const goToToday = () => {
        setViewYear(today.getFullYear());
        setViewMonth(today.getMonth());
        setSelectedDate(todayStr);
    };

    const handleDayClick = (cell) => {
        let year = viewYear;
        let month = viewMonth;

        if (cell.type === 'prev') {
            month = month === 0 ? 11 : month - 1;
            year = viewMonth === 0 ? viewYear - 1 : viewYear;
        } else if (cell.type === 'next') {
            month = month === 11 ? 0 : month + 1;
            year = viewMonth === 11 ? viewYear + 1 : viewYear;
        }

        const dateStr = toYMD(year, month, cell.day);
        if (dateStr < minStr) return;

        onConfirm(dateStr);
    };

    const isDisabled = (cell) => {
        let year = viewYear;
        let month = viewMonth;

        if (cell.type === 'prev') {
            month = month === 0 ? 11 : month - 1;
            year = viewMonth === 0 ? viewYear - 1 : viewYear;
        } else if (cell.type === 'next') {
            month = month === 11 ? 0 : month + 1;
            year = viewMonth === 11 ? viewYear + 1 : viewYear;
        }

        return toYMD(year, month, cell.day) < minStr;
    };

    const isSelected = (cell) => {
        let year = viewYear;
        let month = viewMonth;

        if (cell.type === 'prev') {
            month = month === 0 ? 11 : month - 1;
            year = viewMonth === 0 ? viewYear - 1 : viewYear;
        } else if (cell.type === 'next') {
            month = month === 11 ? 0 : month + 1;
            year = viewMonth === 11 ? viewYear + 1 : viewYear;
        }

        return toYMD(year, month, cell.day) === selectedDate;
    };

    const isToday = (cell) => {
        if (cell.type !== 'current') return false;
        return toYMD(viewYear, viewMonth, cell.day) === todayStr;
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Panel */}
            <div className="relative bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl shadow-purple-500/10 w-[320px] overflow-hidden animate-fade-in">
                {/* Header — date preview */}
                <div className="px-5 pt-5 pb-3 text-center">
                    <p className="text-zinc-400 text-xs uppercase tracking-wider font-semibold mb-2">Select Date</p>
                    <p className="text-2xl font-bold text-purple-400 tracking-wide">
                        {formatDisplay(selectedDate)}
                    </p>
                </div>

                {/* Month / Year navigation */}
                <div className="flex items-center justify-between px-4 pb-2">
                    <button
                        type="button"
                        onClick={prevMonth}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all cursor-pointer text-lg"
                    >
                        ‹
                    </button>
                    <span className="text-sm font-semibold text-white">
                        {MONTHS[viewMonth]} {viewYear}
                    </span>
                    <button
                        type="button"
                        onClick={nextMonth}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all cursor-pointer text-lg"
                    >
                        ›
                    </button>
                </div>

                {/* Day headers */}
                <div className="grid grid-cols-7 px-4 pb-1">
                    {DAYS.map((d) => (
                        <div key={d} className="text-center text-[10px] font-semibold text-zinc-500 uppercase tracking-wider py-1">
                            {d}
                        </div>
                    ))}
                </div>

                {/* Calendar grid */}
                <div className="grid grid-cols-7 px-4 pb-3 gap-y-0.5">
                    {calendarDays.map((cell, i) => {
                        const disabled = isDisabled(cell);
                        const selected = isSelected(cell);
                        const todayCell = isToday(cell);
                        const other = cell.type !== 'current';

                        return (
                            <button
                                type="button"
                                key={i}
                                disabled={disabled}
                                onClick={() => handleDayClick(cell)}
                                className={`
                                    w-9 h-9 mx-auto flex items-center justify-center rounded-lg text-sm transition-all cursor-pointer
                                    ${disabled
                                        ? 'text-zinc-700 cursor-not-allowed'
                                        : selected
                                            ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold shadow-lg shadow-purple-500/25'
                                            : todayCell
                                                ? 'text-purple-400 font-bold ring-1 ring-purple-500/40'
                                                : other
                                                    ? 'text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800'
                                                    : 'text-zinc-300 hover:text-white hover:bg-zinc-800'
                                    }
                                `}
                            >
                                {cell.day}
                            </button>
                        );
                    })}
                </div>

                {/* Today shortcut */}
                <div className="flex justify-center pb-3">
                    <button
                        type="button"
                        onClick={goToToday}
                        className="text-xs text-purple-400 hover:text-purple-300 font-medium transition-colors cursor-pointer px-3 py-1 rounded-md hover:bg-purple-500/10"
                    >
                        Today
                    </button>
                </div>

                {/* Action buttons */}
                <div className="flex border-t border-zinc-800">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-3 text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all cursor-pointer"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DatePickerModal;
