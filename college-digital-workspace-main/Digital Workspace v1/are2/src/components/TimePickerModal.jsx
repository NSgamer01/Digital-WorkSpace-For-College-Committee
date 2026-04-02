import React, { useState, useRef, useEffect, useCallback } from 'react';

const ITEM_HEIGHT = 40;
const VISIBLE_COUNT = 5;

const pad = (n) => String(n).padStart(2, '0');

// 12-hour display values: 12, 1, 2, ... 11
const hours12 = Array.from({ length: 12 }, (_, i) => (i === 0 ? 12 : i));
const minutes = Array.from({ length: 60 }, (_, i) => i);

/* ─── Helpers ───────────────────────────────────────────────── */
function to12Hour(h24) {
    const h = h24 % 12 || 12;
    return h;
}

function to24Hour(h12, period) {
    let h = h12;
    if (period === 'PM' && h !== 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    return h;
}

/* ─── Scroll Column ─────────────────────────────────────────── */
const ScrollColumn = ({ items, selected, onSelect, formatFn }) => {
    const listRef = useRef(null);
    const isUserScrolling = useRef(false);
    const scrollTimeout = useRef(null);
    const selectedIndex = items.indexOf(selected);

    useEffect(() => {
        if (listRef.current && !isUserScrolling.current && selectedIndex >= 0) {
            listRef.current.scrollTo({
                top: selectedIndex * ITEM_HEIGHT,
                behavior: 'smooth',
            });
        }
    }, [selectedIndex]);

    const handleScroll = useCallback(() => {
        isUserScrolling.current = true;
        clearTimeout(scrollTimeout.current);

        scrollTimeout.current = setTimeout(() => {
            if (!listRef.current) return;
            const scrollTop = listRef.current.scrollTop;
            const index = Math.round(scrollTop / ITEM_HEIGHT);
            const clamped = Math.max(0, Math.min(index, items.length - 1));

            listRef.current.scrollTo({
                top: clamped * ITEM_HEIGHT,
                behavior: 'smooth',
            });

            if (items[clamped] !== selected) {
                onSelect(items[clamped]);
            }
            isUserScrolling.current = false;
        }, 80);
    }, [items, selected, onSelect]);

    const display = formatFn || pad;

    return (
        <div className="relative" style={{ height: ITEM_HEIGHT * VISIBLE_COUNT }}>
            {/* Center highlight */}
            <div
                className="absolute left-0 right-0 pointer-events-none z-10 rounded-lg"
                style={{
                    top: ITEM_HEIGHT * 2,
                    height: ITEM_HEIGHT,
                    background: 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(139,92,246,0.25))',
                    border: '1px solid rgba(139,92,246,0.35)',
                    boxShadow: '0 0 12px rgba(139,92,246,0.15)',
                }}
            />

            {/* Fade overlays */}
            <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-zinc-900 to-transparent z-20 pointer-events-none" />
            <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-zinc-900 to-transparent z-20 pointer-events-none" />

            {/* Scrollable list */}
            <div
                ref={listRef}
                onScroll={handleScroll}
                className="h-full overflow-y-auto"
                style={{
                    scrollSnapType: 'y mandatory',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                }}
            >
                <style>{`.time-scroll::-webkit-scrollbar { display: none; }`}</style>
                <div style={{ height: ITEM_HEIGHT * 2 }} />
                {items.map((val) => {
                    const isSelected = val === selected;
                    return (
                        <div
                            key={val}
                            onClick={() => {
                                const idx = items.indexOf(val);
                                onSelect(val);
                                listRef.current?.scrollTo({
                                    top: idx * ITEM_HEIGHT,
                                    behavior: 'smooth',
                                });
                            }}
                            className={`flex items-center justify-center cursor-pointer transition-all duration-150 select-none ${isSelected
                                ? 'text-white font-bold text-xl'
                                : 'text-zinc-500 hover:text-zinc-300 text-base'
                                }`}
                            style={{
                                height: ITEM_HEIGHT,
                                scrollSnapAlign: 'start',
                            }}
                        >
                            {display(val)}
                        </div>
                    );
                })}
                <div style={{ height: ITEM_HEIGHT * 2 }} />
            </div>
        </div>
    );
};

