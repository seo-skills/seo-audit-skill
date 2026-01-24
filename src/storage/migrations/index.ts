import type Database from 'better-sqlite3';
import type { Migration, MigrationResult, DbMigration } from '../types.js';

/**
 * Create the migrations tracking table if it doesn't exist
 */
function ensureMigrationsTable(db: Database.Database): void {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT DEFAULT (datetime('now'))
    )
  `).run();
}

/**
 * Get list of applied migrations
 */
function getAppliedMigrations(db: Database.Database): Set<string> {
  const rows = db.prepare('SELECT name FROM _migrations').all() as DbMigration[];
  return new Set(rows.map((r) => r.name));
}

/**
 * Record a migration as applied
 */
function recordMigration(db: Database.Database, name: string): void {
  db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(name);
}

/**
 * Remove a migration record (for rollback)
 */
function removeMigration(db: Database.Database, name: string): void {
  db.prepare('DELETE FROM _migrations WHERE name = ?').run(name);
}

/**
 * Run pending migrations on a database
 *
 * Migrations are run in order. Each migration is wrapped in a transaction.
 * If a migration fails, the transaction is rolled back and the error is recorded.
 *
 * @param db - better-sqlite3 database instance
 * @param migrations - Array of migrations to apply (in order)
 * @returns Result with lists of applied, skipped, and errored migrations
 */
export function runMigrations(
  db: Database.Database,
  migrations: Migration[]
): MigrationResult {
  ensureMigrationsTable(db);

  const applied = getAppliedMigrations(db);
  const result: MigrationResult = {
    applied: [],
    skipped: [],
    errors: [],
  };

  for (const migration of migrations) {
    if (applied.has(migration.name)) {
      result.skipped.push(migration.name);
      continue;
    }

    try {
      // Run migration in a transaction
      db.transaction(() => {
        migration.up(db);
        recordMigration(db, migration.name);
      })();

      result.applied.push(migration.name);
    } catch (error) {
      result.errors.push({
        name: migration.name,
        error: error instanceof Error ? error.message : String(error),
      });
      // Stop on first error
      break;
    }
  }

  return result;
}

/**
 * Rollback the last N migrations
 *
 * @param db - better-sqlite3 database instance
 * @param migrations - Array of all migrations (in order)
 * @param count - Number of migrations to rollback (default: 1)
 * @returns Result with lists of rolled back and errored migrations
 */
export function rollbackMigrations(
  db: Database.Database,
  migrations: Migration[],
  count = 1
): MigrationResult {
  ensureMigrationsTable(db);

  const applied = getAppliedMigrations(db);
  const result: MigrationResult = {
    applied: [], // These are actually rolled back
    skipped: [],
    errors: [],
  };

  // Get applied migrations in reverse order
  const toRollback = migrations
    .filter((m) => applied.has(m.name))
    .reverse()
    .slice(0, count);

  for (const migration of toRollback) {
    if (!migration.down) {
      result.errors.push({
        name: migration.name,
        error: 'Migration has no down function',
      });
      break;
    }

    try {
      db.transaction(() => {
        migration.down!(db);
        removeMigration(db, migration.name);
      })();

      result.applied.push(migration.name);
    } catch (error) {
      result.errors.push({
        name: migration.name,
        error: error instanceof Error ? error.message : String(error),
      });
      break;
    }
  }

  return result;
}

/**
 * Get migration status for a database
 *
 * @param db - better-sqlite3 database instance
 * @param migrations - Array of all migrations
 * @returns Object with pending and applied migration names
 */
export function getMigrationStatus(
  db: Database.Database,
  migrations: Migration[]
): { pending: string[]; applied: string[] } {
  ensureMigrationsTable(db);

  const applied = getAppliedMigrations(db);
  const pending: string[] = [];
  const appliedList: string[] = [];

  for (const migration of migrations) {
    if (applied.has(migration.name)) {
      appliedList.push(migration.name);
    } else {
      pending.push(migration.name);
    }
  }

  return { pending, applied: appliedList };
}

/**
 * Create a migration helper for a specific database
 */
export function createMigrationRunner(db: Database.Database) {
  return {
    run: (migrations: Migration[]) => runMigrations(db, migrations),
    rollback: (migrations: Migration[], count?: number) =>
      rollbackMigrations(db, migrations, count),
    status: (migrations: Migration[]) => getMigrationStatus(db, migrations),
  };
}
