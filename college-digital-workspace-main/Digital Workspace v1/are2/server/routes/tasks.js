// ============================================
// routes/tasks.js
// ============================================
// Task management routes using req.committeeDb.
// User names/avatars enriched from masterDb.
//
// Visibility: users see tasks they created, tasks
// assigned to them, and unassigned tasks. Admins/
// heads/advisors see ALL tasks.
//
// Notifications: task assignment, reassignment,
// completion, and updates trigger notifications
// (in-app + email).
// ============================================

const express = require('express');
const router = express.Router();

// Email helpers (fire-and-forget)
let sendTaskAssignmentEmail, sendTaskUpdateEmail, sendTaskCompletedEmail;
try {
    const taskEmail = require('./taskEmail');
    sendTaskAssignmentEmail = taskEmail.sendTaskAssignmentEmail;
    sendTaskUpdateEmail = taskEmail.sendTaskUpdateEmail;
    sendTaskCompletedEmail = taskEmail.sendTaskCompletedEmail;
} catch {
    console.warn('  ⚠️  taskEmail module not found — task emails disabled');
    sendTaskAssignmentEmail = async () => { };
    sendTaskUpdateEmail = async () => { };
    sendTaskCompletedEmail = async () => { };
}

// ── enrichWithUserNames helper ──────────────────
async function enrichWithUserNames(masterDb, rows, userIdFields) {
    if (!rows || rows.length === 0) return rows;

    const fields = Array.isArray(userIdFields) ? userIdFields : [userIdFields];
    const userIds = new Set();

    for (const row of rows) {
        for (const field of fields) {
            if (row[field]) userIds.add(row[field]);
        }
    }

    if (userIds.size === 0) return rows;

    const userIdsArray = Array.from(userIds);
    const placeholders = userIdsArray.map((_, i) => `$${i + 1}`).join(', ');
    const result = await masterDb.query(
        `SELECT id, name, email, avatar FROM users WHERE id IN (${placeholders})`,
        userIdsArray
    );

    const userMap = {};
    for (const user of result.rows) {
        userMap[user.id] = user;
    }

    for (const row of rows) {
        for (const field of fields) {
            if (row[field] && userMap[row[field]]) {
                const prefix = field.replace(/_id$/, '').replace(/_by$/, '').replace(/_to$/, '');
                row[`${prefix}_name`] = userMap[row[field]].name;
                row[`${prefix}_email`] = userMap[row[field]].email;
                row[`${prefix}_avatar`] = userMap[row[field]].avatar;
            }
        }
    }

    return rows;
}

// ── Helper: fetch user info from masterDb ───────
async function getUserInfo(masterDb, userId) {
    if (!userId) return null;
    try {
        const result = await masterDb.query(
            `SELECT id, name, email, avatar FROM users WHERE id = $1`,
            [userId]
        );
        return result.rows[0] || null;
    } catch {
        return null;
    }
}

// ── Helper: admin/head/advisor roles that see all tasks ──
const ADMIN_ROLES = ['head', 'admin', 'advisor'];

// ══════════════════════════════════════════════════
// GET / — List tasks with visibility filtering
// ══════════════════════════════════════════════════
router.get('/', async (req, res) => {
    try {
        const { status, assignedTo, priority } = req.query;
        const db = req.committeeDb;

        let query = `SELECT * FROM tasks WHERE 1=1`;
        const params = [];
        let idx = 1;

        // ── Visibility filter (THE KEY FIX) ──────────
        // Admin/head/advisor see everything.
        // Regular members only see tasks they created,
        // tasks assigned to them, or unassigned tasks.
        if (!ADMIN_ROLES.includes(req.committeeRole)) {
            query += ` AND (created_by = $${idx} OR assigned_to = $${idx} OR assigned_to IS NULL)`;
            params.push(req.user.userId);
            idx++;
        }

        // Optional filters
        if (status) {
            query += ` AND status = $${idx++}`;
            params.push(status);
        }
        if (assignedTo) {
            query += ` AND assigned_to = $${idx++}`;
            params.push(assignedTo);
        }
        if (priority) {
            query += ` AND priority = $${idx++}`;
            params.push(priority);
        }

        query += ` ORDER BY
      CASE priority
        WHEN 'urgent' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        WHEN 'low' THEN 4
        ELSE 5
      END,
      created_at DESC`;

        const result = await db.query(query, params);

        const enriched = await enrichWithUserNames(req.masterDb, result.rows, ['created_by', 'assigned_to']);

        res.json({
            success: true,
            tasks: enriched,
            total: enriched.length,
        });
    } catch (err) {
        console.error('List tasks error:', err.message);
        res.status(500).json({ error: 'Failed to list tasks.' });
    }
});

