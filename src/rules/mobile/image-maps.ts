import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

// Reference hint: mobile-friendly/has-one-or-more-image-map-map-tags

/**
 * Rule: Image Maps
 *
 * Detects client-side image maps (<map> with <area> children). Image maps
 * rely on precise pixel coordinates over a fixed-size image, so their tap
 * targets do not reflow or rescale with the layout and are effectively
 * unusable on small touch screens.
 *
 * Responsive alternatives are SVG with <a> links, or absolutely-positioned
 * links over a fluid image.
 */
export const imageMapsRule = defineRule({
  id: 'mobile-image-maps',
  name: 'Image Maps',
  description: 'Checks for <map>/<area> image maps, which are not mobile-friendly',
  category: 'mobile',
  weight: 8,
  run: (context: AuditContext) => {
    const { $ } = context;

    const mapCount = $('map').length;
    const areaCount = $('area').length;

    if (mapCount === 0 && areaCount === 0) {
      return pass(
        'mobile-image-maps',
        'No image map tags found',
        { mapCount: 0, areaCount: 0 }
      );
    }

    return warn(
      'mobile-image-maps',
      `Page uses image maps (${mapCount} <map>, ${areaCount} <area>); their fixed-coordinate tap targets do not adapt to mobile screens`,
      {
        mapCount,
        areaCount,
        recommendation: 'Replace image maps with SVG links or positioned anchors over a fluid image',
      }
    );
  },
});
