import type { RenderProbe } from './probes.js';

/** One rendered image: its natural pixels and the box it is shown in */
export interface ImageSizingEntry {
  /** `currentSrc`: the resource the browser chose, srcset included */
  src: string;
  naturalWidth: number;
  naturalHeight: number;
  /** Displayed box, CSS pixels */
  width: number;
  height: number;
}

/**
 * Reads every loaded, displayed <img>. Images not loaded yet (naturalWidth 0)
 * and those with no box are left out: there is nothing to compare.
 */
export const IMAGE_SIZING_PROBE: RenderProbe = {
  id: 'imageSizing',
  family: 'imageSizing',
  timeoutMs: 5000,
  script: `(() => {
    const out = [];
    for (const img of Array.from(document.images)) {
      if (!img.naturalWidth || !img.naturalHeight) continue;
      const box = img.getBoundingClientRect();
      if (box.width < 1 || box.height < 1) continue;
      const style = getComputedStyle(img);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      out.push({
        src: img.currentSrc || img.src,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        width: Math.round(box.width),
        height: Math.round(box.height),
      });
      if (out.length >= 500) break;
    }
    return out;
  })()`,
};
