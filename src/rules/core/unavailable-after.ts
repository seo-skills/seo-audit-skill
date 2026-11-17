import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail, notMeasured } from '../define-rule.js';
import { googleRobotsText } from '../../indexability.js';

const ID = 'core-unavailable-after';
const DAY_MS = 24 * 60 * 60 * 1000;
/** A date this close is a warning: the page is about to leave the index */
const SOON_DAYS = 30;

/** Words that start the next directive, so a date's own commas are kept */
const DIRECTIVE = /^\s*(?:noindex|nofollow|none|all|index|follow|noarchive|nocache|nosnippet|notranslate|noimageindex|indexifembedded|noodp|noydir|max-snippet|max-image-preview|max-video-preview|unavailable_after)\b/i;

/** Every `unavailable_after` value in a directive string, commas in dates kept */
export function unavailableAfterValues(text: string): string[] {
  const values: string[] = [];
  const parts = text.split(',');
  for (let i = 0; i < parts.length; i++) {
    const match = /^\s*unavailable_after\s*:\s*(.*)$/i.exec(parts[i]);
    if (!match) continue;
    let value = match[1];
    while (i + 1 < parts.length && !DIRECTIVE.test(parts[i + 1])) value += `,${parts[++i]}`;
    values.push(value.trim());
  }
  return values;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
/** RFC 822 zones, in minutes east of UTC */
const ZONES: Record<string, number> = {
  UT: 0, UTC: 0, GMT: 0, Z: 0,
  EST: -300, EDT: -240, CST: -360, CDT: -300, MST: -420, MDT: -360, PST: -480, PDT: -420,
};

function zoneOffset(zone: string | undefined): number | null {
  if (!zone) return 0;
  const numeric = /^([+-])(\d{2})(\d{2})$/.exec(zone);
  if (numeric) return (numeric[1] === '-' ? -1 : 1) * (Number(numeric[2]) * 60 + Number(numeric[3]));
  return ZONES[zone.toUpperCase()] ?? null;
}

/**
 * A date in a format Google documents for `unavailable_after`: RFC 822
 * (`Fri, 25 Jun 2026 15:00:00 PST`), RFC 850 (`Friday, 25-Jun-26 15:00:00
 * PST`) or ISO 8601 (`2026-06-25`, `2026-06-25T15:00:00Z`). Null otherwise.
 */
export function parseUnavailableAfter(value: string): number | null {
  const text = value.trim();
  if (/^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/i.test(text)) {
    const parsed = Date.parse(text.replace(' ', 'T'));
    return Number.isFinite(parsed) ? parsed : null;
  }
  const match =
    /^(?:[a-z]+,\s*)?(\d{1,2})[\s-]([a-z]{3})[a-z]*[\s-](\d{2}|\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([a-z]{1,4}|[+-]\d{4})?$/i.exec(text);
  if (!match) return null;
  const month = MONTHS.indexOf(match[2].toLowerCase());
  const offset = zoneOffset(match[7]);
  if (month < 0 || offset === null) return null;
  let year = Number(match[3]);
  // RFC 850's two-digit years
  if (match[3].length === 2) year += year < 70 ? 2000 : 1900;
  const utc = Date.UTC(year, month, Number(match[1]), Number(match[4]), Number(match[5]), Number(match[6] ?? 0));
  return utc - offset * 60_000;
}

/**
 * Rule: a page set to drop out of Google's index on a date
 *
 * `unavailable_after` in a robots meta tag or X-Robots-Tag tells Google to
 * stop showing the page after that date. Once the date passes, the page is as
 * unindexed as a noindex one, and nothing on the page looks wrong.
 */
export const unavailableAfterRule = defineRule({
  id: ID,
  name: 'Unavailable-After Date',
  description: 'Checks robots unavailable_after dates: a past date removes the page from search results',
  category: 'core',
  weight: 10,
  advisory: true,
  run: (context: AuditContext) => {
    const declared = googleRobotsText(context).flatMap(({ source, text }) =>
      unavailableAfterValues(text).map((value) => ({ source, value, at: parseUnavailableAfter(value) }))
    );
    if (declared.length === 0) {
      return notMeasured(ID, 'No unavailable_after directive on this page', undefined, 'not-applicable');
    }

    const now = context.now ?? Date.now();
    const dates = declared
      .filter((d) => d.at !== null)
      .map((d) => ({ ...d, date: new Date(d.at!).toISOString() }))
      .sort((a, b) => a.at! - b.at!);
    const unparseable = declared.filter((d) => d.at === null).map((d) => d.value);
    const earliest = dates[0];
    const details = {
      declared: declared.map((d) => ({ source: d.source, value: d.value })),
      ...(earliest && { earliest: earliest.date }),
      ...(unparseable.length > 0 && { unparseable }),
    };

    if (earliest && earliest.at! <= now) {
      return fail(ID, `unavailable_after ${earliest.value} has passed: Google no longer shows this page`, {
        ...details,
        recommendation: 'Remove the unavailable_after directive if the page should still appear in search results.',
      });
    }
    if (earliest && earliest.at! - now <= SOON_DAYS * DAY_MS) {
      const days = Math.ceil((earliest.at! - now) / DAY_MS);
      return warn(ID, `unavailable_after ${earliest.value} is ${days} day(s) away: the page will leave search results then`, details);
    }
    if (unparseable.length > 0) {
      return warn(ID, `unavailable_after date not understood: ${unparseable.join('; ')}`, {
        ...details,
        recommendation: 'Write the date in RFC 822, RFC 850 or ISO 8601 form, for example 2026-12-31T23:59:59Z.',
      });
    }
    return pass(ID, `unavailable_after ${earliest!.value}: the page leaves search results on that date`, details);
  },
});
