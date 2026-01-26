/**
 * Schema Rules (Structured Data)
 *
 * This module exports all structured data audit rules and registers them.
 * Covers JSON-LD validation, type checking, and required field verification.
 */

import { registerRule } from '../registry.js';

import { structuredDataPresentRule } from './present.js';
import { structuredDataValidRule } from './valid.js';
import { structuredDataTypeRule } from './type.js';
import { structuredDataRequiredFieldsRule } from './required-fields.js';
import { structuredDataArticleRule } from './article.js';
import { structuredDataBreadcrumbRule } from './breadcrumb.js';
import { structuredDataFaqRule } from './faq.js';
import { structuredDataLocalBusinessRule } from './local-business.js';
import { structuredDataOrganizationRule } from './organization.js';
import { structuredDataProductRule } from './product.js';
import { structuredDataReviewRule } from './review.js';
import { structuredDataVideoRule } from './video.js';
import { structuredDataWebsiteSearchRule } from './website-search.js';

// Export all rules
export {
  structuredDataPresentRule,
  structuredDataValidRule,
  structuredDataTypeRule,
  structuredDataRequiredFieldsRule,
  structuredDataArticleRule,
  structuredDataBreadcrumbRule,
  structuredDataFaqRule,
  structuredDataLocalBusinessRule,
  structuredDataOrganizationRule,
  structuredDataProductRule,
  structuredDataReviewRule,
  structuredDataVideoRule,
  structuredDataWebsiteSearchRule,
};

// Register all rules
registerRule(structuredDataPresentRule);
registerRule(structuredDataValidRule);
registerRule(structuredDataTypeRule);
registerRule(structuredDataRequiredFieldsRule);
registerRule(structuredDataArticleRule);
registerRule(structuredDataBreadcrumbRule);
registerRule(structuredDataFaqRule);
registerRule(structuredDataLocalBusinessRule);
registerRule(structuredDataOrganizationRule);
registerRule(structuredDataProductRule);
registerRule(structuredDataReviewRule);
registerRule(structuredDataVideoRule);
registerRule(structuredDataWebsiteSearchRule);
