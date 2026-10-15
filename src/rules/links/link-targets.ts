import type { LinkInfo } from '../../types.js';

function withoutFragment(url: string): string {
  const hash = url.indexOf('#');
  return hash === -1 ? url : url.slice(0, hash);
}

/**
 * The distinct pages a page's internal links point to.
 *
 * A fragment never reaches the server, so /a and /a#b are one request, and a
 * link back to this page (skip links, "#content") is already known to load.
 * On developer.mozilla.org this turns 448 links into 355 targets.
 *
 * @param links - The page's links
 * @param pageUrl - The audited page's URL
 * @returns Internal target URLs, fragments stripped, the page itself excluded
 */
export function internalLinkTargets(links: LinkInfo[], pageUrl: string): string[] {
  const page = withoutFragment(pageUrl);
  return [
    ...new Set(links.filter((link) => link.isInternal).map((link) => withoutFragment(link.href))),
  ].filter((target) => target !== page);
}
