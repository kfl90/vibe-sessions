// Minimal Adblock-Plus-filter → Safari-content-blocker-JSON converter.
//
// Safari content blockers cannot express a large slice of modern ABP syntax
// ($csp, $redirect, $removeparam, scriptlets, :-abp-has(...), regex filters…),
// so any converter targets a subset. This one converts the subset Safari can
// express, drops the rest, and reports exactly what was dropped and why.
//
// The `||` and `^` regex translations follow eyeo's abp2blocklist, the
// battle-tested reference for this mapping.
//
// Output ordering (required by WebKit):
//   css-display-none rules → block rules → ignore-previous-rules
//
// Exported API: convert(lines) → { rules, stats }

const RULE_LIMIT = 150000;
const SELECTOR_CHUNK = 200; // selectors per coalesced hiding rule
const SELECTOR_CHUNK_BYTES = 8000;

const RESOURCE_TYPE_MAP = new Map([
  ['script', 'script'],
  ['image', 'image'],
  ['stylesheet', 'style-sheet'],
  ['font', 'font'],
  ['media', 'media'],
  ['popup', 'popup'],
  ['xmlhttprequest', 'raw'],
  ['websocket', 'raw'],
  ['ping', 'raw'],
  ['other', 'raw'],
  ['object', 'raw'],
  ['subdocument', 'document']
]);

// Options that are pure noise for Safari and safe to ignore on a rule that is
// otherwise convertible.
const IGNORABLE_OPTIONS = new Set(['important']);

const SEPARATOR = '[^-_.%A-Za-z0-9]';

function escapeRegex(s) {
  return s.replace(/[.+?${}()|[\]\\/]/g, '\\$&');
}

// ABP pattern (no anchors handled here) → Safari url-filter regex body.
// WebKit's regex flavor has NO alternation, so the trailing '^' (separator or
// end-of-URL) uses AdGuard's optional-group idiom: ([/:&?].*)?$
function patternToRegexBody(pattern) {
  let out = '';
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === '*') out += '.*';
    else if (ch === '^') {
      out += i === pattern.length - 1 ? '([/:&?].*)?$' : SEPARATOR;
    } else out += escapeRegex(ch);
  }
  return out;
}

function convertNetworkPattern(raw) {
  let pattern = raw;
  let prefix = '';
  let suffix = '';

  if (pattern.startsWith('||')) {
    pattern = pattern.slice(2);
    // abp2blocklist's canonical hostname anchor.
    prefix = '^[^:]+://+([^:/]+\\.)?';
  } else if (pattern.startsWith('|')) {
    pattern = pattern.slice(1);
    prefix = '^';
  }
  if (pattern.endsWith('|')) {
    pattern = pattern.slice(0, -1);
    suffix = '$';
  }
  return prefix + patternToRegexBody(pattern) + suffix;
}

const VALID_DOMAIN = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/;

// ABP allows wildcard-TLD domains ("tripadvisor.*") that Safari's
// if-domain/unless-domain cannot express. Dropping one from an INCLUDE list
// only narrows the rule (safe); an unexpressible EXCLUDE would widen it
// (over-blocking), so the caller must drop the whole rule.
function parseDomainsOption(value) {
  const include = [];
  const exclude = [];
  let invalidInclude = 0;
  let invalidExclude = 0;
  for (const d of value.split('|')) {
    const dom = d.trim().toLowerCase();
    if (!dom) continue;
    if (dom.startsWith('~')) {
      if (VALID_DOMAIN.test(dom.slice(1))) exclude.push('*' + dom.slice(1));
      else invalidExclude += 1;
    } else {
      if (VALID_DOMAIN.test(dom)) include.push('*' + dom);
      else invalidInclude += 1;
    }
  }
  return { include, exclude, invalidInclude, invalidExclude };
}

function isAscii(s) {
  // eslint-disable-next-line no-control-regex
  return /^[\x00-\x7F]*$/.test(s);
}

