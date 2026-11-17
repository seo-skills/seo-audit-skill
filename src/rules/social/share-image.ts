/**
 * The page's share images, fetched once per run.
 *
 * `social-og-image-reachable` and `social-og-image-size` both read the same
 * answer: one ranged GET of the first 64 KB, enough for the image's header,
 * shared through the run's URL service by every page that uses the image.
 */
import type { AuditContext } from '../../types.js';
import { urlServiceFor, type UrlInfo } from '../../net/url-service.js';
import { findOgTag } from './open-graph.js';
import { readImageHeader, type ImageHeader } from './image-header.js';

/** Enough of an image to read its header */
export const SHARE_IMAGE_BYTES = 64 * 1024;
/** Above this, platforms may refuse the image */
export const MAX_SHARE_IMAGE_BYTES = 5 * 1024 * 1024;

export interface ShareImage {
  role: 'og:image' | 'twitter:image';
  url: string;
  /** `summary` Twitter cards are square; `summary_large_image` and Open Graph are landscape */
  shape: 'landscape' | 'square';
}

export interface FetchedShareImage {
  image: ShareImage;
  /** Why it could not be checked; absent when it was */
  unverified?: { reason: 'disabled' | 'could-not-verify'; why: string };
  /** The image is gone: same origin not 200/206, other origin broken */
  broken?: string;
  info?: UrlInfo;
  header?: ImageHeader;
  /** Full size in bytes, when the response states it */
  size: number | null;
}

function absolute(href: string | undefined, base: string): string | null {
  if (!href?.trim()) return null;
  try {
    const url = new URL(href.trim(), base);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

/** og:image, and twitter:image when it names a different image */
export function shareImages(context: AuditContext): ShareImage[] {
  const { $ } = context;
  const og = absolute(findOgTag($, 'og:image')?.content, context.url);
  const twitter = absolute(
    $('meta[name="twitter:image" i], meta[property="twitter:image" i], meta[name="twitter:image:src" i]').first().attr('content'),
    context.url
  );
  const card = ($('meta[name="twitter:card" i], meta[property="twitter:card" i]').first().attr('content') ?? '').trim().toLowerCase();

  const images: ShareImage[] = [];
  if (og) images.push({ role: 'og:image', url: og, shape: 'landscape' });
  if (twitter && twitter !== og) images.push({ role: 'twitter:image', url: twitter, shape: card === 'summary' ? 'square' : 'landscape' });
  return images;
}

/** The full size: the Content-Range total on a 206, Content-Length on a 200 */
function fullSize(info: UrlInfo): number | null {
  if (info.status === 206) {
    const total = info.headers['content-range']?.match(/\/(\d+)\s*$/);
    return total ? Number(total[1]) : null;
  }
  const length = info.headers['content-length'];
  return length !== undefined && /^\d+$/.test(length.trim()) ? Number(length) : null;
}

export async function fetchShareImage(context: AuditContext, image: ShareImage): Promise<FetchedShareImage> {
  const sameOrigin = new URL(image.url).origin === new URL(context.url).origin;
  if (!sameOrigin && context.externalLinks?.enabled === false) {
    return { image, size: null, unverified: { reason: 'disabled', why: 'external requests are off ([external_links] enabled = false)' } };
  }

  const info = await urlServiceFor(context).get(image.url, { method: 'GET', needBytes: SHARE_IMAGE_BYTES });
  // No answer, or one the host kept rate-limiting, says nothing about the image
  if (info.status === 0 || info.rateLimited) {
    return { image, info, size: null, unverified: { reason: 'could-not-verify', why: info.rateLimited ? `rate-limited (HTTP ${info.status})` : (info.failure ?? 'no response') } };
  }
  if (sameOrigin) {
    if (info.status !== 200 && info.status !== 206) return { image, info, size: null, broken: `HTTP ${info.status}` };
  } else if (info.verdict === 'broken') {
    return { image, info, size: null, broken: `HTTP ${info.status}` };
  } else if (info.verdict !== 'ok') {
    return { image, info, size: null, unverified: { reason: 'could-not-verify', why: `refused (HTTP ${info.status})` } };
  }
  return { image, info, size: fullSize(info), header: readImageHeader(info.bytes) };
}
