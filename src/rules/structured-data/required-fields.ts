import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';

/**
 * Required and recommended fields for common schema.org types
 * Based on Google's structured data guidelines
 */
const TYPE_REQUIRED_FIELDS: Record<
  string,
  { required: string[]; recommended: string[] }
> = {
  Article: {
    required: ['headline', 'author', 'datePublished'],
    recommended: ['image', 'publisher', 'dateModified', 'description'],
  },
  NewsArticle: {
    required: ['headline', 'author', 'datePublished'],
    recommended: ['image', 'publisher', 'dateModified', 'description'],
  },
  BlogPosting: {
    required: ['headline', 'author', 'datePublished'],
    recommended: ['image', 'publisher', 'dateModified', 'description'],
  },
  Product: {
    required: ['name'],
    recommended: ['image', 'description', 'offers', 'aggregateRating', 'brand'],
  },
  Organization: {
    required: ['name'],
    recommended: ['url', 'logo', 'contactPoint', 'sameAs', 'address'],
  },
  LocalBusiness: {
    required: ['name', 'address'],
    recommended: ['telephone', 'openingHours', 'priceRange', 'image', 'geo'],
  },
  Person: {
    required: ['name'],
    recommended: ['image', 'jobTitle', 'sameAs', 'url'],
  },
  WebSite: {
    required: ['name', 'url'],
    recommended: ['potentialAction', 'publisher'],
  },
  WebPage: {
    required: ['name'],
    recommended: ['description', 'breadcrumb', 'mainEntity'],
  },
  BreadcrumbList: {
    required: ['itemListElement'],
    recommended: [],
  },
  FAQPage: {
    required: ['mainEntity'],
    recommended: [],
  },
  HowTo: {
    required: ['name', 'step'],
    recommended: ['image', 'totalTime', 'estimatedCost', 'supply', 'tool'],
  },
  Recipe: {
    required: ['name', 'recipeIngredient', 'recipeInstructions'],
    recommended: ['image', 'author', 'prepTime', 'cookTime', 'nutrition'],
  },
  Event: {
    required: ['name', 'startDate', 'location'],
    recommended: ['endDate', 'image', 'description', 'offers', 'performer'],
  },
  Review: {
    required: ['itemReviewed', 'reviewRating', 'author'],
    recommended: ['reviewBody', 'datePublished'],
  },
  VideoObject: {
    required: ['name', 'thumbnailUrl', 'uploadDate'],
    recommended: ['description', 'contentUrl', 'duration', 'embedUrl'],
  },
  Course: {
    required: ['name', 'provider'],
    recommended: ['description', 'offers'],
  },
  JobPosting: {
    required: ['title', 'description', 'datePosted', 'hiringOrganization'],
    recommended: ['validThrough', 'employmentType', 'jobLocation', 'baseSalary'],
  },
  SoftwareApplication: {
    required: ['name'],
    recommended: ['offers', 'aggregateRating', 'operatingSystem', 'applicationCategory'],
  },
};

/**
 * Interface for tracking field validation results
 */
interface FieldValidation {
  type: string;
  missingRequired: string[];
  missingRecommended: string[];
  presentFields: string[];
}

/**
 * Extracts all items with @type from JSON-LD (handles @graph)
 */
function extractTypedItems(data: unknown): Array<{ type: string; fields: string[] }> {
  const items: Array<{ type: string; fields: string[] }> = [];

  if (!data || typeof data !== 'object') {
    return items;
  }

  const obj = data as Record<string, unknown>;

  // Check direct @type
  if (obj['@type']) {
    const types = Array.isArray(obj['@type'])
      ? (obj['@type'] as string[])
      : [obj['@type'] as string];

    const fields = Object.keys(obj).filter((k) => !k.startsWith('@'));

    for (const type of types) {
      items.push({ type, fields });
    }
  }

  // Check @graph array
  if (Array.isArray(obj['@graph'])) {
    for (const item of obj['@graph']) {
      items.push(...extractTypedItems(item));
    }
  }

  return items;
}

