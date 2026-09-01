import { describe, it, expect } from 'vitest';
import { createTestContext } from '../test-context.js';
import { iframeTitleRule } from './iframe-title.js';
import { objectAltRule } from './object-alt.js';
import { emptyHeadingRule } from './empty-heading.js';
import { inputImageAltRule } from './input-image-alt.js';
import { mainLandmarkRule } from './main-landmark.js';
import { listStructureRule } from './list-structure.js';
import { duplicateIdRule } from './duplicate-id.js';
import { tabindexPositiveRule } from './tabindex-positive.js';
import { accesskeyUniqueRule } from './accesskey-unique.js';
import { formMultipleLabelsRule } from './form-multiple-labels.js';
import { ariaValidRule } from './aria-valid.js';
import { ariaHiddenFocusableRule } from './aria-hidden-focusable.js';
import { svgImgAltRule } from './svg-img-alt.js';
import { presentationRoleConflictRule } from './presentation-role-conflict.js';
import { validLangElementRule } from './valid-lang-element.js';
import { redundantAltRule } from './redundant-alt.js';
import { tableCaptionRule } from './table-caption.js';
import { identicalLinksPurposeRule } from './identical-links-purpose.js';
import { labelNameMismatchRule } from './label-name-mismatch.js';

const run = async (rule: { run: Function }, html: string) =>
  await rule.run(createTestContext(html));

describe('a11y-iframe-title', () => {
  it('fails an untitled frame', async () => {
    expect((await run(iframeTitleRule, '<iframe src="/x"></iframe>')).status).toBe('fail');
  });
  it('passes a titled frame', async () => {
    expect((await run(iframeTitleRule, '<iframe src="/x" title="Map"></iframe>')).status).toBe('pass');
  });
  it('ignores a frame hidden from assistive tech', async () => {
    expect((await run(iframeTitleRule, '<iframe src="/x" aria-hidden="true"></iframe>')).status).toBe('pass');
  });
});

describe('a11y-object-alt', () => {
  it('fails an object with no alternative', async () => {
    expect((await run(objectAltRule, '<object data="/x.pdf"></object>')).status).toBe('fail');
  });
  it('accepts inner fallback content', async () => {
    expect((await run(objectAltRule, '<object data="/x.pdf">Annual report</object>')).status).toBe('pass');
  });
});

describe('a11y-empty-heading', () => {
  it('fails an empty heading', async () => {
    expect((await run(emptyHeadingRule, '<h2></h2>')).status).toBe('fail');
  });
  it('accepts a heading named by an image alt', async () => {
    expect((await run(emptyHeadingRule, '<h2><img src="/l.png" alt="Acme"></h2>')).status).toBe('pass');
  });
  it('fails a heading holding only an unlabelled image', async () => {
    expect((await run(emptyHeadingRule, '<h2><img src="/l.png" alt=""></h2>')).status).toBe('fail');
  });
});

describe('a11y-input-image-alt', () => {
  it('fails an image button with no alt', async () => {
    expect((await run(inputImageAltRule, '<input type="image" src="/go.png">')).status).toBe('fail');
  });
  it('passes when alt is present', async () => {
    expect((await run(inputImageAltRule, '<input type="image" src="/go.png" alt="Search">')).status).toBe('pass');
  });
});

describe('a11y-main-landmark', () => {
  it('fails with no main', async () => {
    expect((await run(mainLandmarkRule, '<div>content</div>')).status).toBe('fail');
  });
  it('passes with one main', async () => {
    expect((await run(mainLandmarkRule, '<main>content</main>')).status).toBe('pass');
  });
  it('accepts role="main"', async () => {
    expect((await run(mainLandmarkRule, '<div role="main">content</div>')).status).toBe('pass');
  });
  it('warns on more than one main', async () => {
    expect((await run(mainLandmarkRule, '<main>a</main><main>b</main>')).status).toBe('warn');
  });
});

describe('a11y-list-structure', () => {
  it('fails a non-li child of a list', async () => {
    expect((await run(listStructureRule, '<ul><div>x</div></ul>')).status).toBe('fail');
  });
  it('fails an orphaned li', async () => {
    expect((await run(listStructureRule, '<div><li>x</li></div>')).status).toBe('fail');
  });
  it('allows script and template inside a list', async () => {
    expect((await run(listStructureRule, '<ul><li>a</li><script>0</script></ul>')).status).toBe('pass');
  });
  it('fails a dd outside a dl', async () => {
    expect((await run(listStructureRule, '<div><dd>x</dd></div>')).status).toBe('fail');
  });
  it('accepts a dl wrapping its terms in a div', async () => {
    expect((await run(listStructureRule, '<dl><div><dt>a</dt><dd>b</dd></div></dl>')).status).toBe('pass');
  });
});

