require('dotenv').config();
const { Pool } = require('pg');
const { initDatabase } = require('./init');

let initPromise = null;
function ensureInit() {
    if (!initPromise) {
        initPromise = initDatabase();
    }
    return initPromise;
}

ensureInit().then(ok => {
    if (ok) console.log('[DB] Schema inicializado.');
}).catch(err => console.error('[DB] Erro no init:', err.message));

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'breakerbot',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
    console.error('[DB] Unexpected error on idle client:', err.message);
});

/**
 * Execute a query with optional parameters
 * @param {string} text - SQL query
 * @param {Array} [params] - Query parameters
 * @returns {Promise<import('pg').QueryResult>}
 */
async function query(text, params) {
    await ensureInit();
    const start = Date.now();
    try {
        const result = await pool.query(text, params);
        const duration = Date.now() - start;
        if (process.env.NODE_ENV === 'development' && duration > 100) {
            console.log('[DB] Slow query:', { text: text.substring(0, 80), duration });
        }
        return result;
    } catch (err) {
        console.error('[DB] Query error:', err.message);
        throw err;
    }
}

/**
 * Get a client from the pool for transactions
 * @returns {Promise<import('pg').PoolClient>}
 */
async function getClient() {
    await ensureInit();
    return pool.connect();
}

/**
 * Test database connection
 * @returns {Promise<boolean>}
 */
async function testConnection() {
    try {
        const result = await query('SELECT NOW()');
        console.log('[DB] Connected successfully at', result.rows[0].now);
        return true;
    } catch (err) {
        console.error('[DB] Connection failed:', err.message);
        return false;
    }
}

module.exports = {
    pool,
    query,
    getClient,
    testConnection,
    ensureInit,
};
