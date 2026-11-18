import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, notMeasured } from '../define-rule.js';
import { findOgTag } from './open-graph.js';
import { fetchShareImage, shareImages } from './share-image.js';

const ID = 'social-og-image-size';

/**
 * Rule: og:image:width and og:image:height match the image
 *
 * Platforms lay out a card from the declared size before the image loads.
 * When the declaration is wrong, the card is laid out for a different image
 * and then reflows or crops. Whether the image is large enough is
 * `social-og-image-reachable`'s question; this one asks only whether the page
 * tells the truth about it.
 */
export const ogImageSizeRule = defineRule({
  id: ID,
  name: 'Open Graph Image Size',
  description: 'Checks that og:image:width and og:image:height match the real size of the og:image',
  category: 'social',
  weight: 1,
  run: async (context: AuditContext) => {
    const { $ } = context;
    const widthMeta = findOgTag($, 'og:image:width')?.content;
    const heightMeta = findOgTag($, 'og:image:height')?.content;
    const og = shareImages(context).find((image) => image.role === 'og:image');

    if (!og) {
      return notMeasured(ID, 'No og:image to check', undefined, 'not-applicable');
    }
    if (!widthMeta && !heightMeta) {
      return notMeasured(ID, 'og:image:width and og:image:height are not declared, so there is nothing to compare', undefined, 'not-applicable');
    }

    const declaredWidth = widthMeta ? Number(widthMeta) : null;
    const declaredHeight = heightMeta ? Number(heightMeta) : null;
    if (
      (widthMeta && !(Number.isInteger(declaredWidth) && declaredWidth! > 0)) ||
      (heightMeta && !(Number.isInteger(declaredHeight) && declaredHeight! > 0))
    ) {
      return warn(ID, 'og:image:width or og:image:height is not a whole number of pixels', {
        ogImage: og.url,
        widthMeta,
        heightMeta,
      });
    }

    const fetched = await fetchShareImage(context, og);
    const real = fetched.header;
    if (!real?.width || !real.height) {
      const why = fetched.unverified?.why ?? fetched.broken ?? `the ${real?.format ?? 'image'} header does not state its size`;
      return notMeasured(ID, `The real size of the og:image could not be read: ${why}`, { ogImage: og.url }, fetched.unverified?.reason ?? 'could-not-verify');
    }

    const details = {
      ogImage: og.url,
      declared: { width: declaredWidth, height: declaredHeight },
      actual: { width: real.width, height: real.height },
    };
    const wrongWidth = declaredWidth !== null && declaredWidth !== real.width;
    const wrongHeight = declaredHeight !== null && declaredHeight !== real.height;
    if (wrongWidth || wrongHeight) {
      return warn(
        ID,
        `og:image declares ${declaredWidth ?? '?'}×${declaredHeight ?? '?'} but the image is ${real.width}×${real.height}`,
        { ...details, recommendation: `Set og:image:width to ${real.width} and og:image:height to ${real.height}.` }
      );
    }
    return pass(ID, `og:image:width and og:image:height match the image (${real.width}×${real.height})`, details);
  },
});
