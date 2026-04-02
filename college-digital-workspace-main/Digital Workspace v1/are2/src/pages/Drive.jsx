import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast, { Toaster } from 'react-hot-toast';
import {
    Folder, FolderPlus, Upload, UploadCloud, Search, Grid3X3, List,
    ChevronRight, Star, Trash2, Clock, Home, MoreVertical, Download,
    X, Check, FileText, Image, Video, Music, Archive,
    Code, File, Sheet, ChevronLeft, RefreshCw, SlidersHorizontal,
    ArrowUpDown, CheckSquare, Square, FolderOpen, Eye,
    Presentation, StarOff, RotateCcw, HardDrive, AlertTriangle,
    ChevronDown, Palette, Share2,
} from 'lucide-react';
import useDrive from '../hooks/useDrive';
import api from '../utils/api';
import './Drive.css';

// ── File type helpers ───────────────────────────────────────────────
const EXT_CATEGORIES = {
    pdf: 'pdf', doc: 'document', docx: 'document', odt: 'document', rtf: 'document', txt: 'document', md: 'document',
    xls: 'spreadsheet', xlsx: 'spreadsheet', csv: 'spreadsheet', ods: 'spreadsheet',
    ppt: 'presentation', pptx: 'presentation', odp: 'presentation',
    jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', webp: 'image', svg: 'image', bmp: 'image',
    mp4: 'video', webm: 'video', mov: 'video', avi: 'video', mkv: 'video',
    mp3: 'audio', wav: 'audio', ogg: 'audio', flac: 'audio', aac: 'audio',
    zip: 'archive', rar: 'archive', '7z': 'archive', tar: 'archive', gz: 'archive',
    js: 'code', jsx: 'code', ts: 'code', tsx: 'code', py: 'code', java: 'code', cpp: 'code', c: 'code', html: 'code', css: 'code', json: 'code',
};

const getExtension = (name) => (name || '').split('.').pop().toLowerCase();

const getCategoryFromMime = (mimeType) => {
    if (!mimeType) return 'other';
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType === 'application/pdf') return 'pdf';
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'spreadsheet';
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'presentation';
    if (mimeType.includes('document') || mimeType.includes('word') || mimeType === 'text/plain') return 'document';
    if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('gzip')) return 'archive';
    if (mimeType.includes('javascript') || mimeType.includes('json') || mimeType === 'text/html' || mimeType === 'text/css') return 'code';
    return 'other';
};

const getCategory = (item) => {
    if (item.isFolder) return 'folder';
    const ext = getExtension(item.name);
    return EXT_CATEGORIES[ext] || getCategoryFromMime(item.mime_type) || 'other';
};

const CATEGORY_STYLE = {
    pdf: { Icon: FileText, color: '#ef4444' },
    document: { Icon: FileText, color: '#3b82f6' },
    spreadsheet: { Icon: Sheet, color: '#22c55e' },
    presentation: { Icon: Presentation, color: '#f97316' },
    image: { Icon: Image, color: '#a855f7' },
    video: { Icon: Video, color: '#ec4899' },
    audio: { Icon: Music, color: '#14b8a6' },
    archive: { Icon: Archive, color: '#eab308' },
    code: { Icon: Code, color: '#6b7280' },
    other: { Icon: File, color: '#6b7280' },
    folder: { Icon: Folder, color: '#6366f1' },
};

const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const s = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${s[i]}`;
};

const relDate = (d) => {
    if (!d) return '';
    const date = new Date(d);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// ── Folder colors for picker ────────────────────────────────────────
const FOLDER_COLORS = [
    '#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#ef4444',
    '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6',
    '#6b7280', '#a3a3a3',
];

// ── Folder icons for picker ─────────────────────────────────────────
const FOLDER_ICONS = ['📁', '📂', '📦', '🎨', '🎵', '📷', '🎬', '📝', '💼', '🔬', '📚', '🎮', '⭐', '❤️', '🚀', '💡'];

// ── Recursive FolderTree node ───────────────────────────────────────
const FolderTreeNode = ({ folder, allFolders, currentFolder, onNavigate, depth = 0 }) => {
    const [expanded, setExpanded] = useState(false);
    const children = allFolders.filter(f => f.parent_id === folder.id);
    const isActive = currentFolder === folder.id;

    return (
        <div>
            <button
                onClick={() => onNavigate(folder.id)}
                className={`w-full flex items-center gap-1.5 py-1 px-2 rounded-md text-xs transition-all cursor-pointer
                    ${isActive ? 'bg-indigo-600/20 text-indigo-400' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}
                style={{ paddingLeft: `${8 + depth * 14}px` }}>
                {children.length > 0 ? (
                    <button onClick={(e) => { e.stopPropagation(); setExpanded(p => !p); }} className="p-0.5 cursor-pointer">
                        <ChevronRight size={10} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
                    </button>
                ) : <span className="w-4" />}
                <span style={{ fontSize: '11px' }}>{folder.icon || '📁'}</span>
                <span className="truncate flex-1 text-left">{folder.name}</span>
            </button>
            {expanded && children.map(child => (
                <FolderTreeNode key={child.id} folder={child} allFolders={allFolders}
                    currentFolder={currentFolder} onNavigate={onNavigate} depth={depth + 1} />
            ))}
        </div>
    );
};