// ══════════════════════════════════════════════════
// GET /my — Tasks assigned to the current user
// ══════════════════════════════════════════════════
router.get('/my', async (req, res) => {
    try {
        const db = req.committeeDb;
        const result = await db.query(
            `SELECT * FROM tasks
             WHERE assigned_to = $1
             ORDER BY
               CASE status WHEN 'todo' THEN 1 WHEN 'pending' THEN 1
                           WHEN 'in_progress' THEN 2 WHEN 'inprogress' THEN 2
                           WHEN 'review' THEN 3
                           WHEN 'done' THEN 4 WHEN 'complete' THEN 4
                           ELSE 5 END,
               CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 ELSE 5 END,
               due_date ASC NULLS LAST`,
            [req.user.userId]
        );

        const enriched = await enrichWithUserNames(req.masterDb, result.rows, ['created_by', 'assigned_to']);

        res.json({ success: true, tasks: enriched, total: enriched.length });
    } catch (err) {
        console.error('My tasks error:', err.message);
        res.status(500).json({ error: 'Failed to fetch my tasks.' });
    }
});

// ══════════════════════════════════════════════════
// GET /created — Tasks created by the current user
// ══════════════════════════════════════════════════
router.get('/created', async (req, res) => {
    try {
        const db = req.committeeDb;
        const result = await db.query(
            `SELECT * FROM tasks
             WHERE created_by = $1
             ORDER BY created_at DESC`,
            [req.user.userId]
        );

        const enriched = await enrichWithUserNames(req.masterDb, result.rows, ['created_by', 'assigned_to']);

        res.json({ success: true, tasks: enriched, total: enriched.length });
    } catch (err) {
        console.error('Created tasks error:', err.message);
        res.status(500).json({ error: 'Failed to fetch created tasks.' });
    }
});