export function convertLine(line) {
  // Returns { kind, rule?, generic?, exception?, reason? }
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('!') || trimmed.startsWith('[')) {
    return { kind: 'skip' };
  }

  // ---- element hiding -------------------------------------------------------
  const hideMatch = trimmed.match(/^(.*?)(#@#|#\?#|#\$#|#%#|##)(.+)$/);
  if (hideMatch) {
    const [, domainPart, sep, selector] = hideMatch;
    if (sep === '#?#' || sep === '#$#' || sep === '#%#') {
      return { kind: 'drop', reason: 'extended-selector-or-snippet' };
    }
    if (!isAscii(selector) || selector.length > 4000) {
      return { kind: 'drop', reason: 'selector-unsupported' };
    }
    const domains = domainPart
      .split(',')
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);
    const rawInclude = domains.filter((d) => !d.startsWith('~'));
    const rawExclude = domains.filter((d) => d.startsWith('~')).map((d) => d.slice(1));
    const include = rawInclude.filter((d) => VALID_DOMAIN.test(d)).map((d) => '*' + d);
    const exclude = rawExclude.filter((d) => VALID_DOMAIN.test(d)).map((d) => '*' + d);
    // Unexpressible excludes would widen the rule; unexpressible includes that
    // leave nothing behind make the rule pointless.
    if (exclude.length !== rawExclude.length) return { kind: 'drop', reason: 'wildcard-exclude-domain' };
    if (rawInclude.length && !include.length) return { kind: 'drop', reason: 'wildcard-domain-only' };

    if (sep === '#@#') {
      // Hiding exception. Only generic exceptions (with domains) are foldable.
      if (domains.length === 0) return { kind: 'drop', reason: 'global-hiding-exception' };
      if (exclude.length) return { kind: 'drop', reason: 'hiding-exception-negated-domain' };
      return { kind: 'hide-exception', selector, domains: include };
    }

    if (include.length && exclude.length) {
      return { kind: 'drop', reason: 'mixed-domains' };
    }
    if (include.length) {
      return {
        kind: 'hide',
        rule: {
          trigger: { 'url-filter': '.*', 'if-domain': include },
          action: { type: 'css-display-none', selector }
        }
      };
    }
    if (exclude.length) {
      return {
        kind: 'hide',
        rule: {
          trigger: { 'url-filter': '.*', 'unless-domain': exclude },
          action: { type: 'css-display-none', selector }
        }
      };
    }
    return { kind: 'hide-generic', selector };
  }

  // ---- network rules ---------------------------------------------------------
  let text = trimmed;
  const isException = text.startsWith('@@');
  if (isException) text = text.slice(2);

  // Regex-literal filters are not translatable to Safari's regex subset.
  if (text.startsWith('/') && text.lastIndexOf('/') > 0 && !text.includes('$')) {
    if (text.endsWith('/')) return { kind: 'drop', reason: 'regex-literal' };
  }

  // Split off options ($ that is part of the pattern is vanishingly rare in
  // the big lists; a trailing options section is the last unescaped '$').
  let pattern = text;
  let optionsStr = null;
  const dollarIdx = text.lastIndexOf('$');
  if (dollarIdx > 0 && dollarIdx < text.length - 1 && !text.slice(dollarIdx + 1).includes('/')) {
    pattern = text.slice(0, dollarIdx);
    optionsStr = text.slice(dollarIdx + 1);
  }

  if (!isAscii(pattern)) return { kind: 'drop', reason: 'non-ascii-pattern' };
  if (pattern.startsWith('/') && pattern.endsWith('/') && pattern.length > 2) {
    return { kind: 'drop', reason: 'regex-literal' };
  }

  const trigger = {};
  let resourceTypes = [];
  let hasDocumentishException = false;

  if (optionsStr !== null) {
    for (const optRaw of optionsStr.split(',')) {
      const opt = optRaw.trim();
      if (!opt) continue;
      const lower = opt.toLowerCase();

      if (lower === 'third-party' || lower === '3p') {
        trigger['load-type'] = ['third-party'];
      } else if (lower === '~third-party' || lower === '1p') {
        trigger['load-type'] = ['first-party'];
      } else if (lower === 'match-case') {
        trigger['url-filter-is-case-sensitive'] = true;
      } else if (lower.startsWith('domain=')) {
        const { include, exclude, invalidInclude, invalidExclude } = parseDomainsOption(
          opt.slice('domain='.length)
        );
        if (invalidExclude) return { kind: 'drop', reason: 'wildcard-exclude-domain' };
        if (invalidInclude && !include.length) return { kind: 'drop', reason: 'wildcard-domain-only' };
        if (include.length && exclude.length) return { kind: 'drop', reason: 'mixed-domains' };
        if (include.length) trigger['if-domain'] = include;
        if (exclude.length) trigger['unless-domain'] = exclude;
      } else if (RESOURCE_TYPE_MAP.has(lower)) {
        resourceTypes.push(RESOURCE_TYPE_MAP.get(lower));
      } else if (lower === 'document' || lower === 'elemhide' || lower === 'generichide') {
        if (isException) hasDocumentishException = true;
        else if (lower === 'document') resourceTypes.push('document');
        else return { kind: 'drop', reason: `unsupported-option:${lower}` };
      } else if (IGNORABLE_OPTIONS.has(lower)) {
        // ignore
      } else if (lower.startsWith('~')) {
        return { kind: 'drop', reason: 'negated-resource-type' };
      } else {
        return { kind: 'drop', reason: `unsupported-option:${lower.split('=')[0]}` };
      }
    }
  }

  // Whole-site exception (@@||host^$document / $elemhide / $generichide):
  // becomes a site-wide ignore-previous-rules keyed on the host.
  if (isException && hasDocumentishException) {
    const host = pattern.replace(/^\|\|/, '').replace(/[\^/].*$/, '').toLowerCase();
    if (!VALID_DOMAIN.test(host)) {
      return { kind: 'drop', reason: 'unparseable-document-exception' };
    }
    return {
      kind: 'exception',
      rule: {
        trigger: { 'url-filter': '.*', 'if-domain': ['*' + host] },
        action: { type: 'ignore-previous-rules' }
      }
    };
  }

  if (!pattern || pattern === '*') return { kind: 'drop', reason: 'empty-pattern' };
  // A bare separator-free short pattern would over-match wildly.
  const meat = pattern.replace(/^\|\|?/, '').replace(/\|$/, '');
  if (meat.replace(/[*^]/g, '').length < 4) {
    return { kind: 'drop', reason: 'pattern-too-short' };
  }

  trigger['url-filter'] = convertNetworkPattern(pattern.toLowerCase());
  if (resourceTypes.length) {
    trigger['resource-type'] = [...new Set(resourceTypes)];
  }

  return {
    kind: isException ? 'exception' : 'block',
    rule: { trigger, action: { type: isException ? 'ignore-previous-rules' : 'block' } }
  };
}

