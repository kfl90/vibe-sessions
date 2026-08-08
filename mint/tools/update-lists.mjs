// Fetches the upstream filter lists, converts them to Safari content-blocker
// JSON, validates, and writes them into the blocker targets + lists.lock.json.
//
// Usage:
//   node update-lists.mjs                 # fetch + convert everything
//   node update-lists.mjs --offline ads=path.txt trackers=path.txt …
//
// Networking note: plain fetch() is tried first; if it fails and HTTPS_PROXY
// is set (e.g. sandboxed CI), curl is used as a fallback since it honors
// proxy env vars and the system CA bundle.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { convert } from './abp2safari.mjs';
import { validate } from './validate-blocklist.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT = join(HERE, '..');

// `mirror` is the raw view of easylist/easylist@gh-pages — the exact branch
// that serves easylist.to — used when the primary host is unreachable.
const LISTS = [
  {
    key: 'ads',
    name: 'EasyList',
    url: 'https://easylist.to/easylist/easylist.txt',
    mirror: 'https://raw.githubusercontent.com/easylist/easylist/gh-pages/easylist.txt',
    out: join(PROJECT, 'Blockers', 'Ads', 'Resources', 'blockerList.json')
  },
  {
    key: 'trackers',
    name: 'EasyPrivacy',
    url: 'https://easylist.to/easylist/easyprivacy.txt',
    mirror: 'https://raw.githubusercontent.com/easylist/easylist/gh-pages/easyprivacy.txt',
    out: join(PROJECT, 'Blockers', 'Trackers', 'Resources', 'blockerList.json')
  },
  {
    key: 'annoyances',
    name: "Fanboy's Annoyance List (includes EasyList Cookie)",
    url: 'https://secure.fanboy.co.nz/fanboy-annoyance.txt',
    mirror: 'https://raw.githubusercontent.com/easylist/easylist/gh-pages/fanboy-annoyance.txt',
    out: join(PROJECT, 'Blockers', 'Annoyances', 'Resources', 'blockerList.json')
  }
];

async function fetchOne(url) {
  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch (err) {
    if (process.env.HTTPS_PROXY || process.env.https_proxy) {
      return execFileSync('curl', ['-sSL', '--max-time', '120', url], {
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024
      });
    }
    throw err;
  }
}

async function fetchText(list) {
  try {
    return { text: await fetchOne(list.url), source: list.url };
  } catch (err) {
    if (!list.mirror) throw err;
    console.warn(`${list.key}: primary fetch failed (${err.message.split('\n')[0]}), using mirror`);
    return { text: await fetchOne(list.mirror), source: list.mirror };
  }
}

// One rule per line → reviewable git diffs. The file MUST end with ']' and no
// trailing whitespace: BlockerListBuilder.swift appends allowlist rules by
// byte surgery on that invariant.
function serialize(rules) {
  return '[\n' + rules.map((r) => JSON.stringify(r)).join(',\n') + '\n]';
}

const offline = new Map();
{
  const args = process.argv.slice(2);
  const idx = args.indexOf('--offline');
  if (idx !== -1) {
    for (const pair of args.slice(idx + 1)) {
      const [key, path] = pair.split('=');
      if (key && path) offline.set(key, path);
    }
  }
}

const lock = { updated: null, sources: {} };
const summary = [];

for (const list of LISTS) {
  let raw;
  let source = list.url;
  if (offline.has(list.key)) {
    raw = readFileSync(offline.get(list.key), 'utf8');
    source = offline.get(list.key);
  } else {
    ({ text: raw, source } = await fetchText(list));
  }

  const lines = raw.split(/\r?\n/);
  const { rules, stats } = convert(lines);
  const errors = validate(rules, list.key);
  if (errors.length) {
    console.error(`ABORT: ${list.key} failed validation:`);
    for (const e of errors.slice(0, 10)) console.error('  ' + e);
    process.exit(1);
  }

  const json = serialize(rules);
  mkdirSync(dirname(list.out), { recursive: true });
  writeFileSync(list.out, json);

  lock.sources[list.key] = {
    name: list.name,
    url: list.url,
    fetchedFrom: source,
    fetchedAt: new Date().toISOString(),
    sha256: createHash('sha256').update(raw).digest('hex'),
    inputLines: stats.total,
    outputRules: stats.output,
    outputBytes: json.length
  };
  summary.push({ list: list.key, ...stats, bytes: json.length });

  const topDrops = Object.entries(stats.droppedByReason)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([r, n]) => `${r}:${n}`)
    .join('  ');
  console.log(
    `${list.key.padEnd(11)} in:${String(stats.total).padStart(7)}  converted:${String(stats.converted).padStart(7)}  ` +
      `dropped:${String(stats.dropped).padStart(6)}  rules-out:${String(stats.output).padStart(7)}  ` +
      `${(json.length / 1024 / 1024).toFixed(1)}MB`
  );
  if (topDrops) console.log(`            top drops → ${topDrops}`);
}

lock.updated = new Date().toISOString();
writeFileSync(join(HERE, 'lists.lock.json'), JSON.stringify(lock, null, 2) + '\n');
console.log('\nlists.lock.json updated.');
