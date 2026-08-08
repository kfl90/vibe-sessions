// Cross-file consistency checks that a compiler can't catch from Linux.
//
// The Swift, project.yml, and manifest.json all encode the same identifiers in
// different syntaxes — bundle IDs, the App Group, resource paths. A rename or a
// new target silently desynchronizes them, and the first symptom is a runtime
// failure on-device. This asserts they agree.
//
// Usage: node lint-project.mjs
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(PROJECT, p), 'utf8');
const problems = [];

const yml = read('project.yml');
// XcodeGen generates these at `xcodegen generate` time, so they're absent here.
const GENERATED = /(Info\.plist|\.entitlements)$/;

// 1. Every path project.yml points at must exist.
const explicit = [...yml.matchAll(/^\s+(?:-\s+)?path:\s*(\S+)\s*$/gm)].map((m) => m[1]);
const bare = [...yml.matchAll(/^\s+-\s+([A-Za-z][\w./-]*)\s*$/gm)]
  .map((m) => m[1])
  .filter((v) => v.includes('/') || existsSync(join(PROJECT, v)));
for (const path of [...new Set([...explicit, ...bare])]) {
  if (GENERATED.test(path)) continue;
  if (!existsSync(join(PROJECT, path))) problems.push(`project.yml references missing path: ${path}`);
}

// 2. Extension bundle IDs must be prefixed by the app's (Apple requires it).
const ids = [...yml.matchAll(/PRODUCT_BUNDLE_IDENTIFIER:\s*(\S+)/g)].map((m) => m[1]);
const appID = ids.find((id) => !/\.(extension|ads|trackers|annoyances)$/.test(id));
if (!appID) problems.push('could not identify the app bundle ID in project.yml');
for (const id of ids.filter((i) => i !== appID)) {
  if (!id.startsWith(appID + '.')) problems.push(`${id} is not prefixed by app ID ${appID}`);
}

// 3. BlockerRegistry's raw values must match the content-blocker bundle IDs
//    exactly — SFContentBlockerManager looks blockers up by this string.
const registry = read('App/Sources/Models/BlockerRegistry.swift');
for (const id of ids.filter((i) => /\.(ads|trackers|annoyances)$/.test(i))) {
  if (!registry.includes(`"${id}"`)) problems.push(`BlockerRegistry.swift is missing ${id}`);
}
const registryIDs = [...registry.matchAll(/case \w+ = "([^"]+)"/g)].map((m) => m[1]);
for (const id of registryIDs) {
  if (!ids.includes(id)) problems.push(`BlockerRegistry.swift has ${id}, absent from project.yml`);
}

// 4. Exactly one App Group, shared by project.yml and SharedStore.
const groups = new Set([...yml.matchAll(/^\s+-\s+(group\.\S+)\s*$/gm)].map((m) => m[1]));
if (groups.size !== 1) {
  problems.push(`expected exactly one App Group in project.yml, found: ${[...groups].join(', ') || 'none'}`);
} else {
  const group = [...groups][0];
  if (!read('Shared/SharedStore.swift').includes(`"${group}"`)) {
    problems.push(`SharedStore.swift does not use the App Group ${group}`);
  }
  // One entitlements block per target; each target has exactly one bundle ID.
  const entitlementBlocks = (yml.match(/com\.apple\.security\.application-groups/g) || []).length;
  if (entitlementBlocks !== ids.length) {
    problems.push(`${entitlementBlocks} App Group entitlements for ${ids.length} targets — all must have it`);
  }
}

// 5. Every file the web-extension manifest names must exist in the bundle.
const manifest = JSON.parse(read('Extension/Resources/manifest.json'));
const manifestFiles = [
  ...Object.values(manifest.icons ?? {}),
  ...(manifest.content_scripts ?? []).flatMap((cs) => [...(cs.js ?? []), ...(cs.css ?? [])])
];
for (const file of manifestFiles) {
  if (!existsSync(join(PROJECT, 'Extension/Resources', file))) {
    problems.push(`manifest.json references missing file: ${file}`);
  }
}

// 6. No leftovers from the pre-Mint naming.
const STALE = /cookieblocker|cookie blocker|safari-cookie-blocker|CookieBannerExtension|BlockerAds/i;
for (const file of [
  'project.yml',
  'README.md',
  'Shared/SharedStore.swift',
  'App/Sources/Models/BlockerRegistry.swift',
  'Extension/Resources/manifest.json'
]) {
  const match = read(file).match(STALE);
  if (match) problems.push(`${file} still contains stale name "${match[0]}"`);
}

if (problems.length) {
  console.error(`FAIL — ${problems.length} consistency problem(s):`);
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}
console.log(
  `OK — ${ids.length} targets, app ${appID}, App Group ${[...groups][0]}, ` +
    `all paths and identifiers consistent.`
);
