/**
 * Selector for the document's own <title> elements.
 *
 * Inline SVG carries its own <title>, the graphic's accessible name, and a
 * bare `title` selector matches those too. On a page with an SVG logo that
 * counts extra "titles", finds them "outside <head>", and runs them into the
 * real title through `.text()` ("… | MDNMDNMDNMozilla" on
 * developer.mozilla.org). A <title> stray in <body> still matches, so the
 * htmlval checks keep seeing it.
 */
export const DOCUMENT_TITLE = 'title:not(svg title)';
