// ============================================
// scripts/addTaskComments.js
// ============================================
// Creates the task_comments table in all
// committee databases for task comment support.
//
// Run with: node scripts/addTaskComments.js
// ============================================

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const committeeDbManager = require('../config/committeeDbManager');

const MIGRATION_SQL = `
-- Task Comments table
CREATE TABLE IF NOT EXISTS task_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    author_id UUID NOT NULL,
    content TEXT NOT NULL,
    reactions JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_task_comments_task ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_author ON task_comments(author_id);

-- Auto-update updated_at trigger
DROP TRIGGER IF EXISTS trigger_update_task_comments_updated_at ON task_comments;
CREATE TRIGGER trigger_update_task_comments_updated_at
BEFORE UPDATE ON task_comments
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
`;

async function migrate() {
    console.log('');
    console.log('══════════════════════════════════════════');
    console.log('  🗄️  Migration: Add task_comments table');
    console.log('══════════════════════════════════════════');
    console.log('');

    const slugs = committeeDbManager.getRegisteredSlugs();

    for (const slug of slugs) {
        try {
            await committeeDbManager.query(slug, MIGRATION_SQL);
            console.log(`  ✅ ${slug}: task_comments table created`);
        } catch (err) {
            console.error(`  ❌ ${slug}: ${err.message}`);
        }
    }

    console.log('');
    console.log('  Done! task_comments table added to all committee databases.');
    console.log('══════════════════════════════════════════');
    console.log('');

    process.exit(0);
}

migrate();
