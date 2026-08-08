// Simulates BlockerListBuilder.swift's byte-surgery merge against the REAL
// compiled lists, proving the format invariant the Swift code depends on:
//   - each blockerList.json ends with ']' and no trailing whitespace
//   - drop ']' + append ',<allow-rule>]' yields valid JSON
//   - the merged list still passes the validator (ordering incl. the
//     appended ignore-previous-rules)
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from './validate-blocklist.mjs';
import { decide } from './spot-check.mjs';

const PROJECT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILES = ['Ads', 'Trackers', 'Annoyances'].map((c) =>
  join(PROJECT, 'Blockers', c, 'Resources', 'blockerList.json')
);

const ALLOW_RULE = JSON.stringify({
  trigger: { 'url-filter': '.*', 'if-domain': ['*nytimes.com', '*example.org'] },
  action: { type: 'ignore-previous-rules' }
});

let failures = 0;
function check(cond, label) {
  if (cond) console.log(`PASS ${label}`);
  else {
    failures += 1;
    console.error(`FAIL ${label}`);
  }
}

for (const file of FILES) {
  const name = file.split('/').slice(-3)[0];
  const raw = readFileSync(file, 'utf8');

  check(raw.endsWith(']'), `${name}: file ends with ']' (no trailing whitespace)`);

  // The exact surgery Swift performs.
  const merged = raw.slice(0, -1) + ',' + ALLOW_RULE + ']';
  let rules;
  try {
    rules = JSON.parse(merged);
    check(true, `${name}: merged output is valid JSON`);
  } catch (e) {
    check(false, `${name}: merged output is valid JSON (${e.message})`);
    continue;
  }

  const errors = validate(rules, name);
  check(errors.length === 0, `${name}: merged output passes validator${errors.length ? ` (${errors[0]})` : ''}`);
  check(
    rules[rules.length - 1].action.type === 'ignore-previous-rules',
    `${name}: allow rule is the final rule`
  );
}

// Functional: allowlisted domain unblocks a known-blocked URL.
const ads = JSON.parse(readFileSync(FILES[0], 'utf8'));
const mergedAds = [...ads, JSON.parse(ALLOW_RULE)];
const ctx = { url: 'https://securepubads.g.doubleclick.net/tag/js/gpt.js', docHost: 'www.nytimes.com' };
check(decide(ads, ctx) === true, 'ads: doubleclick blocked before merge');
check(decide(mergedAds, ctx) === false, 'ads: doubleclick unblocked on allowlisted domain after merge');

console.log(failures === 0 ? '\nAll merge-invariant tests passed.' : `\n${failures} merge test(s) FAILED.`);
process.exit(failures ? 1 : 0);
