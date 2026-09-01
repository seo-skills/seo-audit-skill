import { describe, it, expect } from 'vitest';
import { createTestContext } from '../test-context.js';
import { documentWriteRule } from './document-write.js';

describe('js-document-write', () => {
  it('warns on a document.write call', async () => {
    const ctx = createTestContext('<script>document.write("<b>hi</b>");</script>');
    const result = await documentWriteRule.run(ctx);
    expect(result.status).toBe('warn');
    expect(result.details?.total).toBe(1);
  });

  it('catches document.writeln and whitespace around the dot', async () => {
    const ctx = createTestContext('<script>document . writeln ("x");</script>');
    expect((await documentWriteRule.run(ctx)).status).toBe('warn');
  });

  it('counts every call across scripts', async () => {
    const ctx = createTestContext(
      '<script>document.write("a");document.write("b");</script><script>document.write("c");</script>'
    );
    expect((await documentWriteRule.run(ctx)).details?.total).toBe(3);
  });

  it('ignores external scripts, whose source it cannot see', async () => {
    const ctx = createTestContext('<script src="/app.js"></script>');
    expect((await documentWriteRule.run(ctx)).status).toBe('pass');
  });

  it('passes a page with no inline scripts', async () => {
    expect((await documentWriteRule.run(createTestContext('<p>hi</p>'))).status).toBe('pass');
  });
});
