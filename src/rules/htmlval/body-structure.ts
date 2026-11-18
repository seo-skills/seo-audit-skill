import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail } from '../define-rule.js';
import { scanSource } from './source-scanner.js';

const ID = 'htmlval-body-structure';

interface StructureProblem {
  case: 'multiple-body' | 'body-before-html' | 'content-before-head';
  /** Character offset of the first offending tag or text */
  offset: number;
  message: string;
}

/**
 * Rule: one <body>, after <html>, with nothing between <html> and <head>
 *
 * The parser repairs all three, the way a browser does, so the parsed page
 * looks fine. But text or a tag before <head> makes the parser open the body
 * early: everything after it, the real <head> included, is read as body
 * content, and its meta tags and canonical are ignored. The source shows what
 * the parsed tree no longer does. Leaving out <html>, <head> or <body>
 * altogether is valid HTML and passes.
 */
export const bodyStructureRule = defineRule({
  id: ID,
  name: 'Document Structure',
  description: 'Checks the raw source for a second <body>, a <body> before <html>, and content before <head>',
  category: 'htmlval',
  weight: 5,
  advisory: true,
  run: (context: AuditContext) => {
    const { masked, tags } = scanSource(context.html);
    const starts = tags.filter((tag) => !tag.closing);
    const html = starts.find((tag) => tag.name === 'html');
    const head = starts.find((tag) => tag.name === 'head');
    const bodies = starts.filter((tag) => tag.name === 'body');
    const problems: StructureProblem[] = [];

    if (bodies.length > 1) {
      problems.push({ case: 'multiple-body', offset: bodies[1].start, message: `${bodies.length} <body> start tags` });
    }
    if (html && bodies[0] && bodies[0].start < html.start) {
      problems.push({ case: 'body-before-html', offset: bodies[0].start, message: '<body> comes before <html>' });
    }
    if (html && head && head.start > html.end) {
      const between = masked.slice(html.end, head.start);
      const first = between.search(/\S/);
      if (first !== -1) {
        const what = between[first] === '<' ? 'an element' : 'text';
        problems.push({ case: 'content-before-head', offset: html.end + first, message: `${what} between <html> and <head>` });
      }
    }

    if (problems.length === 0) {
      return pass(ID, 'The document has one <body> and nothing before <head>');
    }
    return fail(
      ID,
      problems.map((p) => `${p.message} (at character ${p.offset})`).join('; '),
      {
        problems,
        recommendation:
          'Keep one <head> and one <body> inside <html>, with nothing but whitespace or comments before <head>. Content before <head> makes browsers and search engines ignore the head.',
      }
    );
  },
});
