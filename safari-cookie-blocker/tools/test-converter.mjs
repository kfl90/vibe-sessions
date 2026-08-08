// Unit tests for abp2safari.mjs — run with: node test-converter.mjs
import { convertLine, convert } from './abp2safari.mjs';
import { validate, checkRegexSubset } from './validate-blocklist.mjs';

let failures = 0;
function eq(actual, expected, label) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) {
    failures += 1;
    console.error(`FAIL ${label}\n  expected ${b}\n  actual   ${a}`);
  } else {
    console.log(`PASS ${label}`);
  }
}

// --- network rules ---------------------------------------------------------
eq(
  convertLine('||doubleclick.net^$third-party').rule,
  {
    trigger: {
      'load-type': ['third-party'],
      'url-filter': '^[^:]+://+([^:/]+\\.)?doubleclick\\.net([/:&?].*)?$'
    },
    action: { type: 'block' }
  },
  '|| + ^ + third-party'
);

eq(
  convertLine('||ads.example.com/banner/*$image').rule,
  {
    trigger: {
      'url-filter': '^[^:]+://+([^:/]+\\.)?ads\\.example\\.com\\/banner\\/.*',
      'resource-type': ['image']
    },
    action: { type: 'block' }
  },
  '|| with path, wildcard, $image'
);

eq(
  convertLine('|https://tracker.example.org/pixel.gif|').rule,
  {
    trigger: { 'url-filter': '^https:\\/\\/tracker\\.example\\.org\\/pixel\\.gif$' },
    action: { type: 'block' }
  },
  'start and end anchors'
);

eq(
  convertLine('/analytics/track.js$script,domain=foo.com|bar.com').rule,
  {
    trigger: {
      'if-domain': ['*foo.com', '*bar.com'],
      'url-filter': '\\/analytics\\/track\\.js',
      'resource-type': ['script']
    },
    action: { type: 'block' }
  },
  'plain pattern + $script + domain='
);

eq(convertLine('||example.com^$domain=a.com|~b.com').kind, 'drop', 'mixed domains dropped');
eq(convertLine('||example.com^$csp=script-src none').kind, 'drop', '$csp dropped');
eq(convertLine('||example.com^$removeparam=utm_source').kind, 'drop', '$removeparam dropped');
eq(convertLine('/^https?:\\/\\/regex/').kind, 'drop', 'regex literal dropped');
eq(convertLine('||ad^').kind, 'drop', 'too-short pattern dropped');
eq(convertLine('||xn--exmple-cua.com^').kind, 'block', 'punycode ok');
eq(convertLine('||пример.рф^').kind, 'drop', 'non-ascii dropped');

// --- exceptions ---------------------------------------------------------------
eq(
  convertLine('@@||nytimes.com^$document').rule,
  {
    trigger: { 'url-filter': '.*', 'if-domain': ['*nytimes.com'] },
    action: { type: 'ignore-previous-rules' }
  },
  '@@ $document → site-wide ignore-previous-rules'
);
eq(
  convertLine('@@||cdn.example.com/lib.js$script').rule.action.type,
  'ignore-previous-rules',
  '@@ narrow exception'
);

// --- element hiding -------------------------------------------------------------
eq(
  convertLine('example.com,foo.com###cookie-banner').rule,
  {
    trigger: { 'url-filter': '.*', 'if-domain': ['*example.com', '*foo.com'] },
    action: { type: 'css-display-none', selector: '#cookie-banner' }
  },
  'domain-scoped hiding'
);
eq(
  convertLine('~example.com##.ad-slot').rule,
  {
    trigger: { 'url-filter': '.*', 'unless-domain': ['*example.com'] },
    action: { type: 'css-display-none', selector: '.ad-slot' }
  },
  'negated-domain hiding'
);
eq(convertLine('##.ad-banner').kind, 'hide-generic', 'generic hiding pooled');
eq(convertLine('example.com#@#.ad-banner').kind, 'hide-exception', 'hiding exception captured');
eq(convertLine('example.com#?#div:-abp-has(.sponsor)').kind, 'drop', 'extended selector dropped');

// --- full-pipeline: ordering, coalescing, exceptions folding ---------------------
const sample = [
  '! comment',
  '[Adblock Plus 2.0]',
  '##.generic-a',
  '##.generic-b',
  'site.com#@#.generic-b', // exception → .generic-b gets its own unless-domain rule
  'onlyhere.com##.scoped',
  '||ads.example.com^',
  '@@||good.example.com^$document'
];
const { rules, stats } = convert(sample);
const kinds = rules.map((r) => r.action.type);
eq(
  kinds,
  ['css-display-none', 'css-display-none', 'css-display-none', 'block', 'ignore-previous-rules'],
  'output ordering'
);
const excepted = rules.find((r) => r.action.selector === '.generic-b');
eq(excepted.trigger['unless-domain'], ['*site.com'], 'hiding exception folded to unless-domain');
const coalescedRule = rules.find((r) => r.action.selector === '.generic-a');
eq(Boolean(coalescedRule), true, 'exception-free generic selector coalesced');
eq(stats.output, 5, 'stats.output');

const validationErrors = validate(rules, 'sample');
eq(validationErrors, [], 'sample passes validator');

// --- validator self-checks --------------------------------------------------------
eq(checkRegexSubset('^[^:]+://+([^:/]+\\.)?x\\.com'), null, 'regex subset: converter output ok');
eq(checkRegexSubset('a|b') !== null, true, 'regex subset: alternation rejected');
eq(checkRegexSubset('(?=x)') !== null, true, 'regex subset: lookahead rejected');
eq(checkRegexSubset('\\d+') !== null, true, 'regex subset: shorthand class rejected');
eq(checkRegexSubset('a{1,3}') !== null, true, 'regex subset: bounded quantifier rejected');

// coalescing caps
const manySelectors = Array.from({ length: 450 }, (_, i) => `##.gen-${i}`);
const big = convert(manySelectors);
const chunks = big.rules.filter((r) => r.action.type === 'css-display-none');
eq(chunks.length, 3, '450 generic selectors → 3 chunks of ≤200');

console.log(failures === 0 ? '\nAll converter tests passed.' : `\n${failures} converter test(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