/* ─── Editable Center Value ─────────────────────────────────── */
const EditableValue = ({ value, max, onChange, displayValue }) => {
    const [editing, setEditing] = useState(false);
    const [inputVal, setInputVal] = useState('');
    const inputRef = useRef(null);

    useEffect(() => {
        if (editing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [editing]);

    const startEdit = () => {
        setInputVal(displayValue);
        setEditing(true);
    };

    const finishEdit = () => {
        setEditing(false);
        const num = parseInt(inputVal, 10);
        if (!isNaN(num) && num >= (max === 12 ? 1 : 0) && num <= max) {
            onChange(num);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') finishEdit();
        if (e.key === 'Escape') setEditing(false);
    };

    if (editing) {
        return (
            <input
                ref={inputRef}
                type="text"
                maxLength={2}
                value={inputVal}
                onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '');
                    setInputVal(v);
                }}
                onBlur={finishEdit}
                onKeyDown={handleKeyDown}
                className="w-12 text-center bg-transparent text-purple-400 text-3xl font-bold outline-none border-b-2 border-purple-500"
            />
        );
    }

    return (
        <span
            onClick={startEdit}
            className="text-purple-400 cursor-pointer hover:text-purple-300 transition-colors"
            title="Click to type"
        >
            {displayValue}
        </span>
    );
};

/* ─── Time Picker Modal ─────────────────────────────────────── */
const TimePickerModal = ({ value, onConfirm, onClose }) => {
    // Parse initial 24h value
    const initH24 = value ? parseInt(value.split(':')[0], 10) || 0 : new Date().getHours();
    const initMn = value ? parseInt(value.split(':')[1], 10) || 0 : new Date().getMinutes();

    const [hr12, setHr12] = useState(to12Hour(initH24));
    const [mn, setMn] = useState(initMn);
    const [period, setPeriod] = useState(initH24 >= 12 ? 'PM' : 'AM');

    // Close on Escape
    useEffect(() => {
        const handleKey = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [onClose]);

    const handleConfirm = () => {
        const h24 = to24Hour(hr12, period);
        onConfirm(`${pad(h24)}:${pad(mn)}`);
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Picker panel */}
            <div className="relative bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl shadow-purple-500/10 w-[300px] overflow-hidden animate-fade-in">
                {/* Header */}
                <div className="px-5 pt-5 pb-3 text-center">
                    <p className="text-zinc-400 text-xs uppercase tracking-wider font-semibold mb-2">Select Time</p>
                    <p className="text-3xl font-bold text-white tracking-wide flex items-center justify-center gap-1">
                        <EditableValue
                            value={hr12}
                            max={12}
                            onChange={setHr12}
                            displayValue={pad(hr12)}
                        />
                        <span className="text-zinc-500 mx-0.5">:</span>
                        <EditableValue
                            value={mn}
                            max={59}
                            onChange={setMn}
                            displayValue={pad(mn)}
                        />
                        <span className="text-lg text-zinc-400 font-semibold ml-2">{period}</span>
                    </p>
                </div>

                {/* Columns */}
                <div className="flex items-start justify-center gap-3 px-4 pb-2">
                    {/* Hours */}
                    <div className="flex-1">
                        <p className="text-center text-zinc-500 text-[10px] uppercase tracking-widest mb-1">Hr</p>
                        <ScrollColumn
                            items={hours12}
                            selected={hr12}
                            onSelect={setHr12}
                            formatFn={pad}
                        />
                    </div>

                    {/* Separator */}
                    <div className="text-2xl text-zinc-600 font-bold pt-20">:</div>

                    {/* Minutes */}
                    <div className="flex-1">
                        <p className="text-center text-zinc-500 text-[10px] uppercase tracking-widest mb-1">Min</p>
                        <ScrollColumn
                            items={minutes}
                            selected={mn}
                            onSelect={setMn}
                            formatFn={pad}
                        />
                    </div>
                </div>

                {/* AM / PM Toggle */}
                <div className="flex justify-center gap-3 px-4 pb-4">
                    <button
                        type="button"
                        onClick={() => setPeriod('AM')}
                        className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${period === 'AM'
                            ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-purple-500/20'
                            : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 border border-zinc-700'
                            }`}
                    >
                        AM
                    </button>
                    <button
                        type="button"
                        onClick={() => setPeriod('PM')}
                        className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${period === 'PM'
                            ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-purple-500/20'
                            : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 border border-zinc-700'
                            }`}
                    >
                        PM
                    </button>
                </div>

                {/* Buttons */}
                <div className="flex border-t border-zinc-800">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-3 text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all cursor-pointer"
                    >
                        Cancel
                    </button>
                    <div className="w-px bg-zinc-800" />
                    <button
                        type="button"
                        onClick={handleConfirm}
                        className="flex-1 py-3 text-sm font-medium text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 transition-all cursor-pointer"
                    >
                        OK
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TimePickerModal;