// ══════════════════════════════════════════════════
// POST / — Create a task
// ══════════════════════════════════════════════════
router.post('/', async (req, res) => {
    try {
        const { title, description, status, priority, assigned_to, due_date, labels, attachments } = req.body;
        const db = req.committeeDb;

        // Backend permissions check: 'member' is not allowed to create tasks
        if (req.committeeRole === 'member') {
            return res.status(403).json({ error: 'Members are not authorized to create tasks.' });
        }

        if (!title) {
            return res.status(400).json({ error: 'Task title is required.' });
        }

        const result = await db.query(
            `INSERT INTO tasks (title, description, status, priority, created_by, assigned_to, due_date, labels, attachments)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
            [
                title.trim(),
                description || null,
                status || 'todo',
                priority || 'medium',
                req.user.userId,
                assigned_to || null,
                due_date || null,
                labels || [],
                JSON.stringify(attachments || []),
            ]
        );

        const task = result.rows[0];

        // Log activity
        await db.query(
            `INSERT INTO activity_log (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
            [req.user.userId, 'created_task', 'task', task.id, JSON.stringify({ title: title.trim() }), req.ip]
        );

        // ── Notify assignee (in-app + email) ─────────
        if (assigned_to && assigned_to !== req.user.userId) {
            // Fetch creator name
            const creator = await getUserInfo(req.masterDb, req.user.userId);
            const creatorName = creator?.name || 'Someone';

            // Insert notification
            await db.query(
                `INSERT INTO notifications (user_id, type, title, message, link)
         VALUES ($1, $2, $3, $4, $5)`,
                [
                    assigned_to,
                    'task_assigned',
                    'New Task Assigned',
                    `${creatorName} assigned you a task: "${title.trim()}"`,
                    `/tasks/${task.id}`,
                ]
            );

            // Send email (fire-and-forget)
            const assignee = await getUserInfo(req.masterDb, assigned_to);
            if (assignee?.email) {
                sendTaskAssignmentEmail({
                    assigneeEmail: assignee.email,
                    assigneeName: assignee.name,
                    taskTitle: title.trim(),
                    taskDescription: description || '',
                    dueDate: due_date,
                    priority: priority || 'medium',
                    creatorName,
                    committeeName: req.committeeName || '',
                }).catch(err => console.error('  ❌ Task email error:', err.message));
            }
        }

        const enriched = await enrichWithUserNames(req.masterDb, [task], ['created_by', 'assigned_to']);

        res.status(201).json({
            success: true,
            task: enriched[0],
        });
    } catch (err) {
        console.error('Create task error:', err.message);
        res.status(500).json({ error: 'Failed to create task.' });
    }
});

// ══════════════════════════════════════════════════
// PATCH /:id — Update a task
// ══════════════════════════════════════════════════
router.patch('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const db = req.committeeDb;

        // Fetch original task for change detection
        const original = await db.query(`SELECT * FROM tasks WHERE id = $1`, [id]);
        if (original.rowCount === 0) {
            return res.status(404).json({ error: 'Task not found.' });
        }
        const oldTask = original.rows[0];

        // Map frontend camelCase names → DB snake_case columns
        const fieldMap = {
            title: 'title',
            description: 'description',
            content: 'content',
            status: 'status',
            priority: 'priority',
            assigned_to: 'assigned_to',
            assignedTo: 'assigned_to',
            due_date: 'due_date',
            dueDate: 'due_date',
            labels: 'labels',
            tags: 'labels',               // TaskDetail sends 'tags'
            attachments: 'attachments',
            platform: 'platform',
            icon: 'icon',
            postUrl: 'post_url',
            post_url: 'post_url',
        };

        const updates = [];
        const values = [];
        let paramIndex = 1;
        const seenColumns = new Set();

        for (const [bodyField, dbColumn] of Object.entries(fieldMap)) {
            if (req.body[bodyField] !== undefined && !seenColumns.has(dbColumn)) {
                seenColumns.add(dbColumn);
                let val = req.body[bodyField];

                // Sanitize timestamp columns — empty strings and invalid dates → null
                if (dbColumn === 'due_date') {
                    if (!val || val === '' || (typeof val === 'string' && val.includes('NaN'))) {
                        val = null;
                    }
                }

                // Serialize arrays/objects for JSON/JSONB columns
                if (['attachments', 'content', 'platform'].includes(dbColumn) && typeof val === 'object' && val !== null) {
                    updates.push(`${dbColumn} = $${paramIndex++}`);
                    values.push(JSON.stringify(val));
                } else {
                    updates.push(`${dbColumn} = $${paramIndex++}`);
                    values.push(val);
                }
            }
        }

        // Auto-set completed_at when status is a completed variant
        const completedStatuses = ['done', 'completed', 'Completed', 'complete'];
        if (completedStatuses.includes(req.body.status)) {
            updates.push(`completed_at = NOW()`);
        } else if (req.body.status && !completedStatuses.includes(req.body.status)) {
            updates.push(`completed_at = NULL`);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No valid fields to update.' });
        }

        updates.push(`updated_at = NOW()`);
        values.push(id);

        const result = await db.query(
            `UPDATE tasks SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
            values
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Task not found.' });
        }

        const updatedTask = result.rows[0];
        const enriched = await enrichWithUserNames(req.masterDb, result.rows, ['created_by', 'assigned_to']);

        // ── Notification logic (fire-and-forget) ─────

        // Determine new values
        const newStatus = req.body.status || req.body.status === '' ? req.body.status : null;
        const newAssignedTo = seenColumns.has('assigned_to') ? updatedTask.assigned_to : null;
        const oldAssignedTo = oldTask.assigned_to;
        const updaterName = (await getUserInfo(req.masterDb, req.user.userId))?.name || 'Someone';

        // 1. Task reassigned → notify new assignee
        if (seenColumns.has('assigned_to') && newAssignedTo && newAssignedTo !== oldAssignedTo && newAssignedTo !== req.user.userId) {
            const assignee = await getUserInfo(req.masterDb, newAssignedTo);
            await db.query(
                `INSERT INTO notifications (user_id, type, title, message, link)
                 VALUES ($1, $2, $3, $4, $5)`,
                [
                    newAssignedTo,
                    'task_assigned',
                    'New Task Assigned',
                    `${updaterName} assigned you a task: "${updatedTask.title}"`,
                    `/tasks/${id}`,
                ]
            ).catch(() => { });

            if (assignee?.email) {
                sendTaskAssignmentEmail({
                    assigneeEmail: assignee.email,
                    assigneeName: assignee.name,
                    taskTitle: updatedTask.title,
                    taskDescription: updatedTask.description || '',
                    dueDate: updatedTask.due_date,
                    priority: updatedTask.priority,
                    creatorName: updaterName,
                    committeeName: req.committeeName || '',
                }).catch(() => { });
            }

            // Notify old assignee they were unassigned
            if (oldAssignedTo && oldAssignedTo !== req.user.userId) {
                await db.query(
                    `INSERT INTO notifications (user_id, type, title, message, link)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [
                        oldAssignedTo,
                        'task_updated',
                        'Task Unassigned',
                        `You have been unassigned from: "${updatedTask.title}"`,
                        `/tasks/${id}`,
                    ]
                ).catch(() => { });
            }
        }

        // 2. Status changed to done → notify creator
        if (newStatus && completedStatuses.includes(newStatus) && !completedStatuses.includes(oldTask.status)) {
            const creatorId = updatedTask.created_by;
            if (creatorId && creatorId !== req.user.userId) {
                const creator = await getUserInfo(req.masterDb, creatorId);
                await db.query(
                    `INSERT INTO notifications (user_id, type, title, message, link)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [
                        creatorId,
                        'task_completed',
                        'Task Completed',
                        `${updaterName} completed: "${updatedTask.title}"`,
                        `/tasks/${id}`,
                    ]
                ).catch(() => { });

                if (creator?.email) {
                    sendTaskCompletedEmail({
                        creatorEmail: creator.email,
                        creatorName: creator.name,
                        taskTitle: updatedTask.title,
                        completedByName: updaterName,
                        committeeName: req.committeeName || '',
                    }).catch(() => { });
                }
            }
        }

        // 3. Other updates → notify assignee (if updater ≠ assignee)
        else if (updatedTask.assigned_to && updatedTask.assigned_to !== req.user.userId) {
            // Only if meaningful fields changed (status, priority, due_date)
            const changes = {};
            if (newStatus && newStatus !== oldTask.status) changes['Status'] = `${oldTask.status} → ${newStatus}`;
            if (req.body.priority && req.body.priority !== oldTask.priority) changes['Priority'] = `${oldTask.priority} → ${req.body.priority}`;
            if (seenColumns.has('due_date') && String(updatedTask.due_date) !== String(oldTask.due_date)) changes['Due date'] = 'Updated';

            if (Object.keys(changes).length > 0) {
                const assignee = await getUserInfo(req.masterDb, updatedTask.assigned_to);
                await db.query(
                    `INSERT INTO notifications (user_id, type, title, message, link)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [
                        updatedTask.assigned_to,
                        'task_updated',
                        'Task Updated',
                        `${updaterName} updated: "${updatedTask.title}" — ${Object.entries(changes).map(([k, v]) => `${k}: ${v}`).join(', ')}`,
                        `/tasks/${id}`,
                    ]
                ).catch(() => { });

                if (assignee?.email) {
                    sendTaskUpdateEmail({
                        assigneeEmail: assignee.email,
                        assigneeName: assignee.name,
                        taskTitle: updatedTask.title,
                        changes,
                        updaterName,
                        committeeName: req.committeeName || '',
                    }).catch(() => { });
                }
            }
        }

        res.json({
            success: true,
            task: enriched[0],
        });
    } catch (err) {
        console.error('Update task error:', err.message);
        res.status(500).json({ error: 'Failed to update task.' });
    }
});