/**
 * Rule: Check common required fields based on type
 */
export const structuredDataRequiredFieldsRule = defineRule({
  id: 'structured-data-required-fields',
  name: 'Structured Data Required Fields',
  description:
    'Checks that JSON-LD structured data includes required fields based on @type',
  category: 'structured-data',
  weight: 25,
  run: async (context: AuditContext) => {
    const { $ } = context;

    const jsonLdScripts = $('script[type="application/ld+json"]');

    if (jsonLdScripts.length === 0) {
      return warn(
        'structured-data-required-fields',
        'No JSON-LD scripts found to check for required fields',
        { found: false }
      );
    }

    const validations: FieldValidation[] = [];
    let totalMissingRequired = 0;
    let totalMissingRecommended = 0;
    let typesChecked = 0;
    let unknownTypes = 0;

    jsonLdScripts.each((index, element) => {
      const rawContent = $(element).html() || '';
      const trimmedContent = rawContent.trim();

      if (!trimmedContent) {
        return;
      }

      try {
        const parsed = JSON.parse(trimmedContent);
        const typedItems = extractTypedItems(parsed);

        for (const item of typedItems) {
          const typeSpec = TYPE_REQUIRED_FIELDS[item.type];

          if (!typeSpec) {
            unknownTypes++;
            continue;
          }

          typesChecked++;

          const missingRequired = typeSpec.required.filter(
            (field) => !item.fields.includes(field)
          );
          const missingRecommended = typeSpec.recommended.filter(
            (field) => !item.fields.includes(field)
          );

          totalMissingRequired += missingRequired.length;
          totalMissingRecommended += missingRecommended.length;

          validations.push({
            type: item.type,
            missingRequired,
            missingRecommended,
            presentFields: item.fields,
          });
        }
      } catch {
        // Skip parse errors - handled by valid.ts rule
      }
    });

    if (typesChecked === 0) {
      if (unknownTypes > 0) {
        return warn(
          'structured-data-required-fields',
          `Found ${unknownTypes} schema type(s) that are not in the validation list`,
          {
            typesChecked: 0,
            unknownTypes,
          }
        );
      }
      return warn(
        'structured-data-required-fields',
        'No recognized schema.org types found to validate',
        { typesChecked: 0 }
      );
    }

    const typesWithMissingRequired = validations.filter(
      (v) => v.missingRequired.length > 0
    );

    if (typesWithMissingRequired.length > 0) {
      const issues = typesWithMissingRequired.map(
        (v) => `${v.type}: missing ${v.missingRequired.join(', ')}`
      );

      return fail(
        'structured-data-required-fields',
        `${typesWithMissingRequired.length} type(s) missing required fields: ${issues.join('; ')}`,
        {
          typesChecked,
          totalMissingRequired,
          totalMissingRecommended,
          validations: validations.map((v) => ({
            type: v.type,
            missingRequired: v.missingRequired,
            missingRecommended: v.missingRecommended,
          })),
        }
      );
    }

    if (totalMissingRecommended > 0) {
      const recommendations = validations
        .filter((v) => v.missingRecommended.length > 0)
        .map((v) => `${v.type}: consider adding ${v.missingRecommended.join(', ')}`);

      return warn(
        'structured-data-required-fields',
        `All required fields present, but ${totalMissingRecommended} recommended field(s) missing`,
        {
          typesChecked,
          totalMissingRequired: 0,
          totalMissingRecommended,
          recommendations,
          validations: validations.map((v) => ({
            type: v.type,
            missingRequired: v.missingRequired,
            missingRecommended: v.missingRecommended,
          })),
        }
      );
    }

    return pass(
      'structured-data-required-fields',
      `All ${typesChecked} schema type(s) have required fields`,
      {
        typesChecked,
        totalMissingRequired: 0,
        totalMissingRecommended: 0,
        validations: validations.map((v) => ({
          type: v.type,
          presentFields: v.presentFields,
        })),
      }
    );
  },
});
