import pg from 'pg';
import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isPostgres = Boolean(process.env.DATABASE_URL);

let pool = null;
let sqliteDb = null;

if (isPostgres) {
  console.log('🔌 [Database] Menggunakan PostgreSQL terpusat:', process.env.DATABASE_URL.split('@')[1] || 'remote');
  pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false }
  });
} else {
  const dbDir = path.resolve(__dirname, '../../database');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  const dbPath = path.resolve(dbDir, 'sim_umkm.sqlite');
  console.log('💾 [Database] Mode Dev Lokal: Menggunakan SQLite di', dbPath);
  sqliteDb = new sqlite3.Database(dbPath);
  sqliteDb.run('PRAGMA foreign_keys = ON;');
}

/**
 * Normalisasi parameter query ($1, $2 -> ? jika di SQLite)
 */
function normalizeQueryForSqlite(sql, params = []) {
  let normalizedSql = sql.replace(/\$(\d+)/g, '?');
  // Hilangkan tipe Postgres seperti ::jsonb atau ON DELETE CASCADE jika ada di DDL runtime
  normalizedSql = normalizedSql.replace(/::jsonb/g, '');
  return { sql: normalizedSql, params };
}

export const db = {
  isPostgres,

  async query(text, params = []) {
    if (isPostgres) {
      const res = await pool.query(text, params);
      return res;
    }

    return new Promise((resolve, reject) => {
      const { sql, params: normalizedParams } = normalizeQueryForSqlite(text, params);
      const trimmed = sql.trim().toUpperCase();

      if (trimmed.startsWith('SELECT') || trimmed.startsWith('PRAGMA')) {
        sqliteDb.all(sql, normalizedParams, (err, rows) => {
          if (err) return reject(err);
          resolve({ rows: rows || [], rowCount: (rows || []).length });
        });
      } else if (trimmed.startsWith('INSERT')) {
        sqliteDb.run(sql, normalizedParams, function (err) {
          if (err) return reject(err);
          // Bila SQLite insert, ambil id terakhir
          resolve({
            rows: [{ id: this.lastID }],
            rowCount: this.changes,
            lastID: this.lastID
          });
        });
      } else {
        sqliteDb.run(sql, normalizedParams, function (err) {
          if (err) return reject(err);
          resolve({ rows: [], rowCount: this.changes });
        });
      }
    });
  },

  /**
   * Eksekusi transaksi database atomic (ACID)
   */
  async transaction(callback) {
    if (isPostgres) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } else {
      // SQLite Transaction
      await this.query('BEGIN TRANSACTION');
      try {
        const result = await callback(this);
        await this.query('COMMIT');
        return result;
      } catch (err) {
        await this.query('ROLLBACK');
        throw err;
      }
    }
  }
};

export default db;
