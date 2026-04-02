// ============================================
// routes/tasks.js — Task Management Routes
// ============================================
// All routes use req.committeeDb.
// ============================================

const express = require('express');
const router = express.Router();
const { enrichWithUserNames } = require('../utils/enrichUsers');
const { addClient, broadcast } = require('../utils/sseBroadcaster');

// ═══════════════════════════════════════════════
//  GET /events — SSE stream for real-time task updates
// ═══════════════════════════════════════════════
router.get('/events', (req, res) => {
    const slug = req.committeeSlug;

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
    });

    // Send initial heartbeat
    res.write('event: connected\ndata: {}\n\n');

    addClient(slug, res);

    // Keep-alive every 25 seconds
    const keepAlive = setInterval(() => {
        res.write(': keepalive\n\n');
    }, 25000);

    req.on('close', () => clearInterval(keepAlive));
});

// ═══════════════════════════════════════════════
//  GET / — List tasks
// ═══════════════════════════════════════════════
router.get('/', async (req, res) => {
    try {
        const { status, assignedTo, priority, search } = req.query;

        let query = 'SELECT * FROM tasks WHERE 1=1';
        const params = [];
        let paramIndex = 1;

        if (status) {
            query += ` AND status = $${paramIndex++}`;
            params.push(status);
        }
        if (assignedTo) {
            query += ` AND assigned_to = $${paramIndex++}`;
            params.push(assignedTo);
        }
        if (priority) {
            query += ` AND priority = $${paramIndex++}`;
            params.push(priority);
        }
        if (search) {
            query += ` AND (title ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        query += ' ORDER BY created_at DESC';

        const result = await req.committeeDb.query(query, params);

        // Enrich with creator names
        let tasks = await enrichWithUserNames(req.masterDb, result.rows, 'created_by');

        // Also enrich with assignee names
        const assigneeIds = [...new Set(
            tasks.map((t) => t.assigned_to).filter((id) => id !== null && id !== undefined)
        )];

        if (assigneeIds.length > 0) {
            const assigneeResult = await req.masterDb.query(
                'SELECT id, name, email, avatar FROM users WHERE id = ANY($1)',
                [assigneeIds]
            );

            const assigneeMap = {};
            for (const u of assigneeResult.rows) {
                assigneeMap[u.id] = { name: u.name, email: u.email, avatar: u.avatar };
            }

            tasks = tasks.map((t) => ({
                ...t,
                creator_name: t.user_name,
                creator_email: t.user_email,
                creator_avatar: t.user_avatar,
                assignee_name: t.assigned_to ? (assigneeMap[t.assigned_to]?.name || 'Unknown') : null,
                assignee_email: t.assigned_to ? (assigneeMap[t.assigned_to]?.email || '') : null,
                assignee_avatar: t.assigned_to ? (assigneeMap[t.assigned_to]?.avatar || null) : null,
            }));
        } else {
            tasks = tasks.map((t) => ({
                ...t,
                creator_name: t.user_name,
                creator_email: t.user_email,
                creator_avatar: t.user_avatar,
                assignee_name: null,
                assignee_email: null,
                assignee_avatar: null,
            }));
        }

        res.json({ success: true, tasks });
    } catch (err) {
        console.error('  ❌ List tasks error:', err.message);
        res.status(500).json({ error: 'Failed to list tasks' });
    }
});

// ═══════════════════════════════════════════════
//  GET /stats/summary — Task statistics
// ═══════════════════════════════════════════════
router.get('/stats/summary', async (req, res) => {
    try {
        const result = await req.committeeDb.query(`
            SELECT
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE status = 'pending') AS pending,
                COUNT(*) FILTER (WHERE status = 'inprogress') AS inprogress,
                COUNT(*) FILTER (WHERE status = 'complete') AS complete,
                COUNT(*) FILTER (WHERE priority = 'urgent') AS urgent,
                COUNT(*) FILTER (WHERE due_date < NOW() AND status != 'complete') AS overdue
            FROM tasks
        `);

        const stats = result.rows[0];

        res.json({
            success: true,
            stats: {
                total: parseInt(stats.total),
                pending: parseInt(stats.pending),
                inprogress: parseInt(stats.inprogress),
                complete: parseInt(stats.complete),
                urgent: parseInt(stats.urgent),
                overdue: parseInt(stats.overdue),
            },
        });
    } catch (err) {
        console.error('  ❌ Task stats error:', err.message);
        res.status(500).json({ error: 'Failed to fetch task statistics' });
    }
});

// ═══════════════════════════════════════════════
//  GET /:id — Single task
// ═══════════════════════════════════════════════
router.get('/:id', async (req, res) => {
    try {
        const result = await req.committeeDb.query(
            'SELECT * FROM tasks WHERE id = $1',
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }

        let tasks = await enrichWithUserNames(req.masterDb, result.rows, 'created_by');
        const task = tasks[0];

        // Get assignee info
        if (task.assigned_to) {
            const assigneeResult = await req.masterDb.query(
                'SELECT id, name, email, avatar FROM users WHERE id = $1',
                [task.assigned_to]
            );

            if (assigneeResult.rows.length > 0) {
                task.assignee_name = assigneeResult.rows[0].name;
                task.assignee_email = assigneeResult.rows[0].email;
                task.assignee_avatar = assigneeResult.rows[0].avatar;
            }
        }

        task.creator_name = task.user_name;
        task.creator_email = task.user_email;
        task.creator_avatar = task.user_avatar;

        res.json({ success: true, task });
    } catch (err) {
        console.error('  ❌ Get task error:', err.message);
        res.status(500).json({ error: 'Failed to fetch task' });
    }
});

// ═══════════════════════════════════════════════
//  POST / — Create task
// ═══════════════════════════════════════════════
router.post('/', async (req, res) => {
    try {
        const { title, description, status, priority, assigned_to, due_date, labels } = req.body;

        if (!title) {
            return res.status(400).json({ error: 'Task title is required' });
        }

        const result = await req.committeeDb.query(
            `INSERT INTO tasks (title, description, status, priority, created_by, assigned_to, due_date, labels)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [
                title,
                description || '',
                status || 'pending',
                priority || 'medium',
                req.user.id,
                assigned_to || null,
                due_date || null,
                labels || [],
            ]
        );

        const task = result.rows[0];

        // Log activity
        await req.committeeDb.query(
            `INSERT INTO activity_log (user_id, action, entity_type, entity_id, details)
             VALUES ($1, 'created', 'task', $2, $3)`,
            [req.user.id, task.id, JSON.stringify({ title })]
        );

        // Create notification for assignee
        if (assigned_to) {
            await req.committeeDb.query(
                `INSERT INTO notifications (user_id, type, title, message, link)
                 VALUES ($1, 'task_assigned', 'New Task Assigned', $2, $3)`,
                [
                    assigned_to,
                    `You have been assigned: "${title}"`,
                    `/tasks/${task.id}`,
                ]
            );
        }

        res.status(201).json({ success: true, task });

        // Broadcast to all SSE clients on this committee
        broadcast(req.committeeSlug, 'task_changed', { action: 'created', taskId: task.id });
    } catch (err) {
        console.error('  ❌ Create task error:', err.message);
        res.status(500).json({ error: 'Failed to create task' });
    }
});

