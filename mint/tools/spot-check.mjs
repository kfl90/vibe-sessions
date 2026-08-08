// Approximate rule-matching smoke test for the compiled lists.
//
// Reimplements Safari's trigger matching loosely (regex + if/unless-domain +
// load-type + resource-type, rules evaluated in order, ignore-previous-rules
// resets earlier decisions). This checks CONVERTER SEMANTICS on sample URLs —
// it is not a Safari-fidelity test; real verification is on-device.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT = join(dirname(fileURLToPath(import.meta.url)), '..');

function domainMatches(list, host) {
  return list.some((d) => {
    const bare = d.startsWith('*') ? d.slice(1) : d;
    return d.startsWith('*') ? host === bare || host.endsWith('.' + bare) : host === bare;
  });
}

export function decide(rules, { url, docHost, resourceType = 'script', thirdParty = true }) {
  let blocked = false;
  for (const { trigger, action } of rules) {
    if (action.type === 'css-display-none') continue;
    if (trigger['if-domain'] && !domainMatches(trigger['if-domain'], docHost)) continue;
    if (trigger['unless-domain'] && domainMatches(trigger['unless-domain'], docHost)) continue;
    if (trigger['load-type']) {
      const need = trigger['load-type'];
      if (need.includes('third-party') && !thirdParty) continue;
      if (need.includes('first-party') && thirdParty) continue;
    }
    if (trigger['resource-type'] && !trigger['resource-type'].includes(resourceType)) continue;
    const flags = trigger['url-filter-is-case-sensitive'] ? '' : 'i';
    let re;
    try {
      re = new RegExp(trigger['url-filter'], flags);
    } catch {
      continue;
    }
    if (!re.test(url)) continue;
    if (action.type === 'block') blocked = true;
    else if (action.type === 'ignore-previous-rules') blocked = false;
  }
  return blocked;
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const ads = JSON.parse(readFileSync(join(PROJECT, 'Blockers', 'Ads', 'Resources', 'blockerList.json'), 'utf8'));
  const trackers = JSON.parse(
    readFileSync(join(PROJECT, 'Blockers', 'Trackers', 'Resources', 'blockerList.json'), 'utf8')
  );

  const CASES = [
    {
      name: 'doubleclick tag script (third-party) blocked by Ads',
      rules: ads,
      ctx: { url: 'https://securepubads.g.doubleclick.net/tag/js/gpt.js', docHost: 'www.nytimes.com' },
      expect: true
    },
    {
      name: 'plain first-party image NOT blocked by Ads',
      rules: ads,
      ctx: {
        url: 'https://example.com/images/logo.png',
        docHost: 'example.com',
        resourceType: 'image',
        thirdParty: false
      },
      expect: false
    },
    {
      name: 'google-analytics.com blocked by Trackers',
      rules: trackers,
      ctx: { url: 'https://www.google-analytics.com/analytics.js', docHost: 'example.com' },
      expect: true
    },
    {
      name: 'scorecardresearch beacon blocked by Trackers',
      rules: trackers,
      ctx: { url: 'https://sb.scorecardresearch.com/beacon.js', docHost: 'news.example.org' },
      expect: true
    },
    {
      name: 'ordinary CDN stylesheet NOT blocked by Trackers',
      rules: trackers,
      ctx: {
        url: 'https://cdn.jsdelivr.net/npm/bootstrap/dist/css/bootstrap.min.css',
        docHost: 'example.com',
        resourceType: 'style-sheet'
      },
      expect: false
    },
    {
      name: 'allowlist append simulation: appended ignore-previous-rules unblocks',
      rules: [
        ...ads,
        { trigger: { 'url-filter': '.*', 'if-domain': ['*nytimes.com'] }, action: { type: 'ignore-previous-rules' } }
      ],
      ctx: { url: 'https://securepubads.g.doubleclick.net/tag/js/gpt.js', docHost: 'www.nytimes.com' },
      expect: false
    }
  ];

  let failed = 0;
  for (const c of CASES) {
    const got = decide(c.rules, c.ctx);
    if (got === c.expect) console.log(`PASS ${c.name}`);
    else {
      failed += 1;
      console.error(`FAIL ${c.name} (expected ${c.expect}, got ${got})`);
    }
  }
  console.log(failed === 0 ? '\nAll spot checks passed.' : `\n${failed} spot check(s) FAILED.`);
  process.exit(failed ? 1 : 0);
}
