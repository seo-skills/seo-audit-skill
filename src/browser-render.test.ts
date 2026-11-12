import { describe, it, expect } from 'vitest';
import { resolveBrowserRender, type BrowserRenderRequest } from './browser-render.js';

/** Every combination of the three flags, each unset, on or off */
const STATES = [undefined, true, false] as const;
const ALL_REQUESTS: BrowserRenderRequest[] = STATES.flatMap((cwv) =>
  STATES.flatMap((mobile) =>
    STATES.map((simulateInteraction) => ({ cwv, mobile, simulateInteraction }))
  )
);

describe('resolveBrowserRender', () => {
  it('does not render when nothing asks for it', () => {
    expect(resolveBrowserRender({})).toEqual({
      measureCwv: false,
      mobile: false,
      simulateInteraction: false,
    });
    // The CLI's own defaults: --mobile and --simulate-interaction parse as false
    expect(resolveBrowserRender({ mobile: false, simulateInteraction: false })).toEqual({
      measureCwv: false,
      mobile: false,
      simulateInteraction: false,
    });
  });

  it('renders on --cwv and honours what rides on it', () => {
    expect(resolveBrowserRender({ cwv: true })).toEqual({
      measureCwv: true,
      mobile: false,
      simulateInteraction: false,
    });
    expect(resolveBrowserRender({ cwv: true, mobile: true, simulateInteraction: true })).toEqual({
      measureCwv: true,
      mobile: true,
      simulateInteraction: true,
    });
  });

  it('does not render on --no-cwv alone', () => {
    expect(resolveBrowserRender({ cwv: false }).measureCwv).toBe(false);
  });

  it('renders for --mobile or --simulate-interaction without --cwv, as through 7.0.0', () => {
    expect(resolveBrowserRender({ mobile: true })).toEqual({
      measureCwv: true,
      mobile: true,
      simulateInteraction: false,
    });
    expect(resolveBrowserRender({ simulateInteraction: true })).toEqual({
      measureCwv: true,
      mobile: false,
      simulateInteraction: true,
    });
  });

  it('lets an explicit --no-cwv win over --mobile and --simulate-interaction', () => {
    expect(resolveBrowserRender({ cwv: false, mobile: true, simulateInteraction: true })).toEqual({
      measureCwv: false,
      mobile: false,
      simulateInteraction: false,
    });
  });

  // Whatever the answer for --mobile without --cwv, these hold for every input
  it.each(ALL_REQUESTS)('keeps its invariants for %o', (request) => {
    const render = resolveBrowserRender(request);
    // A mobile render or a synthetic interaction only exists inside a render
    if (render.mobile || render.simulateInteraction) expect(render.measureCwv).toBe(true);
    // Never does browser work nobody asked for
    if (render.mobile) expect(request.mobile).toBe(true);
    if (render.simulateInteraction) expect(request.simulateInteraction).toBe(true);
    if (request.cwv === true) expect(render.measureCwv).toBe(true);
  });
});
