// ============================================
// services/taskService.js — Tasks via PostgreSQL API
// ============================================
// Uses SSE (EventSource) for real-time push updates.
// Falls back to polling if SSE fails.
// ============================================

import api from '../utils/api';
import { auth } from '../firebase/config';

const API_BASE = 'http://localhost:5000';

// ── Event bus for local mutations ──────────────
const listeners = new Set();

export function onTasksMutated(cb) {
    listeners.add(cb);
    return () => listeners.delete(cb);
}

function emitMutation() {
    listeners.forEach((cb) => {
        try { cb(); } catch { /* ignore */ }
    });
}

/**
 * Normalize a task from the API (snake_case) to the frontend (camelCase).
 */
function normalizeTask(t) {
    if (!t) return t;

    let content = t.content;
    if (typeof content === 'string') {
        try {
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed)) {
                content = parsed;
            } else {
                content = content.trim() ? [{ type: 'paragraph', text: content }] : [];
            }
        } catch {
            content = content.trim() ? [{ type: 'paragraph', text: content }] : [];
        }
    } else if (!Array.isArray(content)) {
        content = [];
    }

    return {
        ...t,
        dueDate: t.dueDate || t.due_date || null,
        assignedTo: t.assignedTo || t.assigned_to || null,
        assignedToName: t.assignedToName || t.assignee_name || t.assigned_to_name || null,
        createdBy: t.createdBy || t.created_by || null,
        createdByName: t.createdByName || t.creator_name || t.created_by_name || null,
        createdAt: t.createdAt || t.created_at || null,
        updatedAt: t.updatedAt || t.updated_at || null,
        completedAt: t.completedAt || t.completed_at || null,
        postUrl: t.postUrl || t.post_url || null,
        tags: t.tags || t.labels || [],
        content,
        platform: t.platform || [],
        icon: t.icon || null,
    };
}

/**
 * Create a new task.
 */
export async function createTask(taskData, userId) {
    const data = await api.post('/api/tasks', {
        title: taskData.title,
        description: taskData.description || '',
        due_date: taskData.dueDate || null,
        assigned_to: taskData.assignedTo || null,
        priority: taskData.priority || 'medium',
        status: 'pending',
    });
    emitMutation();
    return normalizeTask(data.task || data);
}

/**
 * Subscribe to tasks with real-time SSE push.
 * - On mount: fetches tasks from the given endpoint
 * - On SSE "task_changed" event from server: re-fetches immediately
 * - Fallback: polls every 30s if SSE dies
 * @param {Function} callback - Receives array of task objects
 * @param {string} [endpoint='/api/tasks'] - API endpoint to fetch from
 * @returns {Function} Cleanup function
 */
export function subscribeTasks(callback, endpoint = '/api/tasks') {
    let active = true;
    let eventSource = null;
    let pollInterval = null;

    const fetchTasks = async () => {
        if (!active) return;
        try {
            const data = await api.get(endpoint);
            if (active) {
                callback((data.tasks || []).map(normalizeTask));
            }
        } catch (error) {
            console.error('Error fetching tasks:', error);
            if (active) callback([]);
        }
    };

    // Initial fetch
    fetchTasks();

    // Re-fetch on local mutations (same tab)
    const unsubMutation = onTasksMutated(fetchTasks);

    // ── SSE connection for cross-user real-time updates ────────
    const connectSSE = async () => {
        if (!active) return;

        try {
            const token = await auth.currentUser?.getIdToken();
            const slug = localStorage.getItem('currentCommitteeSlug');
            if (!token || !slug) {
                // No auth yet, fall back to polling
                startPolling();
                return;
            }

            // EventSource doesn't support custom headers, so we pass token + slug as query params
            const url = `${API_BASE}/api/tasks/events?token=${encodeURIComponent(token)}&committeeSlug=${encodeURIComponent(slug)}`;
            eventSource = new EventSource(url);

            eventSource.addEventListener('connected', () => {
                console.log('  📡 SSE connected — real-time task updates active');
                // Stop polling when SSE is live
                if (pollInterval) {
                    clearInterval(pollInterval);
                    pollInterval = null;
                }
            });

            eventSource.addEventListener('task_changed', (e) => {
                // Server says a task changed — re-fetch immediately
                fetchTasks();
            });

            eventSource.onerror = () => {
                // SSE disconnected — fall back to polling
                console.warn('  ⚠️ SSE disconnected, falling back to polling');
                eventSource?.close();
                eventSource = null;
                startPolling();
                // Try to reconnect SSE after 5 seconds
                if (active) setTimeout(connectSSE, 5000);
            };
        } catch {
            startPolling();
        }
    };

    const startPolling = () => {
        if (!pollInterval && active) {
            pollInterval = setInterval(fetchTasks, 15000);
        }
    };

    // Start SSE connection
    connectSSE();

    return () => {
        active = false;
        unsubMutation();
        eventSource?.close();
        if (pollInterval) clearInterval(pollInterval);
    };
}

