// ============================================
// utils/api.js — API Client (Firebase Token Auth)
// ============================================
// Sends Firebase ID token as Authorization header.
// Injects X-Committee-Slug for committee-scoped requests.
// ============================================

import { auth } from '../firebase/config';

const API_BASE = 'http://localhost:5000';

class ApiClient {
    /**
     * Get Firebase ID token for the current user.
     */
    async _getToken() {
        const user = auth.currentUser;
        if (!user) return null;
        try {
            return await user.getIdToken();
        } catch (e) {
            console.error('Failed to get Firebase token:', e);
            return null;
        }
    }

    /**
     * Get the current committee slug from localStorage.
     */
    _getSlug() {
        return localStorage.getItem('currentCommitteeSlug');
    }

    /**
     * Make an API request with Firebase token + committee slug headers.
     */
    async request(method, path, body = null, options = {}) {
        const token = await this._getToken();
        const slug = this._getSlug();

        const headers = {
            ...(options.headers || {}),
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        if (slug) {
            headers['X-Committee-Slug'] = slug;
        }

        // Only set Content-Type for non-FormData bodies
        if (body && !(body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }

        const config = {
            method,
            headers,
        };

        if (body) {
            config.body = body instanceof FormData ? body : JSON.stringify(body);
        }

        const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
        const response = await fetch(url, config);

        // Handle auth errors
        if (response.status === 401) {
            console.warn('API: Unauthorized — Firebase token may be expired');
            // Firebase will auto-refresh tokens, but if we're here the user may be logged out
            throw new Error('Authentication expired. Please log in again.');
        }

        if (response.status === 403) {
            const data = await response.json().catch(() => ({}));
            if (data.code === 'NOT_A_MEMBER') {
                // Not a member of this committee — redirect to committee selection
                localStorage.removeItem('currentCommitteeSlug');
                localStorage.removeItem('currentCommitteeName');
                localStorage.removeItem('currentCommitteeColor');
                window.location.href = '/select-committee';
                throw new Error('Not a member of this committee.');
            }
            throw new Error(data.error || 'Forbidden');
        }

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error || `Request failed (${response.status})`);
        }

        // Handle empty responses (204 No Content)
        if (response.status === 204) return {};

        return response.json();
    }

    // Convenience methods
    get(path, params = {}) {
        const query = new URLSearchParams();
        Object.entries(params).forEach(([key, val]) => {
            if (val !== undefined && val !== null && val !== '') {
                query.append(key, val);
            }
        });
        const queryStr = query.toString();
        const fullPath = queryStr ? `${path}?${queryStr}` : path;
        return this.request('GET', fullPath);
    }

    post(path, body) {
        return this.request('POST', path, body);
    }

    patch(path, body) {
        return this.request('PATCH', path, body);
    }

    delete(path) {
        return this.request('DELETE', path);
    }

    upload(path, formData) {
        return this.request('POST', path, formData);
    }
}

const api = new ApiClient();
export default api;
