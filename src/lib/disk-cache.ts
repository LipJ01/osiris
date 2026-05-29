import Database from 'better-sqlite3';
import path from 'path';
import { promises as fs } from 'fs';

/**
 * SQLite-backed cache shared by API routes that wrap rate-limited upstream
 * APIs (GFW, OCEARCH, …). Survives Next process restarts so we don't burn
 * quota when the launchd service kickstart wipes in-memory state.
 *
 *   const hit = await cacheRead<MyShape>('fisheries-effort', 6 * 60 * 60_000);
 *   if (hit) return hit.data;
 *   const fresh = await expensiveFetch();
 *   await cacheWrite('fisheries-effort', fresh);
 *
 * Schema is a single key-value table with a write timestamp; TTL is checked
 * at read time so old keys can be replayed if a fresh fetch fails.
 */

const DB_DIR = path.join(process.cwd(), '.cache');
const DB_PATH = path.join(DB_DIR, 'osiris.sqlite');

let db: Database.Database | null = null;
let dbInitPromise: Promise<Database.Database> | null = null;

async function getDb(): Promise<Database.Database> {
  if (db) return db;
  if (dbInitPromise) return dbInitPromise;
  dbInitPromise = (async () => {
    await fs.mkdir(DB_DIR, { recursive: true });
    const handle = new Database(DB_PATH);
    handle.pragma('journal_mode = WAL');     // concurrent reads
    handle.pragma('synchronous = NORMAL');   // fast + safe enough for cache data
    handle.exec(`
      CREATE TABLE IF NOT EXISTS cache (
        key  TEXT PRIMARY KEY,
        at   INTEGER NOT NULL,
        data TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_cache_at ON cache(at);
    `);
    db = handle;
    return handle;
  })();
  return dbInitPromise;
}

export async function cacheRead<T>(key: string, ttlMs: number): Promise<{ data: T; age_ms: number } | null> {
  try {
    const handle = await getDb();
    const row = handle.prepare('SELECT at, data FROM cache WHERE key = ?').get(key) as { at: number; data: string } | undefined;
    if (!row) return null;
    const age = Date.now() - row.at;
    if (age > ttlMs) return null;
    return { data: JSON.parse(row.data) as T, age_ms: age };
  } catch (e: any) {
    console.warn(`[cache] read ${key} failed:`, e?.message || e);
    return null;
  }
}

export async function cacheReadStale<T>(key: string): Promise<{ data: T; age_ms: number } | null> {
  // Same as cacheRead but ignores TTL — useful as a fallback when an upstream
  // fetch fails and we'd rather serve old data than nothing.
  try {
    const handle = await getDb();
    const row = handle.prepare('SELECT at, data FROM cache WHERE key = ?').get(key) as { at: number; data: string } | undefined;
    if (!row) return null;
    return { data: JSON.parse(row.data) as T, age_ms: Date.now() - row.at };
  } catch (e: any) {
    console.warn(`[cache] readStale ${key} failed:`, e?.message || e);
    return null;
  }
}

export async function cacheWrite<T>(key: string, data: T): Promise<void> {
  try {
    const handle = await getDb();
    handle.prepare('INSERT OR REPLACE INTO cache (key, at, data) VALUES (?, ?, ?)')
      .run(key, Date.now(), JSON.stringify(data));
  } catch (e: any) {
    console.warn(`[cache] write ${key} failed:`, e?.message || e);
  }
}
