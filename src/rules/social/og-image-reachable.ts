import type { AuditContext, RuleStatus } from '../../types.js';
import { defineRule, pass, warn, fail, notMeasured } from '../define-rule.js';
import { MAX_SHARE_IMAGE_BYTES, fetchShareImage, shareImages, type FetchedShareImage } from './share-image.js';

const ID = 'social-og-image-reachable';

/** Pixel sizes per card shape: under `min` fails, under `good` warns */
const SHAPES = {
  landscape: { min: [600, 315], good: [1200, 630], ratio: 1.91 },
  square: { min: [144, 144], good: [144, 144], ratio: 1 },
} as const;
/** How far off the shape's ratio an image may be before it is cropped badly */
const RATIO_TOLERANCE = 0.05;

interface Finding {
  status: Exclude<RuleStatus, 'pass' | 'not-measured'>;
  message: string;
}

const mb = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

/** What is wrong with one fetched image, worst first; empty when nothing is */
function assess(fetched: FetchedShareImage): Finding[] {
  const { image, info, header, size } = fetched;
  const label = `${image.role} ${image.url}`;
  if (fetched.broken) return [{ status: 'fail', message: `${label} cannot be loaded (${fetched.broken})` }];

  const findings: Finding[] = [];
  const type = info?.contentType?.split(';')[0].trim().toLowerCase() ?? '';
  const knownFormat = header && header.format !== 'unknown';
  if (type ? !type.startsWith('image/') : !knownFormat) {
    findings.push({ status: 'fail', message: `${label} is not an image (served as ${type || 'no content type'})` });
    return findings;
  }
  if (size !== null && size > MAX_SHARE_IMAGE_BYTES) {
    findings.push({ status: 'fail', message: `${label} is ${mb(size)}; platforms may refuse images over 5 MB` });
  }
  if (header?.width && header.height) {
    const shape = SHAPES[image.shape];
    const { width, height } = header;
    if (width < shape.min[0] || height < shape.min[1]) {
      findings.push({ status: 'fail', message: `${label} is ${width}×${height}; the minimum is ${shape.min[0]}×${shape.min[1]}` });
    } else if (width < shape.good[0] || height < shape.good[1]) {
      findings.push({ status: 'warn', message: `${label} is ${width}×${height}; ${shape.good[0]}×${shape.good[1]} displays sharply` });
    }
    const ratio = width / height;
    if (Math.abs(ratio - shape.ratio) / shape.ratio > RATIO_TOLERANCE) {
      findings.push({ status: 'warn', message: `${label} is ${ratio.toFixed(2)}:1; cards crop to ${shape.ratio}:1` });
    }
  }
  return findings.sort((a, b) => (a.status === 'fail' ? 0 : 1) - (b.status === 'fail' ? 0 : 1));
}

/**
 * Rule: the share image loads, is an image, and is the right size
 *
 * A link shared on a social platform shows the page's og:image (or
 * twitter:image). If it is missing, too small or not an image, the post goes
 * out with a blank or broken card, and nothing on the page looks wrong.
 */
export const ogImageReachableRule = defineRule({
  id: ID,
  name: 'Share Image Loads',
  description: 'Fetches og:image and twitter:image and checks they load, are images, are under 5 MB and are large enough',
  category: 'social',
  weight: 5,
  advisory: true,
  run: async (context: AuditContext) => {
    const images = shareImages(context);
    if (images.length === 0) {
      return notMeasured(ID, 'No og:image or twitter:image to check', undefined, 'not-applicable');
    }

    const fetched = await Promise.all(images.map((image) => fetchShareImage(context, image)));
    const checked = fetched.filter((f) => !f.unverified);
    const details = {
      images: fetched.map((f) => ({
        role: f.image.role,
        url: f.image.url,
        ...(f.info && { status: f.info.status, contentType: f.info.contentType }),
        ...(f.size !== null && { bytes: f.size }),
        ...(f.header?.format && { format: f.header.format }),
        ...(f.header?.width && { width: f.header.width, height: f.header.height }),
        ...(f.unverified && { couldNotVerify: f.unverified.why }),
      })),
    };

    if (checked.length === 0) {
      const reason = fetched.every((f) => f.unverified?.reason === 'disabled') ? 'disabled' : 'could-not-verify';
      return notMeasured(ID, `The share image could not be checked: ${fetched[0].unverified!.why}`, details, reason);
    }

    const findings = checked.flatMap(assess);
    const failures = findings.filter((f) => f.status === 'fail');
    const warnings = findings.filter((f) => f.status === 'warn');
    if (failures.length > 0) {
      return fail(ID, failures.map((f) => f.message).join('; '), {
        ...details,
        recommendation: 'Serve a JPEG or PNG of at least 1200×630 and under 5 MB at the og:image URL.',
      });
    }
    if (warnings.length > 0) return warn(ID, warnings.map((f) => f.message).join('; '), details);
    return pass(ID, `The share image loads and is ${checked.length === 1 ? 'the right size' : 'right for each card'}`, details);
  },
});
