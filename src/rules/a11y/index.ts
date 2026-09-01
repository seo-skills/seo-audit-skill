/**
 * Accessibility (A11y) Rules
 *
 * This module exports all accessibility audit rules and registers them.
 * Covers WCAG guidelines for users with disabilities.
 */

import { registerRule } from '../registry.js';

import { ariaLabelsRule } from './aria-labels.js';
import { colorContrastRule } from './color-contrast.js';
import { focusVisibleRule } from './focus-visible.js';
import { formLabelsRule } from './form-labels.js';
import { headingOrderRule } from './heading-order.js';
import { landmarkRegionsRule } from './landmark-regions.js';
import { linkTextRule } from './link-text.js';
import { skipLinkRule } from './skip-link.js';
import { tableHeadersRule } from './table-headers.js';
import { touchTargetsRule } from './touch-targets.js';
import { videoCaptionsRule } from './video-captions.js';
import { zoomDisabledRule } from './zoom-disabled.js';

// Lighthouse-parity accessibility checks
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

// Export all rules
export {
  ariaLabelsRule,
  colorContrastRule,
  focusVisibleRule,
  formLabelsRule,
  headingOrderRule,
  landmarkRegionsRule,
  linkTextRule,
  skipLinkRule,
  tableHeadersRule,
  touchTargetsRule,
  videoCaptionsRule,
  zoomDisabledRule,
  iframeTitleRule,
  objectAltRule,
  emptyHeadingRule,
  inputImageAltRule,
  mainLandmarkRule,
  listStructureRule,
  duplicateIdRule,
  tabindexPositiveRule,
  accesskeyUniqueRule,
  formMultipleLabelsRule,
  ariaValidRule,
  ariaHiddenFocusableRule,
  svgImgAltRule,
  presentationRoleConflictRule,
  validLangElementRule,
  redundantAltRule,
  tableCaptionRule,
  identicalLinksPurposeRule,
  labelNameMismatchRule,
};

// Register all rules
registerRule(ariaLabelsRule);
registerRule(colorContrastRule);
registerRule(focusVisibleRule);
registerRule(formLabelsRule);
registerRule(headingOrderRule);
registerRule(landmarkRegionsRule);
registerRule(linkTextRule);
registerRule(skipLinkRule);
registerRule(tableHeadersRule);
registerRule(touchTargetsRule);
registerRule(videoCaptionsRule);
registerRule(zoomDisabledRule);
registerRule(iframeTitleRule);
registerRule(objectAltRule);
registerRule(emptyHeadingRule);
registerRule(inputImageAltRule);
registerRule(mainLandmarkRule);
registerRule(listStructureRule);
registerRule(duplicateIdRule);
registerRule(tabindexPositiveRule);
registerRule(accesskeyUniqueRule);
registerRule(formMultipleLabelsRule);
registerRule(ariaValidRule);
registerRule(ariaHiddenFocusableRule);
registerRule(svgImgAltRule);
registerRule(presentationRoleConflictRule);
registerRule(validLangElementRule);
registerRule(redundantAltRule);
registerRule(tableCaptionRule);
registerRule(identicalLinksPurposeRule);
registerRule(labelNameMismatchRule);
