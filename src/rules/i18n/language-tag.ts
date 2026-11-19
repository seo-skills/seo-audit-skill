/**
 * Language tags, as `<html lang>` and hreflang carry them.
 *
 * Three rules each had their own pattern and each got BCP 47 wrong in a
 * different way (GitHub issue #14): `i18n-lang-attribute` warned on `es-419`,
 * `EN-US` and `de-CH-1996` and passed the malformed `es419`, and both
 * hreflang rules failed a script subtag (`zh-Hant`) or a lowercase region
 * (`en-gb`). Tags are case-insensitive (RFC 5646, section 2.1.1).
 */

/**
 * RFC 5646 section 2.1 well-formedness. The ABNF also allows a 4-letter or a
 * 5 to 8-letter primary subtag, but none is registered, so `english` is still
 * reported as the mistake it is.
 */
const LANGUAGE_TAG = new RegExp(
  '^(?:' +
    '[a-z]{2,3}(?:-[a-z]{3}){0,3}' + // language, then up to three extlang subtags
    '(?:-[a-z]{4})?' + // script (ISO 15924)
    '(?:-(?:[a-z]{2}|\\d{3}))?' + // region (ISO 3166-1 alpha-2 or UN M.49)
    '(?:-(?:[a-z\\d]{5,8}|\\d[a-z\\d]{3}))*' + // variants
    '(?:-[a-wy-z\\d](?:-[a-z\\d]{2,8})+)*' + // extensions
    '(?:-x(?:-[a-z\\d]{1,8})+)?' + // private use
    '|x(?:-[a-z\\d]{1,8})+' + // a private-use tag on its own
    '|en-gb-oed|i-(?:ami|bnn|default|enochian|hak|klingon|lux|mingo|navajo|pwn|tao|tay|tsu)|sgn-(?:be-fr|be-nl|ch-de)' + // irregular grandfathered tags
    ')$',
  'i'
);

/**
 * What Google reads as an hreflang code besides `x-default`: an ISO 639-1
 * language with an optional ISO 15924 script and an optional ISO 3166-1
 * alpha-2 region (`de`, `en-GB`, `zh-Hant`, `zh-Hans-US`), in any case.
 * Google documents no numeric region or variant there, so `es-419` and
 * `de-CH-1996` are valid `<html lang>` values but not hreflang codes.
 */
const HREFLANG_CODE = /^([a-z]{2})(?:-[a-z]{4})?(?:-[a-z]{2})?$/i;

const LANGUAGE_NAMES = new Intl.DisplayNames(['en'], { type: 'language', fallback: 'none' });

/**
 * Whether two letters name a language (ISO 639-1). Any two letters would let
 * a country code stand in for a language, as in `hreflang="GB"`, which the
 * old case-sensitive patterns rejected only because it was upper case.
 */
function isTwoLetterLanguage(code: string): boolean {
  return LANGUAGE_NAMES.of(code.toLowerCase()) !== undefined;
}

/** A well-formed BCP 47 tag whose two-letter primary language, if it has one, exists */
export function isLanguageTag(tag: string): boolean {
  if (!LANGUAGE_TAG.test(tag)) return false;
  const primary = tag.slice(0, tag.indexOf('-') === -1 ? tag.length : tag.indexOf('-'));
  return primary.length !== 2 || isTwoLetterLanguage(primary);
}

/** The hreflang fallback value, in any case */
export function isXDefault(value: string): boolean {
  return value.toLowerCase() === 'x-default';
}

/** An hreflang value Google reads: `x-default`, or a language with an optional script and region */
export function isHreflangCode(value: string): boolean {
  if (isXDefault(value)) return true;
  const match = HREFLANG_CODE.exec(value);
  return match !== null && isTwoLetterLanguage(match[1]!);
}
