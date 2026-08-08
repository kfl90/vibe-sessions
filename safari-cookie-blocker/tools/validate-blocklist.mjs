// Validates a compiled Safari content-blocker JSON file:
//   - structure and allowed action types
//   - url-filter conforms to Safari's restricted regex flavor
//   - if-domain / unless-domain never coexist, entries lowercase ASCII
//   - ordering: css-display-none → block/block-cookies/make-https → ignore-previous-rules
//   - rule count ≤ 150,000
//
// Usage: node validate-blocklist.mjs <file.json> [...]
// Also exported as validate(rules) for in-process use.
import { readFileSync } from 'node:fs';
import { RULE_LIMIT } from './abp2safari.mjs';

const ACTIONS = new Set(['block', 'block-cookies', 'css-display-none', 'ignore-previous-rules', 'make-https']);
const RESOURCE_TYPES = new Set([
  'document', 'image', 'style-sheet', 'script', 'font', 'raw', 'svg-document', 'media', 'popup'
]);
const LOAD_TYPES = new Set(['first-party', 'third-party']);

// Safari's regex subset: literals, escapes, '.', '*', '+', '?', character
// classes, anchors, plain groups. NO alternation, backreferences, lookaround,
// bounded quantifiers, or shorthand classes. This checker is deliberately
// STRICTER than WebKit — anything it passes, WebKit compiles.
export function checkRegexSubset(src) {
  let i = 0;
  const n = src.length;
  let groupDepth = 0;
  while (i < n) {
    const ch = src[i];
    if (ch === '\\') {
      const next = src[i + 1];
      if (next === undefined) return `dangling backslash`;
      if (/[0-9]/.test(next)) return `backreference \\${next}`;
      if (/[dwsDWSbB]/.test(next)) return `shorthand class \\${next}`;
      i += 2;
      continue;
    }
    if (ch === '|') return 'alternation';
    if (ch === '{') return 'bounded quantifier';
    if (ch === '(') {
      if (src[i + 1] === '?') return 'lookaround/non-capturing group';
      groupDepth += 1;
      i += 1;
      continue;
    }
    if (ch === ')') {
      groupDepth -= 1;
      if (groupDepth < 0) return 'unbalanced )';
      i += 1;
      continue;
    }
    if (ch === '[') {
      const close = src.indexOf(']', i + 2);
      if (close === -1) return 'unterminated character class';
      i = close + 1;
      continue;
    }
    // literals and . * + ? ^ $
    i += 1;
  }
  if (groupDepth !== 0) return 'unbalanced (';
  return null;
}

const ORDER = { 'css-display-none': 0, block: 1, 'block-cookies': 1, 'make-https': 1, 'ignore-previous-rules': 2 };

export function validate(rules, name = 'list') {
  const errors = [];
  const err = (i, msg) => errors.push(`${name}[${i}]: ${msg}`);

  if (!Array.isArray(rules) || rules.length === 0) {
    return [`${name}: not a non-empty array`];
  }
  if (rules.length > RULE_LIMIT) {
    errors.push(`${name}: ${rules.length} rules exceeds limit ${RULE_LIMIT}`);
  }

  let maxStage = 0;
  rules.forEach((rule, i) => {
    if (typeof rule !== 'object' || !rule.trigger || !rule.action) {
      return err(i, 'missing trigger/action');
    }
    const { trigger, action } = rule;
    if (!ACTIONS.has(action.type)) return err(i, `bad action ${action.type}`);
    if (action.type === 'css-display-none' && !action.selector) return err(i, 'css rule without selector');
    if (action.type !== 'css-display-none' && action.selector) return err(i, 'selector on non-css rule');

    if (typeof trigger['url-filter'] !== 'string' || !trigger['url-filter']) {
      return err(i, 'missing url-filter');
    }
    const regexProblem = checkRegexSubset(trigger['url-filter']);
    if (regexProblem) return err(i, `url-filter: ${regexProblem} in ${trigger['url-filter']}`);
    try {
      new RegExp(trigger['url-filter']);
    } catch {
      return err(i, `url-filter not a valid regex: ${trigger['url-filter']}`);
    }

    if (trigger['if-domain'] && trigger['unless-domain']) return err(i, 'if-domain and unless-domain coexist');
    for (const key of ['if-domain', 'unless-domain']) {
      const domains = trigger[key];
      if (domains === undefined) continue;
      if (!Array.isArray(domains) || domains.length === 0) return err(i, `${key} not a non-empty array`);
      for (const d of domains) {
        if (!/^\*?[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/.test(d)) return err(i, `${key} entry invalid: ${d}`);
      }
    }
    if (trigger['resource-type']) {
      for (const t of trigger['resource-type']) {
        if (!RESOURCE_TYPES.has(t)) return err(i, `bad resource-type ${t}`);
      }
    }
    if (trigger['load-type']) {
      for (const t of trigger['load-type']) {
        if (!LOAD_TYPES.has(t)) return err(i, `bad load-type ${t}`);
      }
    }

    const stage = ORDER[action.type];
    if (stage < maxStage) err(i, `ordering violation: ${action.type} after later-stage rules`);
    if (stage > maxStage) maxStage = stage;
  });

  return errors;
}

// --- CLI -----------------------------------------------------------------------
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  let failed = false;
  for (const file of process.argv.slice(2)) {
    const rules = JSON.parse(readFileSync(file, 'utf8'));
    const errors = validate(rules, file);
    if (errors.length) {
      failed = true;
      console.error(`INVALID ${file} (${errors.length} problems):`);
      for (const e of errors.slice(0, 20)) console.error('  ' + e);
      if (errors.length > 20) console.error(`  …and ${errors.length - 20} more`);
    } else {
      console.log(`OK ${file} (${rules.length} rules)`);
    }
  }
  process.exit(failed ? 1 : 0);
}
