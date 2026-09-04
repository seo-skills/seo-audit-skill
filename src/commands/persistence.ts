/**
 * Decides where an audit's results go once the run finishes.
 *
 * Since 3.4.0 every audit is stored in the audits database unless the user
 * opts out, because a history that only fills up when someone remembers a flag
 * is a history that stays empty. The legacy per-project JSON report is now
 * opt-in through `--json-report`; `--save` keeps writing it for one more minor
 * so existing scripts do not break, with a notice pointing at the new flag.
 */

export interface PersistenceFlags {
  /** Commander's `save` value: true by default, false after `--no-save` */
  save: boolean;
  /** True only when the user typed `--save` themselves */
  saveExplicit: boolean;
  /** `--json-report` */
  jsonReport: boolean;
  /** `[output] save` from the config file; undefined when not set */
  configSave?: boolean;
}

export interface PersistencePlan {
  /** Store the audit in `$SEOMATOR_HOME/audits.db` */
  database: boolean;
  /** Write the legacy JSON report under `.seomator/reports/` */
  legacyJson: boolean;
  /** Print the `--save` deprecation notice */
  deprecatedSaveFlag: boolean;
}

/**
 * Resolve the persistence plan from the flags and config.
 *
 * Precedence: `--no-save` beats everything; an explicit `--save` beats a
 * config file that turned saving off; otherwise the config decides, and the
 * default is on.
 */
export function resolvePersistence(flags: PersistenceFlags): PersistencePlan {
  const database = flags.save && (flags.saveExplicit || flags.configSave !== false);
  return {
    database,
    legacyJson: flags.jsonReport || flags.saveExplicit,
    deprecatedSaveFlag: flags.saveExplicit,
  };
}

/** The notice printed once per run when `--save` is used */
export const SAVE_DEPRECATION_NOTICE =
  '--save is deprecated and will be removed in 3.6.0: audits are stored by default now. Use --json-report for the legacy JSON file, or --no-save to skip storing.';