// ══════════════════════════════════════════════════
// DELETE /:id — Hard delete a task
// ══════════════════════════════════════════════════
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const db = req.committeeDb;

        const result = await db.query(
            `DELETE FROM tasks WHERE id = $1 RETURNING id, title, assigned_to, created_by`,
            [id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Task not found.' });
        }

        const deleted = result.rows[0];

        // Log activity
        await db.query(
            `INSERT INTO activity_log (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
            [req.user.userId, 'deleted_task', 'task', id, JSON.stringify({ title: deleted.title }), req.ip]
        );

        // Notify assignee if task had one (and deleter isn't the assignee)
        if (deleted.assigned_to && deleted.assigned_to !== req.user.userId) {
            const deleterName = (await getUserInfo(req.masterDb, req.user.userId))?.name || 'Someone';
            await db.query(
                `INSERT INTO notifications (user_id, type, title, message, link)
                 VALUES ($1, $2, $3, $4, $5)`,
                [
                    deleted.assigned_to,
                    'task_updated',
                    'Task Deleted',
                    `${deleterName} deleted task: "${deleted.title}"`,
                    `/tasks`,
                ]
            ).catch(() => { });
        }

        res.json({
            success: true,
            message: 'Task deleted.',
        });
    } catch (err) {
        console.error('Delete task error:', err.message);
        res.status(500).json({ error: 'Failed to delete task.' });
    }
});

// ══════════════════════════════════════════════════
// GET /stats — Task statistics (MUST be before /:id)
// ══════════════════════════════════════════════════
router.get('/stats', async (req, res) => {
    try {
        const db = req.committeeDb;
        const userId = req.user.userId;

        const result = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM tasks) AS total,
        (SELECT COUNT(*) FROM tasks WHERE status = 'todo') AS todo,
        (SELECT COUNT(*) FROM tasks WHERE status IN ('in_progress', 'inprogress')) AS in_progress,
        (SELECT COUNT(*) FROM tasks WHERE status = 'review') AS review,
        (SELECT COUNT(*) FROM tasks WHERE status IN ('done', 'complete')) AS done,
        (SELECT COUNT(*) FROM tasks WHERE status = 'cancelled') AS cancelled,
        (SELECT COUNT(*) FROM tasks WHERE priority = 'urgent') AS urgent,
        (SELECT COUNT(*) FROM tasks WHERE due_date < NOW() AND status NOT IN ('done', 'complete', 'cancelled')) AS overdue,
        (SELECT COUNT(*) FROM tasks WHERE assigned_to = $1) AS my_assigned,
        (SELECT COUNT(*) FROM tasks WHERE created_by = $1) AS my_created,
        (SELECT COUNT(*) FROM tasks WHERE assigned_to = $1 AND due_date < NOW() AND status NOT IN ('done', 'complete', 'cancelled')) AS my_overdue
    `, [userId]);

        const stats = result.rows[0];

        res.json({
            success: true,
            stats: {
                total: parseInt(stats.total) || 0,
                todo: parseInt(stats.todo) || 0,
                inProgress: parseInt(stats.in_progress) || 0,
                review: parseInt(stats.review) || 0,
                done: parseInt(stats.done) || 0,
                cancelled: parseInt(stats.cancelled) || 0,
                urgent: parseInt(stats.urgent) || 0,
                overdue: parseInt(stats.overdue) || 0,
                myAssigned: parseInt(stats.my_assigned) || 0,
                myCreated: parseInt(stats.my_created) || 0,
                myOverdue: parseInt(stats.my_overdue) || 0,
            },
        });
    } catch (err) {
        console.error('Task stats error:', err.message);
        res.status(500).json({ error: 'Failed to fetch task stats.' });
    }
});

