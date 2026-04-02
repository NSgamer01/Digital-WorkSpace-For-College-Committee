import React, { useState, useRef, useCallback, useEffect } from 'react';
import SlashCommandMenu from './SlashCommandMenu';
import FormattingToolbar from './FormattingToolbar';

/* ── Helpers ──────────────────────────────────────────────────── */
const uid = () => Math.random().toString(36).slice(2, 10);
const createBlock = (type = 'paragraph', text = '', extra = {}) => ({
    id: uid(),
    type,
    text,
    checked: false,
    language: 'javascript',
    caption: '',
    url: '',
    ...extra,
});

/* ── Placeholders per type ────────────────────────────────────── */
const placeholders = {
    paragraph: "Type '/' for commands, or just start writing…",
    heading1: 'Heading 1',
    heading2: 'Heading 2',
    heading3: 'Heading 3',
    bullet: 'List item',
    numbered: 'List item',
    checkbox: 'To-do',
    quote: 'Write a quote…',
    code: 'Write code…',
    callout: 'Type something…',
};

/* ================================================================
   BlockEditor  –  Notion-style block editor
   ================================================================ */
const BlockEditor = ({ value = [], onChange, placeholder }) => {
    const [blocks, setBlocks] = useState(() => {
        if (value?.length) return value.map((b) => ({ ...createBlock(b.type, b.text), ...b, id: b.id || uid() }));
        return [createBlock()];
    });

    /* ── Slash menu state ──────────────────────────────────────── */
    const [slashMenu, setSlashMenu] = useState(null);

    /* ── Formatting toolbar state ──────────────────────────────── */
    const [toolbar, setToolbar] = useState({ visible: false, position: null });

    /* ── Drag state ────────────────────────────────────────────── */
    const [dragId, setDragId] = useState(null);
    const [dropIdx, setDropIdx] = useState(null);

    /* ── Refs ──────────────────────────────────────────────────── */
    const blockRefs = useRef({});
    const focusId = useRef(null);
    const containerRef = useRef(null);
    const textsRef = useRef({});  // Track live text per block without re-rendering
    const syncTimerRef = useRef(null);

    // Initialize textsRef from blocks
    useEffect(() => {
        blocks.forEach(b => { if (!(b.id in textsRef.current)) textsRef.current[b.id] = b.text; });
    }, [blocks]);

    /* ── Sync back to parent ──────────────────────────────────── */
    const sync = useCallback(
        (updated) => {
            // Defer to avoid "cannot update component during render" warning
            queueMicrotask(() => {
                onChange(
                    updated.map((b) => ({
                        id: b.id,
                        type: b.type,
                        text: textsRef.current[b.id] !== undefined ? textsRef.current[b.id] : b.text,
                        checked: b.checked,
                        language: b.language,
                        caption: b.caption,
                        url: b.url,
                    }))
                );
            });
        },
        [onChange]
    );

    /* ── Debounced text sync to parent (without re-rendering) ── */
    const scheduleSyncToParent = useCallback(() => {
        if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
        syncTimerRef.current = setTimeout(() => {
            setBlocks(prev => {
                // Merge ref texts into state silently and sync
                const updated = prev.map(b => ({ ...b, text: textsRef.current[b.id] !== undefined ? textsRef.current[b.id] : b.text }));
                sync(updated);
                return updated;
            });
        }, 800);
    }, [sync]);

    /* ── Focus management ─────────────────────────────────────── */
    useEffect(() => {
        if (!focusId.current) return;
        const el = blockRefs.current[focusId.current];
        if (!el) return;
        el.focus();
        // caret → end
        const range = document.createRange();
        const sel = window.getSelection();
        if (el.childNodes.length) {
            range.selectNodeContents(el);
            range.collapse(false);
        } else {
            range.setStart(el, 0);
        }
        sel.removeAllRanges();
        sel.addRange(range);
        focusId.current = null;
    });

    /* ── Selection change → show/hide toolbar ─────────────────── */
    useEffect(() => {
        const handle = () => {
            const sel = window.getSelection();
            if (!sel || sel.isCollapsed || !sel.rangeCount) {
                setToolbar({ visible: false, position: null });
                return;
            }
            // Only show if selection is inside our editor
            if (containerRef.current && !containerRef.current.contains(sel.anchorNode)) {
                setToolbar({ visible: false, position: null });
                return;
            }
            const range = sel.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            if (rect.width < 2) {
                setToolbar({ visible: false, position: null });
                return;
            }
            setToolbar({
                visible: true,
                position: { x: rect.left + rect.width / 2, y: rect.top },
            });
        };
        document.addEventListener('selectionchange', handle);
        return () => document.removeEventListener('selectionchange', handle);
    }, []);

    /* ── Keyboard shortcuts for formatting ────────────────────── */
    useEffect(() => {
        const handle = (e) => {
            if (!containerRef.current?.contains(document.activeElement)) return;
            const ctrl = e.ctrlKey || e.metaKey;
            if (ctrl && e.key === 'b') { e.preventDefault(); document.execCommand('bold'); }
            if (ctrl && e.key === 'i') { e.preventDefault(); document.execCommand('italic'); }
            if (ctrl && e.key === 'u') { e.preventDefault(); document.execCommand('underline'); }
            if (ctrl && e.key === 'e') {
                e.preventDefault();
                const sel = window.getSelection();
                if (sel && !sel.isCollapsed) {
                    const selectedText = sel.toString();
                    document.execCommand('insertHTML', false, `<code class="inline-code">${selectedText}</code>`);
                }
            }
            if (ctrl && e.key === 'k') {
                e.preventDefault();
                const sel = window.getSelection();
                if (sel && !sel.isCollapsed) {
                    setToolbar((prev) => ({ ...prev, visible: true }));
                }
            }
        };
        document.addEventListener('keydown', handle);
        return () => document.removeEventListener('keydown', handle);
    }, []);

    /* ── Block CRUD ────────────────────────────────────────────── */
    const updateBlock = (id, updates) => {
        setBlocks((prev) => {
            const next = prev.map((b) => (b.id === id ? { ...b, ...updates } : b));
            sync(next);
            return next;
        });
    };

    const insertAfter = (id, type = 'paragraph', text = '') => {
        const nb = createBlock(type, text);
        setBlocks((prev) => {
            const i = prev.findIndex((b) => b.id === id);
            const next = [...prev.slice(0, i + 1), nb, ...prev.slice(i + 1)];
            sync(next);
            return next;
        });
        focusId.current = nb.id;
        return nb;
    };

    const removeBlock = (id) => {
        setBlocks((prev) => {
            if (prev.length <= 1) return prev;
            const i = prev.findIndex((b) => b.id === id);
            const next = prev.filter((b) => b.id !== id);
            sync(next);
            focusId.current = next[Math.max(0, i - 1)]?.id;
            return next;
        });
    };

    /* ── Input handler (markdown shortcuts + slash) ───────────── */
    const handleInput = (e, block) => {
        const raw = e.currentTarget.innerText || '';

        // Markdown shortcuts (only if entire content matches)
        const shortcuts = [
            { pattern: /^# $/, type: 'heading1' },
            { pattern: /^## $/, type: 'heading2' },
            { pattern: /^### $/, type: 'heading3' },
            { pattern: /^[-*] $/, type: 'bullet' },
            { pattern: /^1\. $/, type: 'numbered' },
            { pattern: /^\[\] $|^\[ \] $/, type: 'checkbox' },
            { pattern: /^> $/, type: 'quote' },
            { pattern: /^---$/, type: 'divider' },
            { pattern: /^```$/, type: 'code' },
        ];
        for (const s of shortcuts) {
            if (s.pattern.test(raw)) {
                e.currentTarget.innerHTML = '';
                textsRef.current[block.id] = '';
                if (s.type === 'divider') {
                    updateBlock(block.id, { type: 'divider', text: '' });
                    insertAfter(block.id);
                } else {
                    updateBlock(block.id, { type: s.type, text: '' });
                    focusId.current = block.id;
                }
                return;
            }
        }

        // Slash command
        if (raw.startsWith('/')) {
            const rect = e.currentTarget.getBoundingClientRect();
            setSlashMenu({
                blockId: block.id,
                position: { x: rect.left, y: rect.bottom + 4 },
                filter: raw.slice(1),
            });
        } else if (slashMenu?.blockId === block.id) {
            setSlashMenu(null);
        }

        // Track text in ref only — do NOT call setBlocks (avoids re-render/cursor reset)
        textsRef.current[block.id] = e.currentTarget.innerHTML;
        scheduleSyncToParent();
    };

    /* ── Keydown handler ──────────────────────────────────────── */
    const handleKeyDown = (e, block) => {
        // If slash menu is open, let it handle arrow/enter/escape
        if (slashMenu && ['ArrowUp', 'ArrowDown', 'Enter', 'Escape'].includes(e.key)) return;

        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const inheritTypes = ['bullet', 'numbered', 'checkbox'];
            const nextType = inheritTypes.includes(block.type) ? block.type : 'paragraph';

            // If current block is empty list type, convert back to paragraph
            const rawText = blockRefs.current[block.id]?.innerText?.trim();
            if (!rawText && inheritTypes.includes(block.type)) {
                updateBlock(block.id, { type: 'paragraph', text: '' });
                if (blockRefs.current[block.id]) blockRefs.current[block.id].innerHTML = '';
                focusId.current = block.id;
                return;
            }

            insertAfter(block.id, nextType);
        }

        if (e.key === 'Backspace') {
            const rawText = blockRefs.current[block.id]?.innerText || '';
            if (!rawText && blocks.length > 1) {
                e.preventDefault();
                removeBlock(block.id);
            }
        }

        // Arrow navigation between blocks
        if (e.key === 'ArrowUp') {
            const i = blocks.findIndex((b) => b.id === block.id);
            if (i > 0 && isCaretAtStart(blockRefs.current[block.id])) {
                e.preventDefault();
                focusId.current = blocks[i - 1].id;
            }
        }
        if (e.key === 'ArrowDown') {
            const i = blocks.findIndex((b) => b.id === block.id);
            if (i < blocks.length - 1 && isCaretAtEnd(blockRefs.current[block.id])) {
                e.preventDefault();
                focusId.current = blocks[i + 1].id;
            }
        }

        // Tab indent (just adds padding/nesting visual for now)
        if (e.key === 'Tab') {
            e.preventDefault();
            if (block.type === 'code') {
                document.execCommand('insertText', false, '  ');
            }
        }
    };

    /* ── Slash command select ─────────────────────────────────── */
    const handleSlashSelect = (type) => {
        if (!slashMenu) return;
        const { blockId } = slashMenu;
        const el = blockRefs.current[blockId];

        if (type === 'image') {
            // Trigger file input
            updateBlock(blockId, { type: 'image', text: '', url: '' });
            if (el) el.innerHTML = '';
            setSlashMenu(null);
            return;
        }

        if (type === 'divider') {
            updateBlock(blockId, { type: 'divider', text: '' });
            if (el) el.innerHTML = '';
            insertAfter(blockId);
            setSlashMenu(null);
            return;
        }

        updateBlock(blockId, { type, text: '' });
        if (el) el.innerHTML = '';
        focusId.current = blockId;
        setSlashMenu(null);
    };

    /* ── Formatting handler ───────────────────────────────────── */
    const handleFormat = (command, value) => {
        document.execCommand(command, false, value || null);
    };

    /* ── Drag & drop ──────────────────────────────────────────── */
    const handleDragStart = (e, block) => {
        setDragId(block.id);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', block.id);
    };

    const handleDragOver = (e, idx) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDropIdx(idx);
    };

    const handleDrop = (e, targetIdx) => {
        e.preventDefault();
        if (!dragId) return;
        setBlocks((prev) => {
            const fromIdx = prev.findIndex((b) => b.id === dragId);
            if (fromIdx === -1 || fromIdx === targetIdx) return prev;
            const item = prev[fromIdx];
            const without = prev.filter((b) => b.id !== dragId);
            const adjustedIdx = targetIdx > fromIdx ? targetIdx - 1 : targetIdx;
            const next = [...without.slice(0, adjustedIdx), item, ...without.slice(adjustedIdx)];
            sync(next);
            return next;
        });
        setDragId(null);
        setDropIdx(null);
    };

    const handleDragEnd = () => {
        setDragId(null);
        setDropIdx(null);
    };

    /* ── Image upload ─────────────────────────────────────────── */
    const handleImageUpload = (blockId) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                updateBlock(blockId, { url: ev.target.result });
            };
            reader.readAsDataURL(file);
        };
        input.click();
    };

    /* ── Render: block style ──────────────────────────────────── */
    const getBlockStyle = (type) => {
        const base = {
            outline: 'none',
            width: '100%',
            minHeight: 22,
            padding: '3px 2px',
            color: 'rgba(255,255,255,0.9)',
            lineHeight: 1.65,
            wordBreak: 'break-word',
            caretColor: '#6366f1',
        };
        switch (type) {
            case 'heading1':
                return { ...base, fontSize: 30, fontWeight: 700, marginTop: 16, marginBottom: 4, letterSpacing: '-0.02em' };
            case 'heading2':
                return { ...base, fontSize: 24, fontWeight: 700, marginTop: 12, marginBottom: 2 };
            case 'heading3':
                return { ...base, fontSize: 19, fontWeight: 600, marginTop: 10, marginBottom: 2 };
            case 'code':
                return {
                    ...base,
                    fontFamily: '"Fira Code", "JetBrains Mono", "Cascadia Code", monospace',
                    fontSize: 13,
                    background: 'rgba(255,255,255,0.03)',
                    padding: '14px 18px',
                    borderRadius: 10,
                    border: '1px solid rgba(255,255,255,0.06)',
                    whiteSpace: 'pre-wrap',
                    tabSize: 2,
                    lineHeight: 1.7,
                };
            case 'quote':
                return {
                    ...base,
                    borderLeft: '3px solid #6366f1',
                    paddingLeft: 18,
                    color: 'rgba(255,255,255,0.55)',
                    fontStyle: 'italic',
                    fontSize: 15,
                };
            case 'callout':
                return {
                    ...base,
                    background: 'rgba(99,102,241,0.08)',
                    borderRadius: 10,
                    padding: '12px 16px',
                    border: '1px solid rgba(99,102,241,0.15)',
                };
            default:
                return { ...base, fontSize: 15 };
        }
    };

    /* ── Render: prefix icon/marker ───────────────────────────── */
    const getPrefix = (block, idx) => {
        switch (block.type) {
            case 'bullet':
                return (
                    <span style={{ color: '#6366f1', marginRight: 10, userSelect: 'none', fontSize: 18, lineHeight: '24px', flexShrink: 0 }}>
                        •
                    </span>
                );
            case 'numbered': {
                let n = 1;
                for (let i = idx - 1; i >= 0 && blocks[i].type === 'numbered'; i--) n++;
                return (
                    <span style={{ color: 'rgba(255,255,255,0.4)', marginRight: 10, fontSize: 14, userSelect: 'none', minWidth: 20, textAlign: 'right', flexShrink: 0, fontWeight: 500 }}>
                        {n}.
                    </span>
                );
            }
            case 'checkbox':
                return (
                    <button
                        onClick={() => updateBlock(block.id, { checked: !block.checked })}
                        style={{
                            width: 18,
                            height: 18,
                            borderRadius: 4,
                            marginRight: 10,
                            flexShrink: 0,
                            marginTop: 3,
                            background: block.checked ? '#6366f1' : 'transparent',
                            border: block.checked ? 'none' : '2px solid rgba(255,255,255,0.25)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontSize: 11,
                            transition: 'all 0.15s',
                        }}
                    >
                        {block.checked && '✓'}
                    </button>
                );
            case 'callout':
                return (
                    <span style={{ fontSize: 20, marginRight: 10, userSelect: 'none', flexShrink: 0 }}>💡</span>
                );
            default:
                return null;
        }
    };

    /* ── Render: individual block ──────────────────────────────── */
    const renderBlock = (block, idx) => {
        const isDragOver = dropIdx === idx;

        /* ── Divider ──────────────────────────────────────────── */
        if (block.type === 'divider') {
            return (
                <div
                    key={block.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, block)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDrop={(e) => handleDrop(e, idx)}
                    onDragEnd={handleDragEnd}
                    className="editor-block-wrapper"
                    style={{ padding: '10px 0', position: 'relative' }}
                >
                    {isDragOver && <div className="drop-indicator" />}
                    <div className="drag-handle-zone">
                        <span className="drag-handle" title="Drag to move">⋮⋮</span>
                    </div>
                    <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.08)', margin: 0 }} />
                </div>
            );
        }

        /* ── Image ────────────────────────────────────────────── */
        if (block.type === 'image') {
            return (
                <div
                    key={block.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, block)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDrop={(e) => handleDrop(e, idx)}
                    onDragEnd={handleDragEnd}
                    className="editor-block-wrapper"
                    style={{ position: 'relative', padding: '8px 0' }}
                >
                    {isDragOver && <div className="drop-indicator" />}
                    <div className="drag-handle-zone">
                        <span className="drag-handle" title="Drag to move">⋮⋮</span>
                    </div>
                    {block.url ? (
                        <div className="image-block-container">
                            <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
                                <img
                                    src={block.url}
                                    alt={block.caption || 'Image'}
                                    style={{
                                        maxWidth: '100%',
                                        borderRadius: 10,
                                        border: '1px solid rgba(255,255,255,0.06)',
                                    }}
                                />
                                <button
                                    onClick={() => removeBlock(block.id)}
                                    className="image-delete-btn"
                                    style={{
                                        position: 'absolute',
                                        top: 8,
                                        right: 8,
                                        width: 28,
                                        height: 28,
                                        borderRadius: 6,
                                        background: 'rgba(0,0,0,0.7)',
                                        border: 'none',
                                        color: 'white',
                                        fontSize: 14,
                                        cursor: 'pointer',
                                        opacity: 0,
                                        transition: 'opacity 0.15s',
                                    }}
                                >
                                    🗑
                                </button>
                            </div>
                            <input
                                value={block.caption}
                                onChange={(e) => updateBlock(block.id, { caption: e.target.value })}
                                placeholder="Add caption…"
                                style={{
                                    display: 'block',
                                    width: '100%',
                                    marginTop: 6,
                                    background: 'none',
                                    border: 'none',
                                    color: 'rgba(255,255,255,0.4)',
                                    fontSize: 13,
                                    textAlign: 'center',
                                    outline: 'none',
                                }}
                            />
                        </div>
                    ) : (
                        <button
                            onClick={() => handleImageUpload(block.id)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 8,
                                width: '100%',
                                padding: '28px 20px',
                                background: 'rgba(255,255,255,0.02)',
                                border: '2px dashed rgba(255,255,255,0.1)',
                                borderRadius: 12,
                                color: 'rgba(255,255,255,0.35)',
                                fontSize: 14,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)';
                                e.currentTarget.style.background = 'rgba(99,102,241,0.04)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                                e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                            }}
                        >
                            🖼️ Click to upload image
                        </button>
                    )}
                </div>
            );
        }

        /* ── Code block header ────────────────────────────────── */
        const codeHeader =
            block.type === 'code' ? (
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 2,
                    }}
                >
                    <select
                        value={block.language || 'javascript'}
                        onChange={(e) => updateBlock(block.id, { language: e.target.value })}
                        style={{
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: 6,
                            padding: '3px 8px',
                            color: 'rgba(255,255,255,0.5)',
                            fontSize: 11,
                            outline: 'none',
                            cursor: 'pointer',
                        }}
                    >
                        {['javascript', 'python', 'html', 'css', 'java', 'c', 'cpp', 'json', 'bash', 'sql', 'typescript', 'jsx', 'plain'].map((l) => (
                            <option key={l} value={l}>{l}</option>
                        ))}
                    </select>
                    <button
                        onClick={() => {
                            const text = blockRefs.current[block.id]?.innerText || '';
                            navigator.clipboard.writeText(text);
                        }}
                        style={{
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: 6,
                            padding: '3px 10px',
                            color: 'rgba(255,255,255,0.4)',
                            fontSize: 11,
                            cursor: 'pointer',
                        }}
                    >
                        Copy
                    </button>
                </div>
            ) : null;

        /* ── Standard editable block ──────────────────────────── */
        return (
            <div
                key={block.id}
                draggable
                onDragStart={(e) => handleDragStart(e, block)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={(e) => handleDrop(e, idx)}
                onDragEnd={handleDragEnd}
                className="editor-block-wrapper"
                style={{
                    position: 'relative',
                    opacity: dragId === block.id ? 0.4 : 1,
                }}
            >
                {isDragOver && <div className="drop-indicator" />}

                {/* Drag handle */}
                <div className="drag-handle-zone">
                    <span className="drag-handle" title="Drag to move">⋮⋮</span>
                </div>

                {codeHeader}

                <div
                    className="editor-block"
                    style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        borderRadius: 6,
                        padding: '2px 4px',
                        marginLeft: ['bullet', 'numbered', 'checkbox'].includes(block.type) ? 12 : 0,
                        transition: 'background 0.12s',
                    }}
                >
                    {getPrefix(block, idx)}
                    <div
                        ref={(el) => {
                            blockRefs.current[block.id] = el;
                            // Set innerHTML ONLY on first mount — never on re-renders
                            if (el && !el.dataset.initialized) {
                                el.innerHTML = block.text || '';
                                el.dataset.initialized = 'true';
                            }
                        }}
                        contentEditable
                        suppressContentEditableWarning
                        data-placeholder={placeholders[block.type] || placeholder || "Type '/' for commands…"}
                        style={{
                            ...getBlockStyle(block.type),
                            textDecoration: block.type === 'checkbox' && block.checked ? 'line-through' : 'none',
                            opacity: block.type === 'checkbox' && block.checked ? 0.45 : 1,
                        }}
                        onInput={(e) => handleInput(e, block)}
                        onKeyDown={(e) => handleKeyDown(e, block)}
                        onFocus={() => {
                            if (slashMenu && slashMenu.blockId !== block.id) setSlashMenu(null);
                        }}
                        onPaste={(e) => {
                            // Paste as plain text in most blocks, preserve in code
                            if (block.type !== 'code') {
                                // Allow rich paste, browser handles inline formatting
                            }
                        }}
                    />
                </div>
            </div>
        );
    };

    /* ── Paste image handler (global) ─────────────────────────── */
    useEffect(() => {
        const handle = (e) => {
            if (!containerRef.current?.contains(document.activeElement)) return;
            const items = e.clipboardData?.items;
            if (!items) return;
            for (const item of items) {
                if (item.type.startsWith('image/')) {
                    e.preventDefault();
                    const file = item.getAsFile();
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        // Insert image block after current focused block
                        const sel = window.getSelection();
                        let afterId = blocks[blocks.length - 1]?.id;
                        if (sel?.anchorNode) {
                            const focused = blocks.find((b) => blockRefs.current[b.id]?.contains(sel.anchorNode));
                            if (focused) afterId = focused.id;
                        }
                        const nb = createBlock('image', '', { url: ev.target.result });
                        setBlocks((prev) => {
                            const i = prev.findIndex((b) => b.id === afterId);
                            const next = [...prev.slice(0, i + 1), nb, ...prev.slice(i + 1)];
                            sync(next);
                            return next;
                        });
                    };
                    reader.readAsDataURL(file);
                    break;
                }
            }
        };
        document.addEventListener('paste', handle);
        return () => document.removeEventListener('paste', handle);
    }, [blocks, sync]);

    /* ── Render ────────────────────────────────────────────────── */
    return (
        <div className="block-editor" ref={containerRef} style={{ position: 'relative' }}>
            {blocks.map((block, idx) => renderBlock(block, idx))}

            {/* Slash command menu */}
            {slashMenu && (
                <SlashCommandMenu
                    position={slashMenu.position}
                    filter={slashMenu.filter}
                    onSelect={handleSlashSelect}
                    onClose={() => setSlashMenu(null)}
                />
            )}

            {/* Formatting toolbar */}
            <FormattingToolbar
                position={toolbar.position}
                visible={toolbar.visible}
                onFormat={handleFormat}
            />
        </div>
    );
};

/* ── Utility: caret position checks ───────────────────────────── */
function isCaretAtStart(el) {
    const sel = window.getSelection();
    if (!sel?.rangeCount) return false;
    const range = sel.getRangeAt(0);
    return range.startOffset === 0 && (range.startContainer === el || range.startContainer === el.firstChild);
}
function isCaretAtEnd(el) {
    const sel = window.getSelection();
    if (!sel?.rangeCount) return false;
    const range = sel.getRangeAt(0);
    const node = range.endContainer;
    const offset = range.endOffset;
    if (node === el) return offset >= el.childNodes.length;
    if (node.nodeType === 3) return offset >= node.textContent.length && node === (el.lastChild || el);
    return false;
}

export default BlockEditor;
