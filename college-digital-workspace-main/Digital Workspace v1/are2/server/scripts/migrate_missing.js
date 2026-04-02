// Migration: Add missing columns and tables
const pool = require('./database/connection');

async function migrate() {
    try {
        // 1. Add position column to folders
        await pool.query('ALTER TABLE folders ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0');
        console.log('✅ Added position column to folders');

        // 2. Create folder_shares table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS folder_shares (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                folder_id UUID NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
                shared_by UUID NOT NULL REFERENCES users(id),
                shared_with UUID NOT NULL REFERENCES users(id),
                permission VARCHAR(10) DEFAULT 'view' CHECK (permission IN ('view', 'edit')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(folder_id, shared_with)
            )
        `);
        console.log('✅ Created folder_shares table');

        // 3. Create indexes
        await pool.query('CREATE INDEX IF NOT EXISTS idx_folder_shares_folder ON folder_shares(folder_id)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_folder_shares_user ON folder_shares(shared_with)');
        console.log('✅ Created indexes');

        console.log('\n🎉 Migration complete!');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
