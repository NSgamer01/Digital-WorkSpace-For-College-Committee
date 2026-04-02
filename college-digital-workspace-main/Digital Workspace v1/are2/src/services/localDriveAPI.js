/**
 * ============================================================================
 * LOCAL DRIVE API — React Service for PostgreSQL Backend
 * ============================================================================
 *
 * Complete API service for the College Workspace file storage system.
 * Uses axios for HTTP requests with upload progress support.
 *
 * Usage:
 *   import localDriveAPI from './services/localDriveAPI';
 *   localDriveAPI.setAuthToken(token);
 *   const { files, folders } = await localDriveAPI.listFiles({ folderId });
 */

import axios from 'axios';

// ── Configuration ───────────────────────────────────────────────────────────
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// ── Axios instance ──────────────────────────────────────────────────────────
const api = axios.create({
    baseURL: API_URL,
    timeout: 60000,
    // NOTE: Do NOT set default Content-Type here.
    // Axios auto-detects: 'application/json' for objects, 'multipart/form-data' for FormData.
    // Setting it here would override FormData auto-detection and break file uploads (413 error).
});

// Retry config — retries 500/network errors with exponential backoff
const RETRY_COUNT = 2;
const RETRY_DELAY = 1000; // ms, doubles each attempt

// ── Token storage ───────────────────────────────────────────────────────────
let _authToken = localStorage.getItem('workspace_token') || null;

// ── Request interceptor — attach Bearer token ───────────────────────────────
api.interceptors.request.use(
    (config) => {
        if (_authToken) {
            config.headers.Authorization = `Bearer ${_authToken}`;
        }
        return config;
    },
    (error) => Promise.reject(error),
);

// ── Response interceptor — normalise errors + auto-retry on 500/network ─────
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const config = error.config;

        // --- Retry logic for 500 / network errors ---
        if (!config._retryCount) config._retryCount = 0;
        const status = error.response?.status;
        const isRetryable = !status || status >= 500; // network error or 5xx
        const isNotAuth = status !== 401 && status !== 403;

        if (isRetryable && isNotAuth && config._retryCount < RETRY_COUNT) {
            config._retryCount++;
            const delay = RETRY_DELAY * Math.pow(2, config._retryCount - 1);
            await new Promise((r) => setTimeout(r, delay));
            return api(config); // retry the request
        }

        // --- Normalise errors ---
        if (!error.response) {
            const netErr = new Error('Server not reachable. Make sure the backend is running.');
            netErr.code = 'NETWORK_ERROR';
            return Promise.reject(netErr);
        }

        const { data } = error.response;
        const message = data?.error || data?.message || 'Something went wrong';
        const apiError = new Error(message);
        apiError.status = status;

        switch (status) {
            case 401:
                apiError.code = 'UNAUTHORIZED';
                apiError.tokenExpired = !!data?.tokenExpired;
                _authToken = null;
                localStorage.removeItem('workspace_token');
                break;
            case 403: apiError.code = 'FORBIDDEN'; break;
            case 404: apiError.code = 'NOT_FOUND'; break;
            case 413:
                apiError.code = 'FILE_TOO_LARGE';
                apiError.message = data?.error || 'File exceeds the maximum allowed size (100 MB).';
                break;
            case 415: apiError.code = 'UNSUPPORTED_TYPE'; break;
            default: apiError.code = 'SERVER_ERROR';
        }

        return Promise.reject(apiError);
    },
);

// ═════════════════════════════════════════════════════════════════════════════
//  SERVICE OBJECT
// ═════════════════════════════════════════════════════════════════════════════

