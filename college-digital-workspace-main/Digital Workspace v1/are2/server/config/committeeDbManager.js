// ============================================
// config/committeeDbManager.js
// ============================================
// Singleton class that manages a PostgreSQL connection pool
// for each committee database. Pools are lazily created and
// cached for reuse.
// ============================================

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { Pool } = require('pg');

class CommitteeDbManager {
    constructor() {
        // Map<slug, Pool>
        this.pools = new Map();

        // slug → database name mapping
        this.dbMap = {
            dlle: 'workspace_dlle',
            gyk: 'workspace_gyk',
            nss: 'workspace_nss',
        };
    }

    /**
     * Get or create a connection pool for the given committee slug.
     * @param {string} slug - Committee slug (e.g. 'dlle', 'gyk', 'nss')
     * @returns {Pool} PostgreSQL connection pool
     */
    getPool(slug) {
        const normalizedSlug = slug.toLowerCase();

        // Return cached pool if available
        if (this.pools.has(normalizedSlug)) {
            return this.pools.get(normalizedSlug);
        }

        const dbName = this.dbMap[normalizedSlug];
        if (!dbName) {
            throw new Error(`Unknown committee slug: "${slug}". Valid slugs: ${this.getRegisteredSlugs().join(', ')}`);
        }

        // Create new pool
        const pool = new Pool({
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT) || 5432,
            database: dbName,
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || 'postgres',
            max: 10,
            idleTimeoutMillis: 60000,
            connectionTimeoutMillis: 5000,
        });

        pool.on('connect', () => {
            console.log(`🟢 Committee DB [${normalizedSlug}]: New client connected to ${dbName}`);
        });

        pool.on('error', (err) => {
            console.error(`🔴 Committee DB [${normalizedSlug}]: Unexpected error on idle client`, err.message);
        });

        this.pools.set(normalizedSlug, pool);
        return pool;
    }

    /**
     * Shortcut: run a query on the committee's database.
     * @param {string} slug
     * @param {string} text - SQL query
     * @param {Array} params - Query parameters
     * @returns {Promise<import('pg').QueryResult>}
     */
    async query(slug, text, params) {
        const pool = this.getPool(slug);
        return pool.query(text, params);
    }

    /**
     * Get a client from the pool for transactions.
     * Caller is responsible for calling client.release().
     * @param {string} slug
     * @returns {Promise<import('pg').PoolClient>}
     */
    async getClient(slug) {
        const pool = this.getPool(slug);
        return pool.connect();
    }

    /**
     * Register a new committee for future dynamic additions.
     * @param {string} slug
     * @param {string} dbName
     */
    registerCommittee(slug, dbName) {
        const normalizedSlug = slug.toLowerCase();
        this.dbMap[normalizedSlug] = dbName;
        console.log(`📝 Registered committee: ${normalizedSlug} → ${dbName}`);
    }

    /**
     * Check if a committee slug is registered.
     * @param {string} slug
     * @returns {boolean}
     */
    isValidCommittee(slug) {
        return slug && this.dbMap.hasOwnProperty(slug.toLowerCase());
    }

    /**
     * Get all registered committee slugs.
     * @returns {string[]}
     */
    getRegisteredSlugs() {
        return Object.keys(this.dbMap);
    }

    /**
     * Gracefully close all pools.
     */
    async closeAll() {
        const entries = Array.from(this.pools.entries());
        for (const [slug, pool] of entries) {
            try {
                await pool.end();
                console.log(`🔴 Committee DB [${slug}]: Pool closed`);
            } catch (err) {
                console.error(`❌ Error closing pool for ${slug}:`, err.message);
            }
        }
        this.pools.clear();
    }
}

// Export singleton instance
module.exports = new CommitteeDbManager();