// ══════════════════════════════════════════════════
// GET /:id — Get a single task
// ══════════════════════════════════════════════════
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const db = req.committeeDb;

        const result = await db.query(
            `SELECT * FROM tasks WHERE id = $1`,
            [id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Task not found.' });
        }

        const enriched = await enrichWithUserNames(req.masterDb, result.rows, ['created_by', 'assigned_to']);

        res.json({
            success: true,
            task: enriched[0],
        });
    } catch (err) {
        console.error('Get task error:', err.message);
        res.status(500).json({ error: 'Failed to fetch task.' });
    }
});

// ══════════════════════════════════════════════════
// GET /:id/comments — List comments for a task
// ══════════════════════════════════════════════════
router.get('/:id/comments', async (req, res) => {
    try {
        const { id } = req.params;
        const db = req.committeeDb;

        const result = await db.query(
            `SELECT * FROM task_comments WHERE task_id = $1 ORDER BY created_at ASC`,
            [id]
        );

        const enriched = await enrichWithUserNames(req.masterDb, result.rows, 'author_id');

        // Map to frontend-expected format
        const comments = enriched.map(c => ({
            id: c.id,
            content: c.content,
            authorId: c.author_id,
            authorName: c.author_name || null,
            authorEmail: c.author_email || null,
            reactions: c.reactions || {},
            createdAt: c.created_at,
            updatedAt: c.updated_at,
        }));

        res.json({ success: true, comments });
    } catch (err) {
        console.error('List comments error:', err.message);
        res.status(500).json({ error: 'Failed to list comments.' });
    }
});

