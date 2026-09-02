import { describe, it, expect } from 'vitest';
import { resolvePersistence } from './persistence.js';

describe('resolvePersistence', () => {
  it('stores to the database by default and writes no JSON', () => {
    expect(resolvePersistence({ save: true, saveExplicit: false, jsonReport: false })).toEqual({
      database: true,
      legacyJson: false,
      deprecatedSaveFlag: false,
    });
  });

  it('--no-save skips the database', () => {
    const plan = resolvePersistence({ save: false, saveExplicit: false, jsonReport: false });
    expect(plan.database).toBe(false);
    expect(plan.legacyJson).toBe(false);
  });

  it('--no-save with --json-report writes only the JSON file', () => {
    const plan = resolvePersistence({ save: false, saveExplicit: false, jsonReport: true });
    expect(plan).toEqual({ database: false, legacyJson: true, deprecatedSaveFlag: false });
  });

  it('the deprecated --save stores to the database, writes JSON and warns', () => {
    expect(resolvePersistence({ save: true, saveExplicit: true, jsonReport: false })).toEqual({
      database: true,
      legacyJson: true,
      deprecatedSaveFlag: true,
    });
  });

  it('[output] save = false turns the database off unless --save is explicit', () => {
    expect(resolvePersistence({ save: true, saveExplicit: false, jsonReport: false, configSave: false }).database).toBe(
      false
    );
    expect(resolvePersistence({ save: true, saveExplicit: true, jsonReport: false, configSave: false }).database).toBe(
      true
    );
  });

  it('[output] save = true changes nothing', () => {
    expect(resolvePersistence({ save: true, saveExplicit: false, jsonReport: true, configSave: true })).toEqual({
      database: true,
      legacyJson: true,
      deprecatedSaveFlag: false,
    });
  });
});
