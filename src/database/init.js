require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '5432', 10);
const DB_NAME = process.env.DB_NAME || 'breakerbot';
const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || '';

/**
 * Create database if it doesn't exist
 * Connects to 'postgres' to run CREATE DATABASE
 * @returns {Promise<boolean>}
 */
async function ensureDatabaseExists() {
    const client = new Client({
        host: DB_HOST,
        port: DB_PORT,
        database: 'postgres',
        user: DB_USER,
        password: DB_PASSWORD,
    });

    try {
        await client.connect();
        const { rows } = await client.query(
            "SELECT 1 FROM pg_database WHERE datname = $1",
            [DB_NAME]
        );
        if (rows.length === 0) {
            const owner = String(DB_USER).replace(/"/g, '""');
            const dbName = String(DB_NAME).replace(/"/g, '""');
            await client.query(`CREATE DATABASE "${dbName}" OWNER TO "${owner}"`);
            console.log(`[DB] Database "${DB_NAME}" created with owner "${DB_USER}".`);
        }
        return true;
    } catch (err) {
        if (err.code === '42P04') {
            return true;
        }
        console.warn('[DB] Could not ensure database exists:', err.message);
        return false;
    } finally {
        await client.end();
    }
}

/**
 * Run schema.sql - executa literalmente o arquivo completo
 * Usa caminho absoluto e executa cada statement separadamente (node-pg só roda 1 por query)
 * @param {import('pg').Client} client
 * @returns {Promise<void>}
 */
async function runSchema(client) {
    const schemaPath = path.resolve(__dirname, '..', '..', 'database', 'schema.sql');
    if (!fs.existsSync(schemaPath)) {
        throw new Error(`Schema não encontrado: ${schemaPath}`);
    }
    console.log('[DB] Executando schema:', schemaPath);
    const schema = fs.readFileSync(schemaPath, 'utf8');

    const statements = [];
    const parts = schema.split(/;\s*\n/);
    let buffer = '';
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i].trim();
        if (!part) continue;
        buffer += (buffer ? ';\n' : '') + part;
        const inDoBlock = buffer.includes('DO $$') && !buffer.trim().endsWith('END $$');
        if (!inDoBlock) {
            const sql = (buffer + ';').trim();
            if (sql.length > 2) statements.push(sql);
            buffer = '';
        }
    }
    if (buffer.trim()) statements.push((buffer + ';').trim());

    const ignorable = ['42P07', '42710', '42501', '42701'];
    for (let i = 0; i < statements.length; i++) {
        const sql = statements[i];
        try {
            await client.query(sql);
        } catch (err) {
            if (!ignorable.includes(err.code)) {
                console.error(`[DB] Erro no statement ${i + 1}/${statements.length}:`, err.message);
                throw err;
            }
        }
    }
    console.log(`[DB] ${statements.length} statements executados.`);
}

/**
 * Initialize database: create if needed, then run schema
 * @returns {Promise<boolean>}
 */
async function initDatabase() {
    try {
        await ensureDatabaseExists();

        const client = new Client({
            host: DB_HOST,
            port: DB_PORT,
            database: DB_NAME,
            user: DB_USER,
            password: DB_PASSWORD,
        });

        await client.connect();
        await runSchema(client);
        await client.end();

        console.log('[DB] Schema initialized successfully.');
        return true;
    } catch (err) {
        console.error('[DB] Init failed:', err.message);
        return false;
    }
}

module.exports = { initDatabase, ensureDatabaseExists };
