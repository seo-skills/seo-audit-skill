/**
 * Core Web Vitals Rules
 *
 * This module exports all Core Web Vitals related audit rules and registers them.
 * Core Web Vitals are a set of metrics that measure real-world user experience
 * for loading performance, interactivity, and visual stability.
 */

import { registerRule } from '../registry.js';

import { lcpRule } from './lcp.js';
import { clsRule } from './cls.js';
import { inpRule } from './inp.js';
import { ttfbRule } from './ttfb.js';
import { fcpRule } from './fcp.js';

// Export all rules
export { lcpRule, clsRule, inpRule, ttfbRule, fcpRule };

// Register all rules
registerRule(lcpRule);
registerRule(clsRule);
registerRule(inpRule);
registerRule(ttfbRule);
registerRule(fcpRule);