describe('a11y-duplicate-id', () => {
  it('warns on a duplicated id that nothing references', async () => {
    expect((await run(duplicateIdRule, '<p id="x">a</p><p id="x">b</p>')).status).toBe('warn');
  });
  it('fails when an aria reference targets the duplicate', async () => {
    const result = await run(
      duplicateIdRule,
      '<span id="lbl">A</span><span id="lbl">B</span><input aria-labelledby="lbl">'
    );
    expect(result.status).toBe('fail');
    expect(result.details?.breakingCount).toBe(1);
  });
  it('passes duplicated ids that only exist inside SVG', async () => {
    // The same inlined icon twice duplicates its defs ids; they are referenced
    // by url(#id), not by ARIA, so nothing is broken.
    const html =
      '<svg><clipPath id="clip0"><path d="M0 0"/></clipPath></svg>' +
      '<svg><clipPath id="clip0"><path d="M0 0"/></clipPath></svg>';
    const result = await run(duplicateIdRule, html);
    expect(result.status).toBe('pass');
    expect(result.details?.svgInternalCount).toBe(1);
  });
  it('passes unique ids', async () => {
    expect((await run(duplicateIdRule, '<p id="a"></p><p id="b"></p>')).status).toBe('pass');
  });
});

describe('a11y-tabindex-positive', () => {
  it('warns on tabindex above 0', async () => {
    expect((await run(tabindexPositiveRule, '<div tabindex="3"></div>')).status).toBe('warn');
  });
  it('accepts 0 and -1', async () => {
    expect((await run(tabindexPositiveRule, '<div tabindex="0"></div><div tabindex="-1"></div>')).status).toBe('pass');
  });
});

describe('a11y-accesskey-unique', () => {
  it('warns on a reused access key', async () => {
    expect((await run(accesskeyUniqueRule, '<a accesskey="s">a</a><a accesskey="S">b</a>')).status).toBe('warn');
  });
  it('passes distinct keys', async () => {
    expect((await run(accesskeyUniqueRule, '<a accesskey="s">a</a><a accesskey="h">b</a>')).status).toBe('pass');
  });
});

describe('a11y-form-multiple-labels', () => {
  it('warns when two labels target one control', async () => {
    const html = '<label for="q">A</label><label for="q">B</label><input id="q">';
    expect((await run(formMultipleLabelsRule, html)).status).toBe('warn');
  });
  it('ignores labels pointing at nothing', async () => {
    const html = '<label for="gone">A</label><label for="gone">B</label>';
    expect((await run(formMultipleLabelsRule, html)).status).toBe('pass');
  });
});

describe('a11y-aria-valid', () => {
  it('fails an invented role', async () => {
    expect((await run(ariaValidRule, '<div role="buton">x</div>')).status).toBe('fail');
  });
  it('fails a misspelled aria attribute', async () => {
    expect((await run(ariaValidRule, '<div aria-lable="x">y</div>')).status).toBe('fail');
  });
  it('fails a non-boolean value on a boolean attribute', async () => {
    expect((await run(ariaValidRule, '<div aria-hidden="yes">y</div>')).status).toBe('fail');
  });
  it('passes valid ARIA', async () => {
    expect((await run(ariaValidRule, '<div role="button" aria-label="Go" aria-hidden="false"></div>')).status).toBe('pass');
  });
});

describe('a11y-aria-hidden-focusable', () => {
  it('fails aria-hidden wrapping a link', async () => {
    expect((await run(ariaHiddenFocusableRule, '<div aria-hidden="true"><a href="/x">x</a></div>')).status).toBe('fail');
  });
  it('accepts aria-hidden when descendants are removed from the tab order', async () => {
    const html = '<div aria-hidden="true"><a href="/x" tabindex="-1">x</a></div>';
    expect((await run(ariaHiddenFocusableRule, html)).status).toBe('pass');
  });
  it('fails aria-hidden on body', async () => {
    expect((await run(ariaHiddenFocusableRule, '<body aria-hidden="true"><p>x</p></body>')).status).toBe('fail');
  });
});