// ═══════════════════════════════════════════════
//  PATCH /:id — Update task
// ═══════════════════════════════════════════════
router.patch('/:id', async (req, res) => {
    try {
        const allowedFields = ['title', 'description', 'status', 'priority', 'assigned_to', 'due_date', 'labels'];

        const updates = [];
        const values = [];
        let paramIndex = 1;

        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                updates.push(`${field} = $${paramIndex++}`);
                values.push(req.body[field]);
            }
        }

        // Auto-set completed_at when status changes to 'complete'
        if (req.body.status === 'complete') {
            updates.push(`completed_at = NOW()`);
        } else if (req.body.status && req.body.status !== 'complete') {
            updates.push(`completed_at = NULL`);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        updates.push(`updated_at = NOW()`);
        values.push(req.params.id);

        const result = await req.committeeDb.query(
            `UPDATE tasks SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }

        res.json({ success: true, task: result.rows[0] });

        // Broadcast to all SSE clients
        broadcast(req.committeeSlug, 'task_changed', { action: 'updated', taskId: req.params.id, status: req.body.status });
    } catch (err) {
        console.error('  ❌ Update task error:', err.message);
        res.status(500).json({ error: 'Failed to update task' });
    }
});

// ═══════════════════════════════════════════════
//  DELETE /:id — Delete task
// ═══════════════════════════════════════════════
router.delete('/:id', async (req, res) => {
    try {
        const result = await req.committeeDb.query(
            'DELETE FROM tasks WHERE id = $1 RETURNING id',
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }

        res.json({ success: true, message: 'Task deleted' });

        // Broadcast to all SSE clients
        broadcast(req.committeeSlug, 'task_changed', { action: 'deleted', taskId: req.params.id });
    } catch (err) {
        console.error('  ❌ Delete task error:', err.message);
        res.status(500).json({ error: 'Failed to delete task' });
    }
});

// ═══════════════════════════════════════════════
//  PATCH /:id/star — Toggle star
// ═══════════════════════════════════════════════
router.patch('/:id/star', async (req, res) => {
    try {
        const result = await req.committeeDb.query(
            `UPDATE tasks SET is_starred = NOT is_starred, updated_at = NOW()
             WHERE id = $1
             RETURNING id, is_starred`,
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }

        res.json({ success: true, task: result.rows[0] });
    } catch (err) {
        console.error('  ❌ Star task error:', err.message);
        res.status(500).json({ error: 'Failed to toggle star' });
    }
});

module.exports = router;
