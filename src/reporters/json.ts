import type { AuditResult } from '../types.js';

/**
 * Custom JSON replacer function to handle Date objects
 * Converts Date objects to ISO string format
 */
function jsonReplacer(_key: string, value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
}

/**
 * Render the audit result as formatted JSON
 * @param result - The audit result to render
 * @param prettyPrint - Whether to format with indentation (default: true)
 * @returns JSON string representation
 */
export function renderJsonReport(result: AuditResult, prettyPrint = true): string {
  if (prettyPrint) {
    return JSON.stringify(result, jsonReplacer, 2);
  }
  return JSON.stringify(result, jsonReplacer);
}

/**
 * Output the JSON report to console
 * @param result - The audit result to output
 */
export function outputJsonReport(result: AuditResult): void {
  console.log(renderJsonReport(result));
}