const localDriveAPI = {
    // ─────────────────────────────────────────────────────────────────────────
    //  TOKEN MANAGEMENT
    // ─────────────────────────────────────────────────────────────────────────
    setAuthToken(token) {
        _authToken = token;
        if (token) localStorage.setItem('workspace_token', token);
        else localStorage.removeItem('workspace_token');
    },

    getAuthToken() {
        return _authToken;
    },

    // ─────────────────────────────────────────────────────────────────────────
    //  AUTH
    // ─────────────────────────────────────────────────────────────────────────

    async register(email, password, name, role, department) {
        const { data } = await api.post('/auth/register', { email, password, name, role, department });
        if (data.token) this.setAuthToken(data.token);
        return data;
    },

    async login(email, password) {
        const { data } = await api.post('/auth/login', { email, password });
        if (data.token) this.setAuthToken(data.token);
        return data;
    },

    async getMe() {
        const { data } = await api.get('/auth/me');
        return data;
    },

    async getUsers() {
        const { data } = await api.get('/auth/users');
        return data.users;
    },

    async updateProfile(profileData) {
        const { data } = await api.patch('/auth/profile', profileData);
        return data;
    },

    // ─────────────────────────────────────────────────────────────────────────
    //  FILE OPERATIONS
    // ─────────────────────────────────────────────────────────────────────────

    async uploadFile(file, folderId = null, onProgress) {
        const formData = new FormData();
        formData.append('file', file);
        if (folderId) formData.append('folderId', folderId);

        const { data } = await api.post('/drive/upload', formData, {
            headers: { 'Content-Type': undefined }, // let axios set multipart boundary
            timeout: 600000,
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            onUploadProgress: (e) => {
                if (onProgress && e.total) {
                    onProgress({
                        loaded: e.loaded,
                        total: e.total,
                        percent: Math.round((e.loaded / e.total) * 100),
                    });
                }
            },
        });

        return data.file;
    },

    async uploadMultiple(files, folderId = null, onProgress) {
        const formData = new FormData();
        for (const file of files) {
            formData.append('files', file);
        }
        if (folderId) formData.append('folderId', folderId);

        const { data } = await api.post('/drive/upload-multiple', formData, {
            headers: { 'Content-Type': undefined },
            timeout: 600000,
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            onUploadProgress: (e) => {
                if (onProgress && e.total) {
                    onProgress({
                        loaded: e.loaded,
                        total: e.total,
                        percent: Math.round((e.loaded / e.total) * 100),
                    });
                }
            },
        });

        return data;
    },

    async listFiles({ folderId = null, search, type, sort, order, page, limit } = {}) {
        const params = {};
        if (folderId) params.folderId = folderId;
        if (search) params.search = search;
        if (type) params.type = type;
        if (sort) params.sort = sort;
        if (order) params.order = order;
        if (page) params.page = page;
        if (limit) params.limit = limit;

        const { data } = await api.get('/drive/files', { params });
        return data; // { files, folders, total, page, limit, hasMore }
    },

    async getFileDetails(fileId) {
        const { data } = await api.get(`/drive/files/${fileId}`);
        return data.file;
    },

    async downloadFile(fileId, fileName) {
        const { data } = await api.get(`/drive/files/${fileId}/download`, {
            responseType: 'blob',
            timeout: 600000,
        });

        const url = window.URL.createObjectURL(data);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName || 'download';
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
            window.URL.revokeObjectURL(url);
            document.body.removeChild(link);
        }, 100);
    },

    getPreviewUrl(fileId) {
        // Include token as query param so <img>, <iframe>, <video> can authenticate
        const token = _authToken || '';
        return `${API_URL}/drive/files/${fileId}/preview${token ? `?token=${token}` : ''}`;
    },

    async renameFile(fileId, name) {
        const { data } = await api.patch(`/drive/files/${fileId}/rename`, { name });
        return data.file;
    },

    async moveFile(fileId, folderId) {
        const { data } = await api.patch(`/drive/files/${fileId}/move`, { folderId });
        return data;
    },

    async copyFile(fileId, name, folderId) {
        const { data } = await api.post(`/drive/files/${fileId}/copy`, { name, folderId });
        return data.file;
    },

    async starFile(fileId, starred) {
        const { data } = await api.patch(`/drive/files/${fileId}/star`, { starred });
        return data;
    },

    async trashFile(fileId) {
        const { data } = await api.patch(`/drive/files/${fileId}/trash`);
        return data;
    },

    async restoreFile(fileId) {
        const { data } = await api.patch(`/drive/files/${fileId}/restore`);
        return data;
    },

    async deleteFile(fileId) {
        const { data } = await api.delete(`/drive/files/${fileId}`);
        return data;
    },

    // ─────────────────────────────────────────────────────────────────────────
    //  TRASH
    // ─────────────────────────────────────────────────────────────────────────

    async getTrash() {
        const { data } = await api.get('/drive/trash');
        return data;
    },

    async emptyTrash() {
        const { data } = await api.delete('/drive/trash/empty');
        return data;
    },

    async restoreAll() {
        const { data } = await api.patch('/drive/trash/restore-all');
        return data;
    },

    // ─────────────────────────────────────────────────────────────────────────
    //  STARRED & RECENT
    // ─────────────────────────────────────────────────────────────────────────

    async getStarred() {
        const { data } = await api.get('/drive/starred');
        return data;
    },

    async getRecent() {
        const { data } = await api.get('/drive/recent');
        return data;
    },

    // ─────────────────────────────────────────────────────────────────────────
    //  SEARCH
    // ─────────────────────────────────────────────────────────────────────────

    async searchFiles(query, filters = {}) {
        const params = { q: query, ...filters };
        const { data } = await api.get('/drive/search', { params });
        return data;
    },

    // ─────────────────────────────────────────────────────────────────────────
    //  FOLDERS
    // ─────────────────────────────────────────────────────────────────────────

    async createFolder(name, parentId = null, color, icon) {
        const { data } = await api.post('/drive/folders', { name, parentId, color, icon });
        return data.folder;
    },

    async listFolders(parentId = null) {
        const params = {};
        if (parentId) params.parentId = parentId;
        const { data } = await api.get('/drive/folders', { params });
        return data.folders;
    },

    async updateFolder(folderId, updates) {
        const { data } = await api.patch(`/drive/folders/${folderId}`, updates);
        return data.folder;
    },

    async starFolder(folderId, starred) {
        const { data } = await api.patch(`/drive/folders/${folderId}/star`, { starred });
        return data;
    },

    async deleteFolder(folderId) {
        const { data } = await api.delete(`/drive/folders/${folderId}`);
        return data;
    },

    async trashFolder(folderId) {
        const { data } = await api.patch(`/drive/folders/${folderId}/trash`);
        return data;
    },

    async moveFolder(folderId, parentId) {
        const { data } = await api.patch(`/drive/folders/${folderId}/move`, { parentId });
        return data;
    },

    async getFolderPath(folderId) {
        const { data } = await api.get(`/drive/folders/${folderId}/path`);
        return data.path;
    },

    async getFolderContents(folderId) {
        const { data } = await api.get(`/drive/folders/${folderId}/contents`);
        return data;
    },

    async restoreFolder(folderId) {
        const { data } = await api.patch(`/drive/folders/${folderId}/restore`);
        return data;
    },

    async reorderFolders(items) {
        // items: [{ id, position }]
        const { data } = await api.patch('/drive/folders/reorder', { items });
        return data;
    },

    async shareFolder(folderId, userId, permission = 'view') {
        const { data } = await api.post(`/drive/folders/${folderId}/share`, { userId, permission });
        return data;
    },

    async getFolderShares(folderId) {
        const { data } = await api.get(`/drive/folders/${folderId}/shares`);
        return data.shares;
    },

    async deleteFolderShare(shareId) {
        const { data } = await api.delete(`/drive/folder-shares/${shareId}`);
        return data;
    },

    // ─────────────────────────────────────────────────────────────────────────
    //  SHARING
    // ─────────────────────────────────────────────────────────────────────────

    async shareFile(fileId, options = {}) {
        const { data } = await api.post(`/drive/files/${fileId}/share`, options);
        return data;
    },

    async getShares(fileId) {
        const { data } = await api.get(`/drive/files/${fileId}/shares`);
        return data.shares;
    },

    async deleteShare(shareId) {
        const { data } = await api.delete(`/drive/shares/${shareId}`);
        return data;
    },

    // ─────────────────────────────────────────────────────────────────────────
    //  COMMENTS
    // ─────────────────────────────────────────────────────────────────────────

    async getComments(fileId) {
        const { data } = await api.get(`/drive/files/${fileId}/comments`);
        return data.comments;
    },

    async addComment(fileId, comment, parentId) {
        const { data } = await api.post(`/drive/files/${fileId}/comments`, { comment, parentCommentId: parentId });
        return data.comment;
    },

    async deleteComment(commentId) {
        const { data } = await api.delete(`/drive/comments/${commentId}`);
        return data;
    },

    // ─────────────────────────────────────────────────────────────────────────
    //  TAGS
    // ─────────────────────────────────────────────────────────────────────────

    async getTags() {
        const { data } = await api.get('/drive/tags');
        return data.tags;
    },

    async createTag(name, color) {
        const { data } = await api.post('/drive/tags', { name, color });
        return data.tag;
    },

    async addTag(fileId, tagId) {
        const { data } = await api.post(`/drive/files/${fileId}/tags`, { tagId });
        return data;
    },

    async removeTag(fileId, tagId) {
        const { data } = await api.delete(`/drive/files/${fileId}/tags/${tagId}`);
        return data;
    },

    // ─────────────────────────────────────────────────────────────────────────
    //  ANALYTICS
    // ─────────────────────────────────────────────────────────────────────────

    async getStorage() {
        const { data } = await api.get('/drive/storage');
        return data;
    },

    async getActivity(filters = {}) {
        const { data } = await api.get('/drive/activity', { params: filters });
        return data.activities;
    },

    async getLargestFiles() {
        const { data } = await api.get('/drive/largest-files');
        return data.files;
    },

    async getFileTypes() {
        const { data } = await api.get('/drive/file-types');
        return data.types;
    },

    async getDuplicates() {
        const { data } = await api.get('/drive/duplicates');
        return data.duplicates;
    },

    // ─────────────────────────────────────────────────────────────────────────
    //  VERSIONS
    // ─────────────────────────────────────────────────────────────────────────

    async getVersions(fileId) {
        const { data } = await api.get(`/drive/files/${fileId}/versions`);
        return data;
    },

    // ─────────────────────────────────────────────────────────────────────────
    //  UTILITY
    // ─────────────────────────────────────────────────────────────────────────

    async healthCheck() {
        const { data } = await api.get('/health');
        return data;
    },

    /** Toggle star — convenience wrapper */
    async toggleStar(fileId) {
        const { data } = await api.patch(`/drive/files/${fileId}/star`);
        return data;
    },
};

export default localDriveAPI;
