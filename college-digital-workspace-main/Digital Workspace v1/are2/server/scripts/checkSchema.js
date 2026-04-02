const committeeDbManager = require('../config/committeeDbManager');

(async () => {
    try {
        const db = committeeDbManager.getPool('dlle');

        // Test: update content field with a JSON array (like BlockEditor sends)
        const content = JSON.stringify([
            { id: 'test1', type: 'paragraph', text: 'Hello world' }
        ]);

        // First get a task ID
        const tasks = await db.query(`SELECT id FROM tasks LIMIT 1`);
        if (tasks.rowCount === 0) {
            console.log('No tasks found');
            process.exit();
        }
        const taskId = tasks.rows[0].id;
        console.log('Testing with task:', taskId);

        // Try updating content
        const result = await db.query(
            `UPDATE tasks SET content = $1, updated_at = NOW() WHERE id = $2 RETURNING id, content`,
            [content, taskId]
        );
        console.log('✅ Content update works:', result.rows[0].content);

        // Check column type
        const colType = await db.query(
            `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'content'`
        );
        console.log('Content column type:', colType.rows[0]?.data_type);

    } catch (e) {
        console.error('ERROR:', e.message);
        console.error('DETAIL:', e.detail);
    } finally {
        process.exit();
    }
})();
