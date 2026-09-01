import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import type { AuditContext } from '../../types.js';
import { emptyHtmlRule } from './empty-html.js';
import { formGetMethodRule } from './form-get-method.js';
import { duplicateGtmRule } from './duplicate-gtm.js';
import { duplicateGaRule } from './duplicate-ga.js';

/**
 * Helper to create an audit context from HTML
 */
function createContext(
  html: string,
  overrides: Partial<AuditContext> = {}
): AuditContext {
  return {
    url: 'https://example.com',
    html,
    $: cheerio.load(html),
    headers: {},
    statusCode: 200,
    responseTime: 100,
    cwv: {},
    links: [],
    images: [],
    invalidLinks: [],
    specialLinks: [],
    figures: [],
    inlineSvgs: [],
    pictureElements: [],
    ...overrides,
  };
}

describe('Technical Rules', () => {
  describe('technical-empty-html', () => {
    it('should pass when the page contains meaningful HTML content', async () => {
      const context = createContext(
        '<!doctype html><html><head><title>Hi</title></head><body><h1>Hello</h1></body></html>'
      );
      const result = await emptyHtmlRule.run(context);
      expect(result.status).toBe('pass');
      expect(result.score).toBe(100);
    });

    it('should fail when the response HTML is empty', async () => {
      const context = createContext('   \n  ');
      const result = await emptyHtmlRule.run(context);
      expect(result.status).toBe('fail');
      expect(result.score).toBe(0);
      expect(result.message).toContain('empty body');
    });

    it('should fail when head and body are both empty', async () => {
      const context = createContext(
        '<!doctype html><html><head></head><body></body></html>'
      );
      const result = await emptyHtmlRule.run(context);
      expect(result.status).toBe('fail');
      expect(result.message).toContain('no meaningful content');
    });

    it('should fail when the body is missing and the head is empty', async () => {
      const context = createContext('<!doctype html><html><head></head></html>');
      const result = await emptyHtmlRule.run(context);
      expect(result.status).toBe('fail');
    });

    it('should pass for non-200 responses regardless of content', async () => {
      const context = createContext('', { statusCode: 404 });
      const result = await emptyHtmlRule.run(context);
      expect(result.status).toBe('pass');
      expect(result.message).toContain('404');
    });

    it('should return notMeasured when the HTML was not collected', async () => {
      const context = createContext('', {
        html: undefined as unknown as string,
        $: undefined as unknown as AuditContext['$'],
      });
      const result = await emptyHtmlRule.run(context);
      expect(result.status).toBe('warn');
      expect(result.weight).toBe(0);
    });
  });

  describe('technical-form-get-method', () => {
    it('should pass when there are no forms', async () => {
      const context = createContext('<html><body><p>No forms</p></body></html>');
      const result = await formGetMethodRule.run(context);
      expect(result.status).toBe('pass');
    });

    it('should pass when all forms use POST', async () => {
      const context = createContext(
        '<html><body><form method="post" action="/submit"><input name="q"></form></body></html>'
      );
      const result = await formGetMethodRule.run(context);
      expect(result.status).toBe('pass');
    });

    it('should warn when a form explicitly uses method="get"', async () => {
      const context = createContext(
        '<html><body><form method="GET" action="/search"><input name="q"></form></body></html>'
      );
      const result = await formGetMethodRule.run(context);
      expect(result.status).toBe('warn');
      expect(result.score).toBe(50);
      expect(result.details?.actions).toEqual(['/search']);
    });

    it('should warn when a form omits the method attribute (defaults to GET)', async () => {
      const context = createContext(
        '<html><body><form action="/search"><input name="q"></form></body></html>'
      );
      const result = await formGetMethodRule.run(context);
      expect(result.status).toBe('warn');
      expect(result.details?.actions).toEqual(['/search']);
    });

    it('should warn for forms without an action, reported as the current URL', async () => {
      const context = createContext(
        '<html><body><form method="get"><input name="q"></form></body></html>'
      );
      const result = await formGetMethodRule.run(context);
      expect(result.status).toBe('warn');
      expect(result.details?.actions).toEqual(['(current URL)']);
    });

    it('should warn only about the GET forms when methods are mixed', async () => {
      const context = createContext(
        `<html><body>
          <form method="post" action="/login"></form>
          <form method="get" action="/search"></form>
          <form method="get" action="/filter"></form>
        </body></html>`
      );
      const result = await formGetMethodRule.run(context);
      expect(result.status).toBe('warn');
      expect(result.details?.formCount).toBe(2);
      expect(result.details?.actions).toEqual(['/search', '/filter']);
    });

    it('should return notMeasured when the DOM was not collected', async () => {
      const context = createContext('', {
        $: undefined as unknown as AuditContext['$'],
      });
      const result = await formGetMethodRule.run(context);
      expect(result.status).toBe('warn');
      expect(result.weight).toBe(0);
    });
  });

  describe('technical-duplicate-gtm', () => {
    it('should pass when no GTM container is present', async () => {
      const context = createContext('<html><body><p>No tracking</p></body></html>');
      const result = await duplicateGtmRule.run(context);
      expect(result.status).toBe('pass');
      expect(result.details?.containerIds).toEqual([]);
    });

    it('should pass when a single GTM container is embedded', async () => {
      const context = createContext(`
        <html><head>
          <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
          new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
          j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
          'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
          })(window,document,'script','dataLayer','GTM-ABC123');</script>
        </head><body></body></html>
      `);
      const result = await duplicateGtmRule.run(context);
      expect(result.status).toBe('pass');
      expect(result.details?.containerIds).toEqual(['GTM-ABC123']);
    });

    it('should pass when the same container appears in multiple scripts', async () => {
      const context = createContext(`
        <html><head>
          <script async src="https://www.googletagmanager.com/gtm.js?id=GTM-ABC123"></script>
          <script>dataLayer.push({'gtm.start': 1}); // GTM-ABC123</script>
        </head><body></body></html>
      `);
      const result = await duplicateGtmRule.run(context);
      expect(result.status).toBe('pass');
    });

    it('should warn when more than one distinct GTM container is embedded', async () => {
      const context = createContext(`
        <html><head>
          <script async src="https://www.googletagmanager.com/gtm.js?id=GTM-ABC123"></script>
          <script>})(window,document,'script','dataLayer','GTM-XYZ789');</script>
        </head><body></body></html>
      `);
      const result = await duplicateGtmRule.run(context);
      expect(result.status).toBe('warn');
      expect(result.score).toBe(50);
      expect(result.details?.containerIds).toEqual(['GTM-ABC123', 'GTM-XYZ789']);
    });

    it('should return notMeasured when the DOM was not collected', async () => {
      const context = createContext('', {
        $: undefined as unknown as AuditContext['$'],
      });
      const result = await duplicateGtmRule.run(context);
      expect(result.status).toBe('warn');
      expect(result.weight).toBe(0);
    });
  });

  describe('technical-duplicate-ga', () => {
    it('should pass when no GA property is present', async () => {
      const context = createContext('<html><body><p>No tracking</p></body></html>');
      const result = await duplicateGaRule.run(context);
      expect(result.status).toBe('pass');
      expect(result.details?.propertyIds).toEqual([]);
    });

    it('should pass when a single GA4 property is embedded', async () => {
      const context = createContext(`
        <html><head>
          <script async src="https://www.googletagmanager.com/gtag/js?id=G-ABC123DEF"></script>
          <script>
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-ABC123DEF');
          </script>
        </head><body></body></html>
      `);
      const result = await duplicateGaRule.run(context);
      expect(result.status).toBe('pass');
      expect(result.details?.propertyIds).toEqual(['G-ABC123DEF']);
    });

    it('should pass when a single Universal Analytics property is embedded', async () => {
      const context = createContext(`
        <html><head>
          <script>
            ga('create', 'UA-12345678-1', 'auto');
            ga('send', 'pageview');
          </script>
        </head><body></body></html>
      `);
      const result = await duplicateGaRule.run(context);
      expect(result.status).toBe('pass');
      expect(result.details?.propertyIds).toEqual(['UA-12345678-1']);
    });

    it('should warn when more than one distinct GA property is embedded', async () => {
      const context = createContext(`
        <html><head>
          <script async src="https://www.googletagmanager.com/gtag/js?id=UA-12345678-1"></script>
          <script>
            gtag('config', 'UA-12345678-1');
            gtag('config', 'UA-87654321-2');
          </script>
        </head><body></body></html>
      `);
      const result = await duplicateGaRule.run(context);
      expect(result.status).toBe('warn');
      expect(result.details?.propertyIds).toEqual(['UA-12345678-1', 'UA-87654321-2']);
    });

    it('should warn when UA and GA4 properties are mixed', async () => {
      const context = createContext(`
        <html><head>
          <script>ga('create', 'UA-12345678-1', 'auto');</script>
          <script>gtag('config', 'G-ABC123DEF');</script>
        </head><body></body></html>
      `);
      const result = await duplicateGaRule.run(context);
      expect(result.status).toBe('warn');
      expect(result.details?.propertyIds).toEqual(['G-ABC123DEF', 'UA-12345678-1']);
    });

    it('should not treat GTM container IDs as GA properties', async () => {
      const context = createContext(`
        <html><head>
          <script async src="https://www.googletagmanager.com/gtm.js?id=GTM-ABC123"></script>
        </head><body></body></html>
      `);
      const result = await duplicateGaRule.run(context);
      expect(result.status).toBe('pass');
      expect(result.details?.propertyIds).toEqual([]);
    });

    it('should return notMeasured when the DOM was not collected', async () => {
      const context = createContext('', {
        $: undefined as unknown as AuditContext['$'],
      });
      const result = await duplicateGaRule.run(context);
      expect(result.status).toBe('warn');
      expect(result.weight).toBe(0);
    });
  });
});
