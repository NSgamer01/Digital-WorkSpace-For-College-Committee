// ============================================
// hooks/useDrive.js — Drive State & Actions
// ============================================
// Updated to use new multi-committee api.js client
// instead of localDriveAPI.
// ============================================

import { useState, useCallback, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import api from '../utils/api';

const useDrive = () => {
    // ── Core state ──────────────────────────
    const [files, setFiles] = useState([]);
    const [folders, setFolders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [total, setTotal] = useState(0);

    // ── Navigation ──────────────────────────
    const [currentFolder, setCurrentFolder] = useState(null);
    const [folderPath, setFolderPath] = useState([]);
    const [currentView, setCurrentView] = useState('drive');

    // ── UI state ────────────────────────────
    const [view, setView] = useState('grid');
    const [sortBy, setSortBy] = useState('created_at');
    const [sortOrder, setSortOrder] = useState('desc');
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState('');
    const [selectedFiles, setSelectedFiles] = useState(new Set());

    // ── Modals ──────────────────────────────
    const [previewFile, setPreviewFile] = useState(null);
    const [showCreateFolder, setShowCreateFolder] = useState(false);
    const [showShareModal, setShowShareModal] = useState(null);
    const [showMoveModal, setShowMoveModal] = useState(null);
    const [showRenameModal, setShowRenameModal] = useState(null);

    // ── Upload ──────────────────────────────
    const [uploadQueue, setUploadQueue] = useState([]);
    const [uploading, setUploading] = useState(false);

    // ── Storage ─────────────────────────────
    const [storageInfo, setStorageInfo] = useState(null);

    // ── Context menu ────────────────────────
    const [contextMenu, setContextMenu] = useState(null);

    // ── Drag & drop ─────────────────────────
    const [dragCounter, setDragCounter] = useState(0);
    const dragOver = dragCounter > 0;

    const abortRef = useRef(null);

    // ═════════════════════════════════════════
    //  FETCH FILES
    // ═════════════════════════════════════════
    const fetchFiles = useCallback(async () => {
        // api.js handles auth via Firebase ID tokens — no localStorage check needed
        setLoading(true);
        setError(null);
        try {
            let filesData, foldersData;
            switch (currentView) {
                case 'trash': {
                    const data = await api.get('/api/drive/trash');
                    setFiles(data.files || []);
                    setFolders(data.folders || []);
                    setTotal((data.files?.length || 0) + (data.folders?.length || 0));
                    break;
                }
                case 'recent': {
                    try {
                        const data = await api.get('/api/drive/recent', { limit: 30 });
                        filesData = data.files || [];
                    } catch {
                        // Fallback: fetch all files and sort client-side
                        const data = await api.get('/api/drive/files');
                        filesData = (data.files || []).sort((a, b) =>
                            new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at)
                        ).slice(0, 30);
                    }
                    setFiles(filesData);
                    setFolders([]);
                    setTotal(filesData.length);
                    break;
                }
                case 'starred': {
                    try {
                        const data = await api.get('/api/drive/starred');
                        filesData = data.files || [];
                        foldersData = data.folders || [];
                    } catch {
                        // Fallback: fetch all, filter client-side
                        const allFiles = await api.get('/api/drive/files');
                        filesData = (allFiles.files || []).filter(f => f.is_starred);
                        const allFolders = await api.get('/api/drive/folders');
                        foldersData = (allFolders.folders || []).filter(f => f.is_starred);
                    }
                    setFiles(filesData);
                    setFolders(foldersData);
                    setTotal(filesData.length + foldersData.length);
                    break;
                }
                case 'search': {
                    if (!searchQuery) {
                        setFiles([]);
                        setFolders([]);
                        setTotal(0);
                        break;
                    }
                    const data = await api.get('/api/drive/search', { q: searchQuery });
                    setFiles(data.files || []);
                    setFolders([]);
                    setTotal(data.total || 0);
                    break;
                }
                default: { // 'drive'
                    const params = {};
                    if (currentFolder) params.folderId = currentFolder;
                    if (searchQuery) params.q = searchQuery;

                    const [filesRes, foldersRes] = await Promise.all([
                        api.get('/api/drive/files', params),
                        api.get('/api/drive/folders', { parentId: currentFolder || undefined }),
                    ]);

                    filesData = filesRes.files || [];
                    foldersData = foldersRes.folders || [];

                    // Client-side sorting
                    if (sortBy && filesData.length > 0) {
                        filesData.sort((a, b) => {
                            let va = a[sortBy];
                            let vb = b[sortBy];
                            if (sortBy === 'created_at' || sortBy === 'updated_at') {
                                va = new Date(va).getTime();
                                vb = new Date(vb).getTime();
                            }
                            if (typeof va === 'string') va = va.toLowerCase();
                            if (typeof vb === 'string') vb = vb.toLowerCase();
                            if (va < vb) return sortOrder === 'asc' ? -1 : 1;
                            if (va > vb) return sortOrder === 'asc' ? 1 : -1;
                            return 0;
                        });
                    }

                    setFiles(filesData);
                    setFolders(foldersData);
                    setTotal(filesData.length + foldersData.length);
                }
            }
        } catch (err) {
            console.error('Fetch files error:', err);
            setError({ message: err.message || 'Failed to load files', code: err.code });
            if (err.message !== 'Authentication expired. Please log in again.' &&
                err.message !== 'Network error. Please check your connection.') {
                toast.error(err.message || 'Failed to load files');
            }
        } finally {
            setLoading(false);
        }
    }, [currentView, currentFolder, searchQuery, filterType, sortBy, sortOrder]);

    // ═════════════════════════════════════════
    //  FETCH STORAGE
    // ═════════════════════════════════════════
    const STORAGE_LIMIT = 10 * 1024 * 1024 * 1024; // 10 GB

    const fetchStorage = useCallback(async () => {
        try {
            const data = await api.get('/api/drive/stats');
            const raw = data.stats || data || {};
            // Normalize to expected shape: { quota: { used, limit }, usedPercent }
            const usedBytes = raw.total_size || raw.used || raw.quota?.used || 0;
            const limitBytes = raw.quota?.limit || raw.limit || STORAGE_LIMIT;
            const usedPercent = limitBytes > 0 ? Math.round((usedBytes / limitBytes) * 100) : 0;
            setStorageInfo({
                quota: { used: usedBytes, limit: limitBytes },
                usedPercent,
                fileCount: raw.file_count || raw.total_files || 0,
                folderCount: raw.folder_count || raw.total_folders || 0,
            });
        } catch (err) {
            console.error('Fetch storage error:', err);
            // Fallback: calculate from loaded files
            const usedBytes = files.reduce((sum, f) => sum + (f.size || 0), 0);
            setStorageInfo({
                quota: { used: usedBytes, limit: STORAGE_LIMIT },
                usedPercent: Math.round((usedBytes / STORAGE_LIMIT) * 100),
                fileCount: files.length,
                folderCount: folders.length,
            });
        }
    }, [files, folders]);

    useEffect(() => { fetchFiles(); }, [fetchFiles]);
    useEffect(() => { fetchStorage(); }, [fetchStorage]);

    // ═════════════════════════════════════════
    //  FOLDER BREADCRUMB
    // ═════════════════════════════════════════
    const fetchBreadcrumb = useCallback(async (folderId) => {
        if (!folderId) {
            setFolderPath([]);
            return;
        }
        // Build breadcrumb from folder navigation history
        // For now, keep the path simple
        setFolderPath((prev) => {
            const idx = prev.findIndex(p => p.id === folderId);
            if (idx >= 0) return prev.slice(0, idx + 1);
            return prev;
        });
    }, []);

    useEffect(() => { fetchBreadcrumb(currentFolder); }, [currentFolder, fetchBreadcrumb]);

    // ═════════════════════════════════════════
    //  NAVIGATION
    // ═════════════════════════════════════════
    const openFolder = useCallback((folderId, folderName) => {
        setFolderPath((prev) => {
            const idx = prev.findIndex(p => p.id === folderId);
            if (idx >= 0) return prev.slice(0, idx + 1);
            return [...prev, { id: folderId, name: folderName || 'Folder' }];
        });
        setCurrentFolder(folderId);
        setSelectedFiles(new Set());
        setCurrentView('drive');
    }, []);

    const goBack = useCallback(() => {
        if (folderPath.length > 1) {
            const parent = folderPath[folderPath.length - 2];
            setCurrentFolder(parent.id);
            setFolderPath((prev) => prev.slice(0, -1));
        } else {
            setCurrentFolder(null);
            setFolderPath([]);
        }
        setSelectedFiles(new Set());
    }, [folderPath]);

    const goToBreadcrumb = useCallback((folderId) => {
        if (!folderId) {
            setCurrentFolder(null);
            setFolderPath([]);
        } else {
            setCurrentFolder(folderId);
            setFolderPath((prev) => {
                const idx = prev.findIndex(p => p.id === folderId);
                if (idx >= 0) return prev.slice(0, idx + 1);
                return prev;
            });
        }
        setSelectedFiles(new Set());
    }, []);

    const switchView = useCallback((viewName) => {
        setCurrentView(viewName);
        setCurrentFolder(null);
        setFolderPath([]);
        setSelectedFiles(new Set());
        setSearchQuery('');
        setFilterType('');
    }, []);

    // ═════════════════════════════════════════
    //  FILE OPERATIONS
    // ═════════════════════════════════════════
    const uploadFiles = useCallback(async (fileList) => {
        if (!fileList || fileList.length === 0) return;

        setUploading(true);
        const queueItems = Array.from(fileList).map((file) => ({
            id: Date.now() + Math.random(),
            file,
            name: file.name,
            size: file.size,
            progress: 0,
            status: 'pending',
        }));

        setUploadQueue(queueItems);

        for (const item of queueItems) {
            try {
                setUploadQueue((prev) =>
                    prev.map((q) => q.id === item.id ? { ...q, status: 'uploading' } : q)
                );

                const formData = new FormData();
                formData.append('file', item.file);
                if (currentFolder) formData.append('folderId', currentFolder);

                await api.upload('/api/drive/upload', formData);

                setUploadQueue((prev) =>
                    prev.map((q) => q.id === item.id ? { ...q, status: 'done', progress: 100 } : q)
                );
            } catch (error) {
                setUploadQueue((prev) =>
                    prev.map((q) => q.id === item.id ? { ...q, status: 'error', error: error.message } : q)
                );
                toast.error(`Failed to upload ${item.name}`);
            }
        }

        setUploading(false);
        toast.success(`Uploaded ${queueItems.length} file(s)`);
        fetchFiles();
        fetchStorage();

        setTimeout(() => setUploadQueue([]), 3000);
    }, [currentFolder, fetchFiles, fetchStorage]);

    const createFolder = useCallback(async (name, color, icon) => {
        try {
            await api.post('/api/drive/folders', {
                name,
                parentId: currentFolder,
                color,
            });
            toast.success('Folder created');
            fetchFiles();
            setShowCreateFolder(false);
        } catch (error) {
            toast.error(error.message || 'Failed to create folder');
        }
    }, [currentFolder, fetchFiles]);

    const deleteItem = useCallback(async (id, type = 'file') => {
        try {
            if (type === 'folder') {
                await api.delete(`/api/drive/folders/${id}`);
            } else {
                await api.delete(`/api/drive/files/${id}`);
            }
            toast.success(currentView === 'trash' ? 'Permanently deleted' : 'Moved to trash');
            fetchFiles();
            fetchStorage();
            setSelectedFiles((prev) => { const next = new Set(prev); next.delete(id); return next; });
        } catch (error) {
            toast.error(error.message || 'Failed to delete');
        }
    }, [currentView, fetchFiles, fetchStorage]);

    const restoreItem = useCallback(async (id, type = 'file') => {
        try {
            if (type === 'folder') {
                await api.patch(`/api/drive/folders/${id}/restore`);
            } else {
                await api.patch(`/api/drive/files/${id}/restore`);
            }
            toast.success(`${type === 'folder' ? 'Folder' : 'File'} restored`);
            fetchFiles();
            fetchStorage();
        } catch (error) {
            toast.error(error.message || 'Failed to restore');
        }
    }, [fetchFiles, fetchStorage]);

    const renameItem = useCallback(async (id, newName) => {
        try {
            await api.patch(`/api/drive/files/${id}`, { name: newName });
            toast.success('Renamed successfully');
            fetchFiles();
            setShowRenameModal(null);
        } catch (error) {
            toast.error(error.message || 'Failed to rename');
        }
    }, [fetchFiles]);

    const moveItem = useCallback(async (id, targetFolderId) => {
        try {
            await api.patch(`/api/drive/files/${id}`, { folder_id: targetFolderId });
            toast.success('Moved successfully');
            fetchFiles();
            setShowMoveModal(null);
        } catch (error) {
            toast.error(error.message || 'Failed to move');
        }
    }, [fetchFiles]);

    const starItem = useCallback(async (id, type = 'file') => {
        try {
            if (type === 'folder') {
                await api.patch(`/api/drive/folders/${id}/star`);
            } else {
                await api.patch(`/api/drive/files/${id}/star`);
            }
            fetchFiles();
        } catch (error) {
            toast.error(error.message || 'Failed to update star');
        }
    }, [fetchFiles]);

    const downloadFile = useCallback(async (fileId, fileName) => {
        try {
            // Get Firebase token for download auth
            const { auth } = await import('../firebase/config');
            const fbUser = auth.currentUser;
            const token = fbUser ? await fbUser.getIdToken() : '';
            const slug = localStorage.getItem('currentCommitteeSlug');
            const url = `http://localhost:5000/api/drive/files/${fileId}/download?token=${token}&committee=${slug}`;
            window.open(url, '_blank');
            toast.success('Download started');
        } catch (error) {
            toast.error(error.message || 'Download failed');
        }
    }, []);

    const emptyTrash = useCallback(async () => {
        try {
            await api.delete('/api/drive/trash');
            toast.success('Trash emptied');
            fetchFiles();
            fetchStorage();
        } catch (error) {
            toast.error(error.message || 'Failed to empty trash');
        }
    }, [fetchFiles, fetchStorage]);


    // ═════════════════════════════════════════
    //  SELECTION
    // ═════════════════════════════════════════
    const selectFile = useCallback((id) => {
        setSelectedFiles((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const selectAll = useCallback(() => {
        const allIds = [...files.map((f) => f.id), ...folders.map((f) => f.id)];
        setSelectedFiles(new Set(allIds));
    }, [files, folders]);

    const clearSelection = useCallback(() => {
        setSelectedFiles(new Set());
    }, []);

    // ═════════════════════════════════════════
    //  SEARCH & FILTER
    // ═════════════════════════════════════════
    const handleSearch = useCallback((query) => {
        setSearchQuery(query);
    }, []);

    const handleFilterType = useCallback((type) => {
        setFilterType(type);
    }, []);

    const handleSort = useCallback((field) => {
        if (field === sortBy) {
            setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortBy(field);
            setSortOrder('desc');
        }
    }, [sortBy]);

    // ═════════════════════════════════════════
    //  DRAG & DROP HELPERS
    // ═════════════════════════════════════════
    const handleDragEnter = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragCounter((c) => c + 1);
    }, []);

    const handleDragLeave = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragCounter((c) => Math.max(0, c - 1));
    }, []);

    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragCounter(0);
        const droppedFiles = Array.from(e.dataTransfer.files);
        if (droppedFiles.length > 0) {
            uploadFiles(droppedFiles);
        }
    }, [uploadFiles]);

    const clearError = useCallback(() => setError(null), []);

    return {
        // State
        files, folders, loading, error, total,
        currentFolder, folderPath, currentView,
        view, sortBy, sortOrder, searchQuery, filterType,
        selectedFiles, previewFile, uploadQueue, uploading,
        storageInfo, contextMenu, dragOver,
        showCreateFolder, showShareModal, showMoveModal, showRenameModal,

        // Actions
        fetchFiles, openFolder, goBack, goToBreadcrumb, switchView,
        uploadFiles, createFolder, deleteItem, restoreItem,
        renameItem, moveItem, starItem, downloadFile, emptyTrash,
        fetchStorage, selectFile, selectAll, clearSelection,
        handleSearch, handleFilterType, handleSort, clearError,

        // Drag & Drop
        handleDragEnter, handleDragLeave, handleDragOver, handleDrop,

        // Setters
        setView, setPreviewFile, setContextMenu,
        setShowCreateFolder, setShowShareModal, setShowMoveModal, setShowRenameModal,
        setSearchQuery, setFilterType,
    };
};

export default useDrive;