// ══════════════════════════════════════════════════
// POST /:id/comments — Add a comment to a task
// ══════════════════════════════════════════════════
router.post('/:id/comments', async (req, res) => {
    try {
        const { id } = req.params;
        const { content, authorId, authorEmail, authorName } = req.body;
        const db = req.committeeDb;

        if (!content) {
            return res.status(400).json({ error: 'Comment content is required.' });
        }

        const result = await db.query(
            `INSERT INTO task_comments (task_id, author_id, content)
       VALUES ($1, $2, $3)
       RETURNING *`,
            [id, authorId || req.user.userId, content.trim()]
        );

        const comment = result.rows[0];

        res.status(201).json({
            success: true,
            comment: {
                id: comment.id,
                content: comment.content,
                authorId: comment.author_id,
                authorName: authorName || null,
                authorEmail: authorEmail || null,
                reactions: comment.reactions || {},
                createdAt: comment.created_at,
            },
        });
    } catch (err) {
        console.error('Add comment error:', err.message);
        res.status(500).json({ error: 'Failed to add comment.' });
    }
});

// ══════════════════════════════════════════════════
// PATCH /:id/comments/:commentId — Edit a comment
// ══════════════════════════════════════════════════
router.patch('/:id/comments/:commentId', async (req, res) => {
    try {
        const { commentId } = req.params;
        const { content } = req.body;
        const db = req.committeeDb;

        const result = await db.query(
            `UPDATE task_comments SET content = $1, updated_at = NOW()
       WHERE id = $2 AND author_id = $3
       RETURNING *`,
            [content, commentId, req.user.userId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Comment not found or not yours.' });
        }

        res.json({ success: true, comment: result.rows[0] });
    } catch (err) {
        console.error('Update comment error:', err.message);
        res.status(500).json({ error: 'Failed to update comment.' });
    }
});

// ══════════════════════════════════════════════════
// DELETE /:id/comments/:commentId — Delete a comment
// ══════════════════════════════════════════════════
router.delete('/:id/comments/:commentId', async (req, res) => {
    try {
        const { commentId } = req.params;
        const db = req.committeeDb;

        const result = await db.query(
            `DELETE FROM task_comments WHERE id = $1 AND author_id = $2 RETURNING id`,
            [commentId, req.user.userId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Comment not found or not yours.' });
        }

        res.json({ success: true, message: 'Comment deleted.' });
    } catch (err) {
        console.error('Delete comment error:', err.message);
        res.status(500).json({ error: 'Failed to delete comment.' });
    }
});

// ══════════════════════════════════════════════════
// POST /:id/comments/:commentId/reactions — Toggle reaction
// ══════════════════════════════════════════════════
router.post('/:id/comments/:commentId/reactions', async (req, res) => {
    try {
        const { commentId } = req.params;
        const { emoji, userId } = req.body;
        const db = req.committeeDb;
        const uid = userId || req.user.userId;

        if (!emoji) {
            return res.status(400).json({ error: 'Emoji is required.' });
        }

        // Get current reactions
        const current = await db.query(
            `SELECT reactions FROM task_comments WHERE id = $1`,
            [commentId]
        );

        if (current.rowCount === 0) {
            return res.status(404).json({ error: 'Comment not found.' });
        }

        const reactions = current.rows[0].reactions || {};
        const users = reactions[emoji] || [];

        if (users.includes(uid)) {
            // Remove reaction
            reactions[emoji] = users.filter(u => u !== uid);
            if (reactions[emoji].length === 0) delete reactions[emoji];
        } else {
            // Add reaction
            reactions[emoji] = [...users, uid];
        }

        await db.query(
            `UPDATE task_comments SET reactions = $1 WHERE id = $2`,
            [JSON.stringify(reactions), commentId]
        );

        res.json({ success: true, reactions });
    } catch (err) {
        console.error('Toggle reaction error:', err.message);
        res.status(500).json({ error: 'Failed to toggle reaction.' });
    }
});

module.exports = router;