// ═════════════════════════════════════════════════════════════════════
//  DRIVE COMPONENT
// ═════════════════════════════════════════════════════════════════════
const Drive = () => {
    const drive = useDrive();
    const {
        files, folders, loading, error,
        currentFolder, folderPath, currentView,
        view, sortBy, sortOrder, searchQuery,
        selectedFiles: selected, previewFile, uploadQueue, uploading,
        storageInfo, contextMenu, dragOver,
        showCreateFolder: showNewFolder,
        fetchFiles, openFolder, goBack, goToBreadcrumb, switchView,
        uploadFiles, createFolder, deleteItem, restoreItem,
        renameItem, moveItem, starItem, downloadFile, emptyTrash,
        selectFile: toggleSelect, selectAll, clearSelection, clearError,
        handleSearch, handleSort,
        handleDragEnter, handleDragLeave, handleDragOver: onDragOver, handleDrop: onDrop,
        setView, setPreviewFile, setContextMenu,
        setShowCreateFolder: setShowNewFolder, setSearchQuery,
    } = drive;

    const fileInputRef = useRef(null);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [newFolderName, setNewFolderName] = useState('');
    const [confirmDelete, setConfirmDelete] = useState(null);
    const lastSelectedRef = useRef(null);
    const [dragItem, setDragItem] = useState(null);
    const [dropTargetFolder, setDropTargetFolder] = useState(null);
    const [folderTree, setFolderTree] = useState([]);
    const [showColorPicker, setShowColorPicker] = useState(null); // folderId
    const [showIconPicker, setShowIconPicker] = useState(null); // folderId

    // ── Folder customizations from localStorage ──────────────
    const [folderCustomizations, setFolderCustomizations] = useState(() => {
        try { return JSON.parse(localStorage.getItem('folderCustomizations') || '{}'); }
        catch { return {}; }
    });
    // Re-read localStorage whenever picker closes or files refresh
    useEffect(() => {
        try { setFolderCustomizations(JSON.parse(localStorage.getItem('folderCustomizations') || '{}')); }
        catch { /* ignore */ }
    }, [files, folders, showColorPicker, showIconPicker]);

    const getFolderCustom = (folderId) => folderCustomizations[folderId] || {};

    // ── Fetch folder tree for sidebar ─────────────────────────
    useEffect(() => {
        const loadTree = async () => {
            try {
                const data = await api.get('/api/drive/folders');
                setFolderTree(data.folders || []);
            } catch (e) {
                console.error('Folder tree error:', e);
            }
        };
        loadTree();
    }, [files, folders]); // refresh when files/folders change

    // ── Item drag-and-drop (to move into folders) ─────────
    const handleItemDragStart = (e, item) => {
        e.stopPropagation();
        // Support bulk drag — if item is selected and multiple selected, drag all
        if (selected.has(item.id) && selected.size > 1) {
            const draggedItems = sortedItems.filter(i => selected.has(i.id));
            setDragItem(draggedItems);
            e.dataTransfer.setData('text/plain', JSON.stringify(draggedItems.map(i => i.id)));
        } else {
            setDragItem(item);
            e.dataTransfer.setData('text/plain', item.id);
        }
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleFolderDragOver = (e, folderId) => {
        e.preventDefault();
        e.stopPropagation();
        if (dragItem && dragItem.id !== folderId) {
            setDropTargetFolder(folderId);
            e.dataTransfer.dropEffect = 'move';
        }
    };

    const handleFolderDragLeave = (e) => {
        e.stopPropagation();
        setDropTargetFolder(null);
    };

    const handleFolderDrop = async (e, targetFolderId) => {
        e.preventDefault();
        e.stopPropagation();
        setDropTargetFolder(null);
        if (!dragItem) { setDragItem(null); return; }

        // Handle bulk drag (array of items)
        const items = Array.isArray(dragItem) ? dragItem : [dragItem];
        const validItems = items.filter(i => i.id !== targetFolderId);
        if (validItems.length === 0) { setDragItem(null); return; }

        try {
            for (const item of validItems) {
                if (item.isFolder) {
                    await api.patch(`/api/drive/folders/${item.id}`, { parent_id: targetFolderId });
                } else {
                    await api.patch(`/api/drive/files/${item.id}`, { folder_id: targetFolderId });
                }
            }
            toast.success(`Moved ${validItems.length} item(s) into folder`);
            fetchFiles();
        } catch (error) {
            toast.error(error.message || 'Failed to move item');
        }
        setDragItem(null);
    };

    const handleItemDragEnd = () => {
        setDragItem(null);
        setDropTargetFolder(null);
    };

    // ── Build combined list (folders + files) ──────────────────
    const allItems = useMemo(() => {
        const folderItems = folders.map((f) => ({ ...f, isFolder: true }));
        const fileItems = files.map((f) => ({ ...f, isFolder: false }));
        return [...folderItems, ...fileItems];
    }, [files, folders]);

    // ── Client-side search refinement + sort ──────────────────
    const sortedItems = useMemo(() => {
        let items = [...allItems];
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            items = items.filter((i) => i.name?.toLowerCase().includes(q));
        }
        items.sort((a, b) => {
            if (a.isFolder && !b.isFolder) return -1;
            if (!a.isFolder && b.isFolder) return 1;
            let cmp = 0;
            if (sortBy === 'name') cmp = (a.name || '').localeCompare(b.name || '');
            else if (sortBy === 'size') cmp = (a.size || 0) - (b.size || 0);
            else cmp = new Date(a.created_at || 0) - new Date(b.created_at || 0);
            return sortOrder === 'asc' ? cmp : -cmp;
        });
        return items;
    }, [allItems, searchQuery, sortBy, sortOrder]);

    // ── Enhanced selection with shift/ctrl ─────────────────────
    const handleToggleSelect = (id, e) => {
        e?.stopPropagation();
        if (e?.shiftKey && lastSelectedRef.current) {
            const ids = sortedItems.map((i) => i.id);
            const a = ids.indexOf(lastSelectedRef.current);
            const b = ids.indexOf(id);
            const [s, en] = [Math.min(a, b), Math.max(a, b)];
            ids.slice(s, en + 1).forEach((sid) => toggleSelect(sid));
        } else {
            toggleSelect(id);
        }
        lastSelectedRef.current = id;
    };

    // ── Upload handlers ───────────────────────────────────────
    const handleUpload = (fileList) => uploadFiles(fileList);

    // ── Keyboard shortcuts ───────────────────────────────────
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Skip if user is typing in an input/textarea
            if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

            if (e.key === 'Delete' && selected.size > 0) {
                e.preventDefault();
                for (const id of selected) {
                    const item = sortedItems.find((i) => i.id === id);
                    if (item) deleteItem(item.id, item.isFolder ? 'folder' : 'file');
                }
                clearSelection();
            }
            if (e.key === 'Escape') {
                if (previewFile) setPreviewFile(null);
                else if (contextMenu) setContextMenu(null);
                else if (selected.size > 0) clearSelection();
            }
            if (e.key === 'F2' && selected.size === 1) {
                e.preventDefault();
                const id = [...selected][0];
                const item = sortedItems.find((i) => i.id === id);
                if (item) {
                    const newName = prompt('Rename to:', item.name);
                    if (newName && newName.trim() && newName !== item.name) {
                        renameItem(item.id, newName.trim());
                    }
                }
            }
            if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                selectAll();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selected, sortedItems, previewFile, contextMenu, deleteItem, clearSelection, setPreviewFile, setContextMenu, renameItem, selectAll]);

    // ── Folder creation ───────────────────────────────────────
    const handleCreateFolder = async () => {
        const name = newFolderName.trim();
        if (!name) return;
        if (/[/\\:*?"<>|]/.test(name)) {
            toast.error('Folder name contains invalid characters');
            return;
        }
        createFolder(name);
        setNewFolderName('');
    };

    // ── Folder navigation ─────────────────────────────────────
    const handleOpenFolder = (folderId) => openFolder(folderId);

    const handleGoBack = () => goBack();

    const handleGoToBreadcrumb = (folderId) => goToBreadcrumb(folderId);

    // ── File actions ──────────────────────────────────────────
    const handleDownload = (fileId, fileName) => downloadFile(fileId, fileName);

    const handleDelete = (item) => {
        deleteItem(item.id, item.isFolder ? 'folder' : 'file');
        setConfirmDelete(null);
    };

    const handleToggleStar = (id, type = 'file') => starItem(id, type);

    const handleBulkDelete = () => {
        for (const id of selected) {
            const item = sortedItems.find((i) => i.id === id);
            if (item) deleteItem(item.id, item.isFolder ? 'folder' : 'file');
        }
        clearSelection();
    };

    const handleDoubleClick = (item) => {
        if (item.isFolder) handleOpenFolder(item.id);
        else setPreviewFile(item);
    };

    // ── Context menu ──────────────────────────────────────────
    const openCtx = (e, item) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, item }); };
    useEffect(() => {
        const close = () => setContextMenu(null);
        window.addEventListener('click', close);
        window.addEventListener('scroll', close, true);
        return () => { window.removeEventListener('click', close); window.removeEventListener('scroll', close, true); };
    }, [setContextMenu]);

    const viewTitle = currentView === 'starred' ? 'Starred' : currentView === 'recent' ? 'Recent' : currentView === 'trash' ? 'Trash' : null;

    // ── Storage bar ───────────────────────────────────────────
    const storagePercent = storageInfo?.usedPercent || 0;
    const storageUsed = storageInfo?.quota?.used || 0;
    const storageLimit = storageInfo?.quota?.limit || 0;

    // ── Breadcrumb with root ──────────────────────────────────
    const breadcrumb = useMemo(() => {
        return [{ id: null, name: 'My Drive' }, ...folderPath];
    }, [folderPath]);

    // ─────────────────────────── RENDER ───────────────────────
    return (
        <div className="flex h-full min-h-0 -m-6"
            onDragEnter={handleDragEnter} onDragOver={onDragOver}
            onDragLeave={handleDragLeave} onDrop={onDrop}>
            <Toaster position="bottom-right" toastOptions={{ className: '!bg-zinc-800 !text-white !border !border-white/10 !shadow-xl', duration: 3500 }} />

            {/* ═══ SIDEBAR ═══ */}
            <AnimatePresence>
                {sidebarOpen && (
                    <motion.aside initial={{ width: 0, opacity: 0 }} animate={{ width: 260, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }} className="flex-shrink-0 border-r border-white/10 overflow-hidden flex flex-col"
                    >
                        <div className="p-4 flex-1 overflow-y-auto">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-2 px-2">Quick Access</p>
                            {[
                                { v: 'drive', icon: Home, label: 'My Drive' },
                                { v: 'recent', icon: Clock, label: 'Recent' },
                                { v: 'starred', icon: Star, label: 'Starred' },
                                { v: 'trash', icon: Trash2, label: 'Trash' },
                            ].map(({ v, icon: Icon, label }) => (
                                <button key={v} onClick={() => switchView(v)}
                                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all cursor-pointer mb-0.5
                    ${currentView === v ? 'bg-indigo-600/20 text-indigo-400 font-medium' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}>
                                    <Icon size={16} /><span>{label}</span>
                                </button>
                            ))}

                            <div className="mt-6 mb-4">
                                <button onClick={() => { switchView('drive'); setShowNewFolder(true); }}
                                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors cursor-pointer shadow-lg shadow-indigo-500/20">
                                    <FolderPlus size={16} /><span>New Folder</span>
                                </button>
                            </div>

                            {/* Nested folder tree */}
                            {currentView === 'drive' && folderTree.length > 0 && (
                                <div className="mt-4">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-2 px-2">Folders</p>
                                    {folderTree.filter(f => !f.parent_id).map(root => (
                                        <FolderTreeNode key={root.id} folder={root} allFolders={folderTree}
                                            currentFolder={currentFolder} onNavigate={(id) => { switchView('drive'); openFolder(id); }} />
                                    ))}
                                </div>
                            )}

                            {/* Storage indicator */}
                            {storageInfo && (
                                <div className="mt-4 px-2">
                                    <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1.5">
                                        <HardDrive size={12} />
                                        <span>{formatSize(storageUsed)} of {formatSize(storageLimit)}</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full transition-all ${storagePercent > 90 ? 'bg-red-500' : storagePercent > 70 ? 'bg-yellow-500' : 'bg-indigo-500'}`}
                                            style={{ width: `${Math.min(storagePercent, 100)}%` }} />
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.aside>
                )}
            </AnimatePresence>

            {/* ═══ MAIN CONTENT ═══ */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* ── Toolbar ──────────────────────────────────────────── */}
                <div className="flex-shrink-0 border-b border-white/10 px-6 py-3 space-y-2">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2 min-w-0">
                            <button onClick={() => setSidebarOpen((p) => !p)} className="text-zinc-500 hover:text-white transition-colors cursor-pointer p-1">
                                <SlidersHorizontal size={16} />
                            </button>
                            {currentView === 'drive' ? (
                                <>
                                    {breadcrumb.length > 1 && (
                                        <button onClick={handleGoBack} className="text-zinc-500 hover:text-white transition-colors cursor-pointer p-1"><ChevronLeft size={16} /></button>
                                    )}
                                    <div className="flex items-center gap-1 text-sm min-w-0 overflow-hidden">
                                        {breadcrumb.map((seg, idx) => (
                                            <React.Fragment key={seg.id || 'root'}>
                                                {idx > 0 && <ChevronRight size={12} className="text-zinc-600 flex-shrink-0" />}
                                                <button onClick={() => handleGoToBreadcrumb(seg.id)}
                                                    className={`truncate transition-colors cursor-pointer ${idx === breadcrumb.length - 1 ? 'text-white font-semibold' : 'text-zinc-500 hover:text-white'}`}>
                                                    {seg.name}
                                                </button>
                                            </React.Fragment>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <h2 className="text-white font-semibold text-lg">{viewTitle}</h2>
                            )}
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                            <button onClick={fetchFiles}
                                className="p-2 text-zinc-500 hover:text-white transition-colors cursor-pointer rounded-lg hover:bg-white/5" title="Refresh">
                                <RefreshCw size={15} />
                            </button>
                            {currentView === 'drive' && (
                                <>
                                    <button onClick={() => fileInputRef.current?.click()}
                                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors cursor-pointer shadow-sm">
                                        <Upload size={14} /> Upload
                                    </button>
                                    <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => { handleUpload(e.target.files); e.target.value = ''; }} />
                                    <button onClick={() => setShowNewFolder(true)}
                                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-sm font-medium transition-colors cursor-pointer border border-white/10">
                                        <FolderPlus size={14} /> Folder
                                    </button>
                                </>
                            )}
                            {currentView === 'trash' && sortedItems.length > 0 && (
                                <button onClick={emptyTrash}
                                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-400 text-sm font-medium transition-colors cursor-pointer border border-red-500/20">
                                    <Trash2 size={14} /> Empty Trash
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Search + Sort + View */}
                    <div className="flex items-center gap-3">
                        <div className="relative flex-1 max-w-md">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                            <input type="text" placeholder="Search files…" value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-zinc-900/60 border border-white/10 rounded-lg pl-9 pr-8 py-2 text-sm text-zinc-300 placeholder-zinc-600 outline-none focus:border-indigo-500/60 transition-colors" />
                            {searchQuery && (
                                <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white cursor-pointer"><X size={14} /></button>
                            )}
                        </div>
                        <div className="flex items-center gap-1.5 ml-auto">
                            <button onClick={() => handleSort(sortBy === 'created_at' ? 'name' : 'created_at')}
                                className="flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer border border-white/10">
                                <ArrowUpDown size={12} />
                                <span className="capitalize">{sortBy === 'created_at' ? 'Date' : sortBy}</span>
                                <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                            </button>
                            <div className="flex bg-zinc-900/60 border border-white/10 rounded-lg p-0.5">
                                <button onClick={() => setView('grid')} className={`p-1.5 rounded-md transition-colors cursor-pointer ${view === 'grid' ? 'bg-indigo-600 text-white' : 'text-zinc-500 hover:text-white'}`}>
                                    <Grid3X3 size={14} />
                                </button>
                                <button onClick={() => setView('list')} className={`p-1.5 rounded-md transition-colors cursor-pointer ${view === 'list' ? 'bg-indigo-600 text-white' : 'text-zinc-500 hover:text-white'}`}>
                                    <List size={14} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Selection bar */}
                    {selected.size > 0 && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                            className="flex items-center gap-3 text-sm">
                            <span className="text-indigo-400 font-medium">{selected.size} selected</span>
                            <div className="flex items-center gap-1">
                                <button onClick={handleBulkDelete} className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer" title="Delete"><Trash2 size={14} /></button>
                                <button onClick={selectAll} className="px-2 py-1 rounded text-xs text-zinc-500 hover:text-white transition-colors cursor-pointer">Select All</button>
                                <button onClick={clearSelection} className="px-2 py-1 rounded text-xs text-zinc-500 hover:text-white transition-colors cursor-pointer">Clear</button>
                            </div>
                        </motion.div>
                    )}
                </div>

                {/* ── File area ──────────────────────────────────────── */}
                <div className="flex-1 overflow-y-auto p-6" onClick={() => { clearSelection(); setContextMenu(null); }}
                    onContextMenu={(e) => { if (currentView === 'drive') { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, item: null }); } }}>

                    {/* Error banner */}
                    {error && !loading && (
                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                            className="mb-4 flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
                            <AlertTriangle size={18} className="text-red-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm text-red-300 font-medium">
                                    {error.code === 'NETWORK_ERROR' ? 'Server not reachable' : 'Failed to load files'}
                                </p>
                                <p className="text-xs text-red-400/70 truncate">{error.message}</p>
                            </div>
                            <button onClick={() => { clearError(); fetchFiles(); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-medium transition-colors cursor-pointer">
                                <RefreshCw size={12} /> Retry
                            </button>
                            <button onClick={clearError} className="p-1 text-red-400/50 hover:text-red-300 transition-colors cursor-pointer">
                                <X size={14} />
                            </button>
                        </motion.div>
                    )}

                    {/* Loading skeletons */}
                    {loading && (
                        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                            {Array.from({ length: 8 }).map((_, i) => (
                                <div key={i} className="bg-zinc-900/60 border border-white/5 rounded-xl p-5 animate-pulse">
                                    <div className="w-10 h-10 rounded-lg bg-zinc-800 mb-4" />
                                    <div className="h-3 bg-zinc-800 rounded w-3/4 mb-2" />
                                    <div className="h-2 bg-zinc-800 rounded w-1/2" />
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Empty state */}
                    {!loading && sortedItems.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="w-20 h-20 rounded-2xl bg-zinc-800/60 border border-white/5 flex items-center justify-center mb-5">
                                {currentView === 'starred' ? <Star size={32} className="text-zinc-600" /> :
                                    currentView === 'trash' ? <Trash2 size={32} className="text-zinc-600" /> :
                                        searchQuery ? <Search size={32} className="text-zinc-600" /> :
                                            <FolderOpen size={32} className="text-zinc-600" />}
                            </div>
                            <h3 className="text-white font-semibold text-lg mb-1">
                                {currentView === 'starred' ? 'No starred items' :
                                    currentView === 'trash' ? 'Trash is empty' :
                                        searchQuery ? 'No results found' : 'This folder is empty'}
                            </h3>
                            <p className="text-zinc-500 text-sm max-w-xs mb-5">
                                {currentView === 'trash' ? 'Items you delete will show up here' :
                                    searchQuery ? 'Try different keywords' : 'Upload files or create a folder to get started'}
                            </p>
                            {currentView === 'drive' && !searchQuery && (
                                <button onClick={() => fileInputRef.current?.click()}
                                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors cursor-pointer shadow-lg shadow-indigo-500/20">
                                    <Upload size={14} className="inline mr-1.5" /> Upload Files
                                </button>
                            )}
                        </div>
                    )}

                    {/* New folder inline input */}
                    {showNewFolder && (
                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-4 flex items-center gap-2">
                            <div className="flex items-center gap-2 bg-zinc-900/80 border border-indigo-500/40 rounded-lg px-3 py-2 w-64">
                                <FolderPlus size={16} className="text-indigo-400 flex-shrink-0" />
                                <input autoFocus type="text" placeholder="Folder name" value={newFolderName}
                                    onChange={(e) => setNewFolderName(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') setShowNewFolder(false); }}
                                    className="bg-transparent text-sm text-white placeholder-zinc-500 outline-none flex-1" />
                            </div>
                            <button onClick={handleCreateFolder} className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer"><Check size={14} /></button>
                            <button onClick={() => { setShowNewFolder(false); setNewFolderName(''); }} className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 transition-colors cursor-pointer"><X size={14} /></button>
                        </motion.div>
                    )}

                    {/* ── GRID VIEW ──────────────────────────────────── */}
                    {!loading && sortedItems.length > 0 && view === 'grid' && (
                        <motion.div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3"
                            initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.03 } } }}>
                            {sortedItems.map((item) => {
                                const cat = getCategory(item);
                                const style = CATEGORY_STYLE[cat] || CATEGORY_STYLE.other;
                                const IconComp = style.Icon;
                                const customs = item.isFolder ? getFolderCustom(item.id) : {};
                                const color = item.isFolder ? (customs.color || item.color || '#6366f1') : style.color;
                                const isSel = selected.has(item.id);
                                const isStarred = item.is_starred;
                                const folderIcon = customs.icon || item.icon || '📁';
                                return (
                                    <motion.div key={`${item.isFolder ? 'f' : 'd'}-${item.id}`}
                                        variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
                                        draggable
                                        onDragStart={(e) => handleItemDragStart(e, item)}
                                        onDragEnd={() => setDragItem(null)}
                                        onClick={(e) => item.isFolder ? handleOpenFolder(item.id) : handleToggleSelect(item.id, e)}
                                        onDoubleClick={() => !item.isFolder && handleDoubleClick(item)}
                                        onContextMenu={(e) => openCtx(e, item)}
                                        {...(item.isFolder ? {
                                            onDragOver: (e) => handleFolderDragOver(e, item.id),
                                            onDragLeave: handleFolderDragLeave,
                                            onDrop: (e) => handleFolderDrop(e, item.id),
                                        } : {})}
                                        className={`relative rounded-xl transition-all duration-150 cursor-pointer group overflow-hidden
                      ${isSel ? 'ring-2 ring-indigo-500/60' : ''}
                      ${dropTargetFolder === item.id ? 'ring-2 ring-green-400/60 scale-[1.02]' : ''}
                      ${item.isFolder
                                                ? 'bg-gradient-to-br from-[#12121a] to-[#16162a] border border-white/[0.06] hover:border-white/15'
                                                : 'bg-[#12121a] border border-white/5 hover:border-white/15 hover:bg-white/[0.02]'
                                            } p-4`}>

                                        {/* Folder color accent strip */}
                                        {item.isFolder && (
                                            <div className="absolute top-0 left-0 right-0 h-1 rounded-t-xl" style={{ backgroundColor: color }} />
                                        )}

                                        {/* Checkbox */}
                                        <div className={`absolute top-3 left-3 transition-opacity z-10 ${isSel || selected.size > 0 ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                            <button onClick={(e) => { e.stopPropagation(); handleToggleSelect(item.id, e); }} className="cursor-pointer">
                                                {isSel ? <CheckSquare size={16} className="text-indigo-400" /> : <Square size={16} className="text-zinc-600" />}
                                            </button>
                                        </div>

                                        {/* Star badge */}
                                        {isStarred && (
                                            <div className="absolute top-3 right-3 z-10">
                                                <Star size={12} className="text-yellow-400 fill-yellow-400" />
                                            </div>
                                        )}

                                        {/* Bulk drag badge */}
                                        {isSel && selected.size > 1 && (
                                            <div className="absolute top-3 right-3 z-10 bg-indigo-600 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                                                {selected.size}
                                            </div>
                                        )}

                                        {/* Icon area */}
                                        {item.isFolder ? (
                                            /* ── FOLDER CARD ── */
                                            <div className="flex items-center gap-3 mt-1">
                                                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg"
                                                    style={{ backgroundColor: `${color}20`, boxShadow: `0 4px 12px ${color}15` }}>
                                                    <span className="text-xl">{folderIcon}</span>
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm text-white font-semibold truncate group-hover:text-indigo-300 transition-colors">{item.name}</p>
                                                    <p className="text-[10px] mt-0.5" style={{ color: `${color}99` }}>{relDate(item.created_at)}</p>
                                                </div>
                                            </div>
                                        ) : (
                                            /* ── FILE CARD ── */
                                            <>
                                                <div className="flex items-center justify-center w-12 h-12 rounded-xl mb-3 mt-2 mx-auto" style={{ backgroundColor: `${color}15` }}>
                                                    <IconComp size={22} style={{ color }} />
                                                </div>
                                                <p className="text-sm text-white font-medium truncate text-center group-hover:text-indigo-300 transition-colors">{item.name}</p>
                                                <div className="flex items-center justify-center gap-2 mt-1.5 text-[10px] text-zinc-600">
                                                    <span>{formatSize(item.size)}</span>
                                                    <span>{relDate(item.created_at)}</span>
                                                </div>
                                            </>
                                        )}

                                        {/* Hover actions */}
                                        <div className={`absolute bottom-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${item.isFolder ? '' : ''}`}>
                                            {currentView === 'trash' ? (
                                                <button onClick={(e) => { e.stopPropagation(); restoreItem(item.id, item.isFolder ? 'folder' : 'file'); }}
                                                    className="p-1 rounded text-zinc-500 hover:text-green-400 hover:bg-white/10 transition-colors cursor-pointer" title="Restore">
                                                    <RotateCcw size={12} />
                                                </button>
                                            ) : (
                                                <>
                                                    {item.isFolder ? (
                                                        <button onClick={(e) => { e.stopPropagation(); handleToggleStar(item.id, 'folder'); }}
                                                            className="p-1 rounded text-zinc-500 hover:text-yellow-400 hover:bg-white/10 transition-colors cursor-pointer" title={isStarred ? 'Unstar' : 'Star'}>
                                                            {isStarred ? <StarOff size={12} /> : <Star size={12} />}
                                                        </button>
                                                    ) : (
                                                        <>
                                                            <button onClick={(e) => { e.stopPropagation(); handleToggleStar(item.id, 'file'); }}
                                                                className="p-1 rounded text-zinc-500 hover:text-yellow-400 hover:bg-white/10 transition-colors cursor-pointer" title={isStarred ? 'Unstar' : 'Star'}>
                                                                {isStarred ? <StarOff size={12} /> : <Star size={12} />}
                                                            </button>
                                                            <button onClick={(e) => { e.stopPropagation(); handleDownload(item.id, item.name); }}
                                                                className="p-1 rounded text-zinc-500 hover:text-white hover:bg-white/10 transition-colors cursor-pointer" title="Download"><Download size={12} /></button>
                                                        </>
                                                    )}
                                                </>
                                            )}
                                            <button onClick={(e) => openCtx(e, item)}
                                                className="p-1 rounded text-zinc-500 hover:text-white hover:bg-white/10 transition-colors cursor-pointer" title="More"><MoreVertical size={12} /></button>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </motion.div>
                    )}

                    {/* ── LIST VIEW ──────────────────────────────────── */}
                    {!loading && sortedItems.length > 0 && view === 'list' && (
                        <div className="bg-[#12121a] border border-white/5 rounded-xl overflow-hidden">
                            <div className="grid grid-cols-[32px_1fr_80px_100px_40px_32px] gap-3 px-4 py-2.5 border-b border-white/5 text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                                <span /><span>Name</span><span>Size</span><span>Modified</span><span>★</span><span />
                            </div>
                            {sortedItems.map((item) => {
                                const cat = getCategory(item);
                                const style = CATEGORY_STYLE[cat] || CATEGORY_STYLE.other;
                                const IconComp = style.Icon;
                                const customs = item.isFolder ? getFolderCustom(item.id) : {};
                                const color = item.isFolder ? (customs.color || item.color || style.color) : style.color;
                                const isSel = selected.has(item.id);
                                const isStarred = item.is_starred;
                                return (
                                    <div key={`${item.isFolder ? 'f' : 'd'}-${item.id}`} onClick={(e) => handleToggleSelect(item.id, e)} onDoubleClick={() => handleDoubleClick(item)}
                                        onContextMenu={(e) => openCtx(e, item)}
                                        className={`grid grid-cols-[32px_1fr_80px_100px_40px_32px] gap-3 px-4 py-2.5 border-b border-white/[0.03] transition-colors cursor-pointer group
                      ${isSel ? 'bg-indigo-600/10' : 'hover:bg-white/[0.02]'}`}>
                                        <button onClick={(e) => handleToggleSelect(item.id, e)} className="flex items-center justify-center cursor-pointer">
                                            {isSel ? <CheckSquare size={14} className="text-indigo-400" /> : <Square size={14} className="text-zinc-700 group-hover:text-zinc-500" />}
                                        </button>
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            {item.isFolder ? <Folder size={16} style={{ color }} fill={color} fillOpacity={0.2} /> : <IconComp size={16} style={{ color }} />}
                                            <span className="text-sm text-zinc-300 truncate group-hover:text-white transition-colors">{item.name}</span>
                                        </div>
                                        <span className="text-xs text-zinc-600 flex items-center">{item.isFolder ? '—' : formatSize(item.size)}</span>
                                        <span className="text-xs text-zinc-600 flex items-center">{relDate(item.created_at)}</span>
                                        <div className="flex items-center justify-center">
                                            {!item.isFolder && currentView !== 'trash' && (
                                                <button onClick={(e) => { e.stopPropagation(); handleToggleStar(item.id, 'file'); }} className="cursor-pointer">
                                                    {isStarred ? <Star size={12} className="text-yellow-400 fill-yellow-400" /> : <Star size={12} className="text-zinc-700 hover:text-yellow-400 transition-colors" />}
                                                </button>
                                            )}
                                            {currentView === 'trash' && (
                                                <button onClick={(e) => { e.stopPropagation(); restoreItem(item.id); }} className="cursor-pointer text-zinc-600 hover:text-green-400">
                                                    <RotateCcw size={12} />
                                                </button>
                                            )}
                                        </div>
                                        <button onClick={(e) => openCtx(e, item)}
                                            className="flex items-center justify-center text-zinc-600 hover:text-white cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
                                            <MoreVertical size={14} />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* ═══ DRAG & DROP OVERLAY ═══ */}
            <AnimatePresence>
                {dragOver && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center pointer-events-none">
                        <div className="border-2 border-dashed border-indigo-500/60 rounded-3xl p-16 text-center">
                            <UploadCloud size={48} className="text-indigo-400 mx-auto mb-4 animate-bounce" />
                            <p className="text-white font-semibold text-lg">Drop files here to upload</p>
                            <p className="text-zinc-400 text-sm mt-1">All file types supported</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ═══ CONTEXT MENU ═══ */}
            <AnimatePresence>
                {contextMenu && (
                    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.1 }}
                        className="fixed z-50 bg-[#1a1a24] border border-white/10 rounded-xl shadow-2xl shadow-black/50 py-1.5 min-w-[180px]"
                        style={{ left: Math.min(contextMenu.x, window.innerWidth - 200), top: Math.min(contextMenu.y, window.innerHeight - 300) }}
                        onClick={(e) => e.stopPropagation()}>
                        {contextMenu.item ? (
                            <>
                                {contextMenu.item.isFolder && (
                                    <CtxBtn icon={FolderOpen} label="Open" onClick={() => { handleOpenFolder(contextMenu.item.id); setContextMenu(null); }} />
                                )}
                                {!contextMenu.item.isFolder && (
                                    <>
                                        <CtxBtn icon={Eye} label="Preview" onClick={() => { setPreviewFile(contextMenu.item); setContextMenu(null); }} />
                                        <CtxBtn icon={Download} label="Download" onClick={() => { handleDownload(contextMenu.item.id, contextMenu.item.name); setContextMenu(null); }} />
                                        {currentView !== 'trash' && (
                                            <CtxBtn icon={contextMenu.item.is_starred ? StarOff : Star} label={contextMenu.item.is_starred ? 'Unstar' : 'Star'}
                                                onClick={() => { handleToggleStar(contextMenu.item.id, 'file'); setContextMenu(null); }} />
                                        )}
                                    </>
                                )}
                                {currentView !== 'trash' && contextMenu.item.isFolder && (
                                    <>
                                        <CtxBtn icon={Palette} label="Change Color" onClick={() => { setShowColorPicker(contextMenu.item.id); setContextMenu(null); }} />
                                        <CtxBtn icon={Folder} label="Change Icon" onClick={() => { setShowIconPicker(contextMenu.item.id); setContextMenu(null); }} />
                                        <CtxBtn icon={Share2} label="Share" onClick={() => { drive.setShowShareModal(contextMenu.item); setContextMenu(null); }} />
                                    </>
                                )}
                                {currentView === 'trash' && (
                                    <CtxBtn icon={RotateCcw} label="Restore" onClick={() => { restoreItem(contextMenu.item.id, contextMenu.item.isFolder ? 'folder' : 'file'); setContextMenu(null); }} />
                                )}
                                <div className="h-px bg-white/5 my-1" />
                                <CtxBtn icon={Trash2} label={currentView === 'trash' ? 'Delete Permanently' : 'Delete'} danger
                                    onClick={() => { setConfirmDelete(contextMenu.item); setContextMenu(null); }} />
                            </>
                        ) : (
                            <>
                                <CtxBtn icon={FolderPlus} label="New Folder" onClick={() => { setShowNewFolder(true); setContextMenu(null); }} />
                                <CtxBtn icon={Upload} label="Upload Files" onClick={() => { fileInputRef.current?.click(); setContextMenu(null); }} />
                                <div className="h-px bg-white/5 my-1" />
                                <CtxBtn icon={RefreshCw} label="Refresh" onClick={() => { fetchFiles(); setContextMenu(null); }} />
                            </>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ═══ DELETE CONFIRMATION ═══ */}
            <AnimatePresence>
                {confirmDelete && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center" onClick={() => setConfirmDelete(null)}>
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-[#1a1a24] border border-white/10 rounded-2xl p-6 w-96 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                                    <Trash2 size={20} className="text-red-400" />
                                </div>
                                <div>
                                    <h3 className="text-white font-semibold">Delete {confirmDelete.isFolder ? 'Folder' : 'File'}</h3>
                                    <p className="text-zinc-500 text-xs">
                                        {currentView === 'trash' ? 'This action cannot be undone' : 'Item will be moved to trash'}
                                    </p>
                                </div>
                            </div>
                            <p className="text-zinc-400 text-sm mb-6">
                                Are you sure you want to {currentView === 'trash' ? 'permanently delete' : 'delete'} <span className="text-white font-medium">"{confirmDelete.name}"</span>?
                                {confirmDelete.isFolder && ' All files inside will also be deleted.'}
                            </p>
                            <div className="flex justify-end gap-2">
                                <button onClick={() => setConfirmDelete(null)}
                                    className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm transition-colors cursor-pointer">Cancel</button>
                                <button onClick={() => handleDelete(confirmDelete)}
                                    className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors cursor-pointer">Delete</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ═══ UPLOAD PANEL ═══ */}
            <AnimatePresence>
                {uploadQueue.length > 0 && (
                    <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
                        className="fixed bottom-4 right-4 z-40 w-80 bg-[#1a1a24] border border-white/10 rounded-xl shadow-2xl shadow-black/50 overflow-hidden">
                        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                            <span className="text-white text-sm font-medium">
                                {uploading ? `Uploading ${uploadQueue.filter((u) => u.status === 'uploading').length} file(s)…` : 'Upload Complete'}
                            </span>
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                            {uploadQueue.map((item) => (
                                <div key={item.id} className="px-4 py-2 flex items-center gap-3 border-b border-white/[0.03]">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-zinc-300 truncate">{item.name}</p>
                                        <div className="w-full h-1 bg-zinc-800 rounded-full mt-1.5 overflow-hidden">
                                            <div className={`h-full rounded-full transition-all ${item.status === 'error' ? 'bg-red-500' : item.status === 'done' ? 'bg-green-500' : 'bg-indigo-500'}`}
                                                style={{ width: `${item.progress}%` }} />
                                        </div>
                                    </div>
                                    <div className="flex-shrink-0">
                                        {item.status === 'done' && <Check size={14} className="text-green-400" />}
                                        {item.status === 'error' && <X size={14} className="text-red-400" />}
                                        {item.status !== 'done' && item.status !== 'error' && (
                                            <span className="text-xs text-zinc-500">{item.progress}%</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ═══ FILE PREVIEW ═══ */}
            <AnimatePresence>
                {previewFile && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center" onClick={() => setPreviewFile(null)}>
                        <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
                            className="bg-[#1a1a24] border border-white/10 rounded-2xl w-[90vw] max-w-3xl max-h-[85vh] overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-between p-4 border-b border-white/5">
                                <div className="flex items-center gap-3 min-w-0">
                                    {(() => { const cat = getCategory({ ...previewFile, isFolder: false }); const s = CATEGORY_STYLE[cat]; return <s.Icon size={18} style={{ color: s.color }} />; })()}
                                    <div className="min-w-0">
                                        <p className="text-white font-medium truncate">{previewFile.original_name || previewFile.name}</p>
                                        <p className="text-xs text-zinc-500">{formatSize(previewFile.size)} · {relDate(previewFile.created_at)}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => handleDownload(previewFile.id, previewFile.name)}
                                        className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer"><Download size={16} /></button>
                                    <button onClick={() => setPreviewFile(null)}
                                        className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer"><X size={16} /></button>
                                </div>
                            </div>
                            <div className="p-6 flex items-center justify-center" style={{ minHeight: '400px' }}>
                                {(() => {
                                    // Build preview URL using backend API
                                    const slug = localStorage.getItem('currentCommitteeSlug') || '';
                                    const previewUrl = `http://localhost:5000/api/drive/files/${previewFile.id}/preview?committee=${slug}`;

                                    if (previewFile.mime_type?.startsWith('image/')) {
                                        return <img src={previewUrl} alt={previewFile.name}
                                            className="max-w-full max-h-[70vh] rounded-lg object-contain"
                                            onError={(e) => { e.target.style.display = 'none'; }} />;
                                    }
                                    if (previewFile.mime_type?.startsWith('video/')) {
                                        return <video controls className="max-w-full max-h-[70vh] rounded-lg">
                                            <source src={previewUrl} type={previewFile.mime_type} />
                                        </video>;
                                    }
                                    if (previewFile.mime_type?.startsWith('audio/')) {
                                        return <div className="text-center">
                                            <Music size={48} className="text-teal-400 mx-auto mb-4" />
                                            <audio controls className="w-full max-w-md">
                                                <source src={previewUrl} type={previewFile.mime_type} />
                                            </audio>
                                        </div>;
                                    }
                                    if (previewFile.mime_type === 'application/pdf') {
                                        return <iframe src={previewUrl} className="w-full h-[70vh] rounded-lg" title="PDF Preview" />;
                                    }
                                    // Default: show file info + download button
                                    const cat = getCategory({ ...previewFile, isFolder: false });
                                    const s = CATEGORY_STYLE[cat];
                                    return <div className="text-center">
                                        <s.Icon size={64} style={{ color: s.color }} className="mx-auto mb-4" />
                                        <p className="text-white font-medium text-lg">{previewFile.name}</p>
                                        <p className="text-zinc-500 text-sm mt-1">{previewFile.mime_type} · {formatSize(previewFile.size)}</p>
                                        <button onClick={() => handleDownload(previewFile.id, previewFile.name)}
                                            className="mt-4 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium cursor-pointer">
                                            <Download size={14} className="inline mr-1.5" /> Download
                                        </button>
                                    </div>;
                                })()}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ═══ COLOR PICKER ═══ */}
            <AnimatePresence>
                {showColorPicker && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center" onClick={() => setShowColorPicker(null)}>
                        <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
                            className="bg-[#1a1a24] border border-white/10 rounded-2xl p-5 w-72 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-white font-semibold text-sm">Folder Color</h3>
                                <button onClick={() => setShowColorPicker(null)} className="text-zinc-500 hover:text-white cursor-pointer"><X size={16} /></button>
                            </div>
                            <div className="grid grid-cols-6 gap-2">
                                {FOLDER_COLORS.map(color => (
                                    <button key={color} onClick={() => {
                                        // Save to localStorage since backend doesn't support folder color
                                        const customs = JSON.parse(localStorage.getItem('folderCustomizations') || '{}');
                                        customs[showColorPicker] = { ...customs[showColorPicker], color };
                                        localStorage.setItem('folderCustomizations', JSON.stringify(customs));
                                        toast.success('Color updated');
                                        // Force re-render by closing picker
                                        setShowColorPicker(null);
                                        fetchFiles();
                                    }}
                                        className="w-9 h-9 rounded-lg cursor-pointer transition-transform hover:scale-110 ring-2 ring-transparent hover:ring-white/30"
                                        style={{ backgroundColor: color }} />
                                ))}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ═══ ICON PICKER ═══ */}
            <AnimatePresence>
                {showIconPicker && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center" onClick={() => setShowIconPicker(null)}>
                        <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
                            className="bg-[#1a1a24] border border-white/10 rounded-2xl p-5 w-72 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-white font-semibold text-sm">Folder Icon</h3>
                                <button onClick={() => setShowIconPicker(null)} className="text-zinc-500 hover:text-white cursor-pointer"><X size={16} /></button>
                            </div>
                            <div className="grid grid-cols-8 gap-2">
                                {FOLDER_ICONS.map(icon => (
                                    <button key={icon} onClick={() => {
                                        // Save to localStorage since backend doesn't support folder icon
                                        const customs = JSON.parse(localStorage.getItem('folderCustomizations') || '{}');
                                        customs[showIconPicker] = { ...customs[showIconPicker], icon };
                                        localStorage.setItem('folderCustomizations', JSON.stringify(customs));
                                        toast.success('Icon updated');
                                        setShowIconPicker(null);
                                        fetchFiles();
                                    }}
                                        className="w-8 h-8 flex items-center justify-center text-lg rounded-lg cursor-pointer hover:bg-white/10 transition-colors" >
                                        {icon}
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// ── Context menu button ─────────────────────────────────────────────
const CtxBtn = ({ icon: Icon, label, onClick, danger }) => (
    <button onClick={onClick}
        className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-sm transition-colors cursor-pointer
    ${danger ? 'text-red-400 hover:bg-red-500/10' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}>
        <Icon size={14} />{label}
    </button>
);

export default Drive;
