// ============================================
// config/api.js — API Configuration & Fetch Helper
// ============================================

export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Make an authenticated API request.
 * Automatically attaches JWT token and handles errors.
 *
 * @param {string} endpoint — API path (e.g. '/auth/login')
 * @param {object} options — fetch options
 * @returns {Promise<object>} — parsed JSON response
 */
export async function apiRequest(endpoint, options = {}) {
    const token = localStorage.getItem('workspace_token');

    const headers = { ...options.headers };

    // Attach auth token
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    // Set Content-Type for non-FormData bodies
    if (options.body && !(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
        if (typeof options.body === 'object') {
            options.body = JSON.stringify(options.body);
        }
    }

    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers,
        });

        // Handle 401 — redirect to login
        if (response.status === 401) {
            localStorage.removeItem('workspace_token');
            localStorage.removeItem('workspace_user');
            // Only redirect if not already on login page
            if (!window.location.pathname.includes('/')) {
                window.location.href = '/';
            }
            throw new Error('Session expired, please login again');
        }

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            const error = new Error(data.error || data.message || 'Something went wrong');
            error.status = response.status;
            throw error;
        }

        return data;
    } catch (error) {
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            const netErr = new Error('Server not reachable. Make sure the backend is running.');
            netErr.code = 'NETWORK_ERROR';
            throw netErr;
        }
        throw error;
    }
}