/**
 * Subscribe to tasks assigned to the current user.
 */
export function subscribeMyTasks(callback) {
    return subscribeTasks(callback, '/api/tasks/my');
}

/**
 * Subscribe to tasks created by the current user.
 */
export function subscribeCreatedTasks(callback) {
    return subscribeTasks(callback, '/api/tasks/created');
}


/**
 * Update a task's status.
 */
export async function updateTaskStatus(taskId, newStatus) {
    await api.patch(`/api/tasks/${taskId}`, { status: newStatus });
    emitMutation();
}

/**
 * Cleanup completed tasks (no-op on client).
 */
export async function cleanupCompletedTasks(tasks) {
    return 0;
}

/**
 * Subscribe to a single task.
 */
export function subscribeTask(taskId, callback) {
    let active = true;

    const fetchTask = async () => {
        if (document.hidden || !active) return;
        try {
            const data = await api.get(`/api/tasks/${taskId}`);
            if (active) callback(normalizeTask(data.task || null));
        } catch (error) {
            console.error('Error fetching task:', error);
            if (active) callback(null);
        }
    };

    fetchTask();

    const unsubMutation = onTasksMutated(fetchTask);
    const interval = setInterval(fetchTask, 30000);

    return () => {
        active = false;
        clearInterval(interval);
        unsubMutation();
    };
}

/**
 * Update any fields on a task.
 */
export async function updateTask(taskId, updates) {
    await api.patch(`/api/tasks/${taskId}`, updates);
    emitMutation();
}

/**
 * Delete a task.
 */
export async function deleteTask(taskId) {
    await api.delete(`/api/tasks/${taskId}`);
    emitMutation();
}

// ── Comments ──────────────────────────────────────────

export async function addComment(taskId, commentData) {
    try {
        return await api.post(`/api/tasks/${taskId}/comments`, commentData);
    } catch {
        console.warn('Comments endpoint not available');
    }
}

export function subscribeComments(taskId, callback) {
    let active = true;

    const fetchComments = async () => {
        try {
            const data = await api.get(`/api/tasks/${taskId}/comments`);
            if (active) callback(data.comments || []);
        } catch {
            if (active) callback([]);
        }
    };

    fetchComments();
    const interval = setInterval(fetchComments, 10000);

    return () => {
        active = false;
        clearInterval(interval);
    };
}

export async function updateComment(taskId, commentId, updates) {
    try {
        await api.patch(`/api/tasks/${taskId}/comments/${commentId}`, updates);
    } catch {
        console.warn('Update comment endpoint not available');
    }
}

export async function deleteComment(taskId, commentId) {
    try {
        await api.delete(`/api/tasks/${taskId}/comments/${commentId}`);
    } catch {
        console.warn('Delete comment endpoint not available');
    }
}

export async function toggleReaction(taskId, commentId, emoji, userId) {
    try {
        await api.post(`/api/tasks/${taskId}/comments/${commentId}/reactions`, { emoji, userId });
    } catch {
        console.warn('Reactions endpoint not available');
    }
}