export function convert(lines) {
  const stats = {
    total: 0,
    converted: 0,
    skipped: 0,
    dropped: 0,
    droppedByReason: {}
  };

  const hideRules = [];
  const genericSelectors = [];
  const hideExceptions = new Map(); // selector → Set(domains)
  const blockRules = [];
  const exceptionRules = [];

  for (const line of lines) {
    stats.total += 1;
    const res = convertLine(line);
    switch (res.kind) {
      case 'skip':
        stats.skipped += 1;
        break;
      case 'drop':
        stats.dropped += 1;
        stats.droppedByReason[res.reason] = (stats.droppedByReason[res.reason] || 0) + 1;
        break;
      case 'hide':
        hideRules.push(res.rule);
        stats.converted += 1;
        break;
      case 'hide-generic':
        genericSelectors.push(res.selector);
        stats.converted += 1;
        break;
      case 'hide-exception': {
        const set = hideExceptions.get(res.selector) || new Set();
        for (const d of res.domains) set.add(d);
        hideExceptions.set(res.selector, set);
        stats.converted += 1;
        break;
      }
      case 'block':
        blockRules.push(res.rule);
        stats.converted += 1;
        break;
      case 'exception':
        exceptionRules.push(res.rule);
        stats.converted += 1;
        break;
      default:
        throw new Error(`unknown kind ${res.kind}`);
    }
  }

  // Generic selectors WITH per-domain exceptions get their own rule with
  // unless-domain (precise). The rest are coalesced into big chunks.
  const coalesced = [];
  const plainSelectors = [];
  for (const sel of genericSelectors) {
    const exc = hideExceptions.get(sel);
    if (exc && exc.size) {
      coalesced.push({
        trigger: { 'url-filter': '.*', 'unless-domain': [...exc].sort() },
        action: { type: 'css-display-none', selector: sel }
      });
    } else {
      plainSelectors.push(sel);
    }
  }
  let chunk = [];
  let chunkBytes = 0;
  const flush = () => {
    if (!chunk.length) return;
    coalesced.push({
      trigger: { 'url-filter': '.*' },
      action: { type: 'css-display-none', selector: chunk.join(', ') }
    });
    chunk = [];
    chunkBytes = 0;
  };
  for (const sel of plainSelectors) {
    if (chunk.length >= SELECTOR_CHUNK || chunkBytes + sel.length + 2 > SELECTOR_CHUNK_BYTES) flush();
    chunk.push(sel);
    chunkBytes += sel.length + 2;
  }
  flush();

  const rules = [...coalesced, ...hideRules, ...blockRules, ...exceptionRules];
  if (rules.length > RULE_LIMIT) {
    throw new Error(`rule count ${rules.length} exceeds Safari limit ${RULE_LIMIT}`);
  }
  stats.output = rules.length;
  return { rules, stats };
}

export { RULE_LIMIT };