describe('a11y-svg-img-alt', () => {
  it('fails an unnamed svg image', async () => {
    expect((await run(svgImgAltRule, '<svg role="img"><path d="M0 0"/></svg>')).status).toBe('fail');
  });
  it('accepts a <title> child', async () => {
    expect((await run(svgImgAltRule, '<svg role="img"><title>Logo</title></svg>')).status).toBe('pass');
  });
  it('ignores decorative svgs with no img role', async () => {
    expect((await run(svgImgAltRule, '<svg><path d="M0 0"/></svg>')).status).toBe('pass');
  });
});

describe('a11y-presentation-role-conflict', () => {
  it('warns when a global aria attribute negates the role', async () => {
    expect((await run(presentationRoleConflictRule, '<div role="none" aria-label="x"></div>')).status).toBe('warn');
  });
  it('warns when the element stays focusable', async () => {
    expect((await run(presentationRoleConflictRule, '<div role="presentation" tabindex="0"></div>')).status).toBe('warn');
  });
  it('passes a clean presentation role', async () => {
    expect((await run(presentationRoleConflictRule, '<table role="presentation"><tr><td>x</td></tr></table>')).status).toBe('pass');
  });
});

describe('a11y-valid-lang-element', () => {
  it('warns on a malformed tag', async () => {
    expect((await run(validLangElementRule, '<p lang="english">x</p>')).status).toBe('warn');
  });
  it('accepts a region subtag', async () => {
    expect((await run(validLangElementRule, '<p lang="pt-BR">x</p>')).status).toBe('pass');
  });
  it('leaves <html lang> to the i18n rule', async () => {
    expect((await run(validLangElementRule, '<html lang="nonsense-!"><body>x</body></html>')).status).toBe('pass');
  });
});

describe('a11y-redundant-alt', () => {
  it('warns when alt repeats the link text', async () => {
    expect((await run(redundantAltRule, '<a href="/x"><img src="/i.png" alt="Read more">Read more</a>')).status).toBe('warn');
  });
  it('passes when alt adds information', async () => {
    expect((await run(redundantAltRule, '<a href="/x"><img src="/i.png" alt="Chart icon">Q3 results</a>')).status).toBe('pass');
  });
});

describe('a11y-table-caption', () => {
  it('warns on an uncaptioned data table', async () => {
    const html = '<table><tr><th>a</th><th>b</th></tr><tr><td>1</td><td>2</td></tr></table>';
    expect((await run(tableCaptionRule, html)).status).toBe('warn');
  });
  it('passes a captioned table', async () => {
    const html = '<table><caption>Sales</caption><tr><th>a</th><th>b</th></tr><tr><td>1</td><td>2</td></tr></table>';
    expect((await run(tableCaptionRule, html)).status).toBe('pass');
  });
  it('ignores layout tables', async () => {
    const html = '<table role="presentation"><tr><td>a</td><td>b</td></tr><tr><td>1</td><td>2</td></tr></table>';
    expect((await run(tableCaptionRule, html)).status).toBe('pass');
  });
});

describe('a11y-identical-links-purpose', () => {
  it('warns when the same text goes to different places', async () => {
    const html = '<a href="/a">Read more</a><a href="/b">Read more</a>';
    expect((await run(identicalLinksPurposeRule, html)).status).toBe('warn');
  });
  it('passes when the same text goes to the same place', async () => {
    const html = '<a href="/a">Read more</a><a href="/a">Read more</a>';
    expect((await run(identicalLinksPurposeRule, html)).status).toBe('pass');
  });
  it('uses aria-label over visible text when both exist', async () => {
    const html = '<a href="/a" aria-label="Read about pricing">More</a><a href="/b" aria-label="Read about support">More</a>';
    expect((await run(identicalLinksPurposeRule, html)).status).toBe('pass');
  });
});

describe('a11y-label-name-mismatch', () => {
  it('warns when the accessible name omits the visible text', async () => {
    expect((await run(labelNameMismatchRule, '<button aria-label="Send form">Submit</button>')).status).toBe('warn');
  });
  it('accepts a name that extends the visible text', async () => {
    expect((await run(labelNameMismatchRule, '<button aria-label="Search products">Search</button>')).status).toBe('pass');
  });
});
