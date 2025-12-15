/**
 * Migration utility for converting existing grape strings to arrays
 * Run this once after applying the database schema migration
 * 
 * Usage:
 * 1. Apply the supabase-migration-grapes.sql to your database first
 * 2. Import and call migrateExistingGrapes() from a server-side context
 * 
 * The SQL migration already handles the data migration in the database,
 * but this utility can be used for any additional client-side data processing
 * or for testing purposes.
 */

import { parseGrapeString, isBlend } from "./grapeVarieties";

export interface LegacyWine {
  id: string;
  grape?: string | null;
  grapes?: string[] | null;
  is_blend?: boolean;
}

export interface MigratedWine extends LegacyWine {
  grapes: string[];
  is_blend: boolean;
}

/**
 * Migrates a single wine's grape data from string to array format
 */
export function migrateWineGrapes(wine: LegacyWine): MigratedWine {
  // If grapes array already exists and has values, keep it
  if (wine.grapes && Array.isArray(wine.grapes) && wine.grapes.length > 0) {
    return {
      ...wine,
      grapes: wine.grapes,
      is_blend: wine.grapes.length > 1,
    };
  }

  // Parse the legacy grape string
  const grapes = wine.grape ? parseGrapeString(wine.grape) : [];

  return {
    ...wine,
    grapes,
    is_blend: grapes.length > 1,
  };
}

/**
 * Migrates an array of wines from legacy grape strings to array format
 */
export function migrateWinesGrapes(wines: LegacyWine[]): MigratedWine[] {
  return wines.map(migrateWineGrapes);
}

/**
 * Generates SQL statements for migrating existing grape data
 * Useful for manual database updates or debugging
 */
export function generateMigrationSQL(wines: LegacyWine[]): string[] {
  const statements: string[] = [];

  for (const wine of wines) {
    if (!wine.grape) continue;

    const grapes = parseGrapeString(wine.grape);
    if (grapes.length === 0) continue;

    const grapesArray = `ARRAY[${grapes.map((g) => `'${g.replace(/'/g, "''")}'`).join(", ")}]::TEXT[]`;
    const isBlendValue = grapes.length > 1;

    statements.push(
      `UPDATE wines SET grapes = ${grapesArray}, is_blend = ${isBlendValue} WHERE id = '${wine.id}';`
    );
  }

  return statements;
}

/**
 * Client-side function to help transform legacy wine data for display
 * Use this when receiving data from the API that might have legacy format
 */
export function normalizeWineGrapes<T extends LegacyWine>(wine: T): T & { grapes: string[]; is_blend: boolean } {
  // If grapes array already exists and has values, use it
  if (wine.grapes && Array.isArray(wine.grapes) && wine.grapes.length > 0) {
    return {
      ...wine,
      grapes: wine.grapes,
      is_blend: wine.is_blend ?? wine.grapes.length > 1,
    };
  }

  // Parse the legacy grape string
  const grapes = wine.grape ? parseGrapeString(wine.grape) : [];

  return {
    ...wine,
    grapes,
    is_blend: grapes.length > 1,
  };
}

/**
 * Batch normalize an array of wines
 */
export function normalizeWinesGrapes<T extends LegacyWine>(wines: T[]): (T & { grapes: string[]; is_blend: boolean })[] {
  return wines.map(normalizeWineGrapes);
}

