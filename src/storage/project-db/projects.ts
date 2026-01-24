import type Database from 'better-sqlite3';
import type { DbProject, HydratedProject } from '../types.js';
import type { PartialSeomatorConfig } from '../../config/schema.js';

/**
 * Hydrate a project record from the database
 */
function hydrateProject(row: DbProject): HydratedProject {
  return {
    id: row.id,
    domain: row.domain,
    name: row.name,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    config: row.config_json ? JSON.parse(row.config_json) : null,
  };
}

/**
 * Get or create a project for a domain
 *
 * @param db - Database instance
 * @param domain - Domain name
 * @param name - Optional project name
 * @returns Project record
 */
export function getOrCreateProject(
  db: Database.Database,
  domain: string,
  name?: string
): HydratedProject {
  // Try to get existing project
  const existing = db
    .prepare('SELECT * FROM projects WHERE domain = ?')
    .get(domain) as DbProject | undefined;

  if (existing) {
    return hydrateProject(existing);
  }

  // Create new project
  const result = db
    .prepare(
      `
    INSERT INTO projects (domain, name)
    VALUES (?, ?)
    RETURNING *
  `
    )
    .get(domain, name ?? null) as DbProject;

  return hydrateProject(result);
}

/**
 * Get a project by ID
 *
 * @param db - Database instance
 * @param id - Project ID
 * @returns Project record or null
 */
export function getProjectById(
  db: Database.Database,
  id: number
): HydratedProject | null {
  const row = db
    .prepare('SELECT * FROM projects WHERE id = ?')
    .get(id) as DbProject | undefined;

  return row ? hydrateProject(row) : null;
}

/**
 * Get a project by domain
 *
 * @param db - Database instance
 * @param domain - Domain name
 * @returns Project record or null
 */
export function getProjectByDomain(
  db: Database.Database,
  domain: string
): HydratedProject | null {
  const row = db
    .prepare('SELECT * FROM projects WHERE domain = ?')
    .get(domain) as DbProject | undefined;

  return row ? hydrateProject(row) : null;
}

/**
 * Update a project
 *
 * @param db - Database instance
 * @param id - Project ID
 * @param updates - Fields to update
 * @returns Updated project or null if not found
 */
export function updateProject(
  db: Database.Database,
  id: number,
  updates: {
    name?: string;
    config?: PartialSeomatorConfig;
  }
): HydratedProject | null {
  const setClauses: string[] = ['updated_at = datetime(\'now\')'];
  const params: unknown[] = [];

  if (updates.name !== undefined) {
    setClauses.push('name = ?');
    params.push(updates.name);
  }

  if (updates.config !== undefined) {
    setClauses.push('config_json = ?');
    params.push(JSON.stringify(updates.config));
  }

  params.push(id);

  const result = db
    .prepare(
      `
    UPDATE projects
    SET ${setClauses.join(', ')}
    WHERE id = ?
    RETURNING *
  `
    )
    .get(...params) as DbProject | undefined;

  return result ? hydrateProject(result) : null;
}

/**
 * List all projects
 *
 * @param db - Database instance
 * @returns Array of projects
 */
export function listProjects(db: Database.Database): HydratedProject[] {
  const rows = db
    .prepare('SELECT * FROM projects ORDER BY updated_at DESC')
    .all() as DbProject[];

  return rows.map(hydrateProject);
}

/**
 * Delete a project and all associated data (cascades to crawls, pages, etc.)
 *
 * @param db - Database instance
 * @param id - Project ID
 * @returns True if deleted, false if not found
 */
export function deleteProject(db: Database.Database, id: number): boolean {
  const result = db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  return result.changes > 0;
}
