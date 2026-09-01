import { describe, it, expect } from 'vitest';
import { createTestContext } from '../test-context.js';
import { legacyJavascriptRule } from './legacy-javascript.js';

describe('perf-legacy-javascript', () => {
  it('flags a polyfill.io script', async () => {
    const ctx = createTestContext('<script src="https://polyfill.io/v3/polyfill.min.js"></script>');
    expect((await legacyJavascriptRule.run(ctx)).status).toBe('warn');
  });

  it('flags core-js', async () => {
    const ctx = createTestContext('<script src="/vendor/core-js.bundle.js"></script>');
    expect((await legacyJavascriptRule.run(ctx)).status).toBe('warn');
  });

  it('flags a transpiler runtime in an inline script', async () => {
    const ctx = createTestContext('<script>regeneratorRuntime.async(function(){});</script>');
    expect((await legacyJavascriptRule.run(ctx)).status).toBe('warn');
  });

  it('reports each library once', async () => {
    const ctx = createTestContext(
      '<script src="/a/core-js.js"></script><script src="/b/core-js.js"></script>'
    );
    const detected = (await legacyJavascriptRule.run(ctx)).details?.detected as unknown[];
    expect(detected).toHaveLength(1);
  });

  it('passes a modern bundle', async () => {
    const ctx = createTestContext('<script type="module" src="/app.mjs"></script>');
    expect((await legacyJavascriptRule.run(ctx)).status).toBe('pass');
  });
});
