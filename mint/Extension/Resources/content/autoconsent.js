/*
 * Cookie-banner auto-reject engine.
 *
 * Runs in every frame at document_start. Detects known consent platforms
 * (rules in rules.js), clicks their "reject all" flow, then cleans up
 * scroll locks and leftover overlays. Unknown banners get one shot of a
 * conservative text-matching heuristic. hide.css keeps everything
 * invisible from first paint regardless of how long the click takes.
 */
(function () {
  'use strict';

  if (window.__cbEngineLoaded) return;
  window.__cbEngineLoaded = true;

  var R = window.__cbRules;
  if (!R) return;

  var IS_TOP = window === window.top;
  var OBSERVE_CAP_MS = 20000; // stop watching for banners after this (battery)
  var MAX_ATTEMPTS = 30;
  var DEBOUNCE_MS = 200;
  var CLEANUP_DELAY_MS = 600;
  var DEEP_SCAN_ELEMENT_CAP = 4000;
  var DEEP_SCAN_DEPTH_CAP = 5;

  var rejectRe = new RegExp(R.REJECT_TEXT, 'i');
  var acceptRe = new RegExp(R.ACCEPT_BLACKLIST, 'i');
  var containerHintRe = new RegExp(R.CONTAINER_HINT, 'i');

  var state = {
    done: false, // this frame finished (success or gave up)
    clickedSomething: false, // at most one consent interaction per page load
    heuristicRan: false,
    attempts: 0,
    engagedRule: null
  };

  // --- session guard -------------------------------------------------------
  // Suppresses re-clicking across soft navigations on the same host.
  function hostFlagKey() {
    return '__cb_handled_' + location.host;
  }
  function alreadyHandled() {
    try {
      return sessionStorage.getItem(hostFlagKey()) === '1';
    } catch (e) {
      return false; // sandboxed frames throw
    }
  }
  function markHandled() {
    try {
      sessionStorage.setItem(hostFlagKey(), '1');
    } catch (e) {
      /* ignore */
    }
  }

  // --- shadow-DOM-piercing query ------------------------------------------
  function $deep(selector, root) {
    root = root || document;
    var fast = root.querySelector(selector);
    if (fast) return fast;
    // Slow path: walk open shadow roots (rarely needed — Usercentrics etc.)
    var visited = 0;
    var queue = [{ node: root, depth: 0 }];
    while (queue.length) {
      var entry = queue.shift();
      var host = entry.node;
      var els = host.querySelectorAll('*');
      for (var i = 0; i < els.length; i++) {
        if (++visited > DEEP_SCAN_ELEMENT_CAP) return null;
        var el = els[i];
        if (el.shadowRoot && entry.depth < DEEP_SCAN_DEPTH_CAP) {
          var hit = el.shadowRoot.querySelector(selector);
          if (hit) return hit;
          queue.push({ node: el.shadowRoot, depth: entry.depth + 1 });
        }
      }
    }
    return null;
  }

  function $deepAll(selector, root) {
    root = root || document;
    var out = [];
    var seen = new Set();
    var light = root.querySelectorAll(selector);
    for (var i = 0; i < light.length; i++) {
      if (!seen.has(light[i])) {
        seen.add(light[i]);
        out.push(light[i]);
      }
    }
    var visited = 0;
    var queue = [{ node: root, depth: 0 }];
    while (queue.length) {
      var entry = queue.shift();
      var els = entry.node.querySelectorAll('*');
      for (var j = 0; j < els.length; j++) {
        if (++visited > DEEP_SCAN_ELEMENT_CAP) return out;
        var el = els[j];
        if (el.shadowRoot && entry.depth < DEEP_SCAN_DEPTH_CAP) {
          var hits = el.shadowRoot.querySelectorAll(selector);
          for (var k = 0; k < hits.length; k++) {
            if (!seen.has(hits[k])) {
              seen.add(hits[k]);
              out.push(hits[k]);
            }
          }
          queue.push({ node: el.shadowRoot, depth: entry.depth + 1 });
        }
      }
    }
    return out;
  }

  // --- helpers --------------------------------------------------------------
  function normText(el) {
    return (el.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function isVisible(el) {
    var rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    var cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden';
  }

  function safeClick(el) {
    try {
      el.click();
      return true;
    } catch (e) {
      return false;
    }
  }

  function findByText(regex, withinSelector) {
    var scopes = withinSelector ? $deepAll(withinSelector) : [document];
    for (var s = 0; s < scopes.length; s++) {
      var candidates = scopes[s].querySelectorAll
        ? scopes[s].querySelectorAll('button, a, [role="button"]')
        : [];
      for (var i = 0; i < candidates.length; i++) {
        var el = candidates[i];
        var text = normText(el);
        if (!text || text.length > 80) continue;
        if (regex.test(text) && !acceptRe.test(text)) return el;
      }
    }
    return null;
  }

  // Wait until fn() returns truthy, driven by DOM mutations plus a coarse
  // safety interval; resolves null on timeout.
  function waitFor(fn, timeoutMs) {
    return new Promise(function (resolve) {
      var result = fn();
      if (result) return resolve(result);
      var finished = false;
      var obs = null;
      var interval = null;
      var timer = null;
      function finish(value) {
        if (finished) return;
        finished = true;
        if (obs) obs.disconnect();
        if (interval) clearInterval(interval);
        if (timer) clearTimeout(timer);
        resolve(value);
      }
      function check() {
        var r = fn();
        if (r) finish(r);
      }
      if (document.documentElement) {
        obs = new MutationObserver(check);
        obs.observe(document.documentElement, { childList: true, subtree: true });
      }
      interval = setInterval(check, 250);
      timer = setTimeout(function () {
        finish(null);
      }, timeoutMs);
    });
  }

  // --- rule execution --------------------------------------------------------
  function runSteps(rule) {
    var clickedInRule = false;
    var chain = Promise.resolve();
    rule.steps.forEach(function (step) {
      chain = chain.then(function () {
        if (step.skipIfDone && clickedInRule) return;
        var timeout = step.timeout || 2000;
        var locate;
        if (step.click) {
          locate = function () {
            return $deep(step.click);
          };
        } else if (step.clickText) {
          var re = new RegExp(step.clickText, 'i');
          locate = function () {
            return findByText(re, step.within);
          };
        } else if (step.waitFor) {
          locate = function () {
            return $deep(step.waitFor);
          };
        } else {
          return;
        }
        return waitFor(locate, timeout).then(function (el) {
          if (!el) {
            if (step.optional) return;
            throw new Error('step failed: ' + rule.name);
          }
          if (step.click || step.clickText) {
            // nav steps (e.g. "MORE OPTIONS") open the next screen; only a
            // final reject click counts as rule success.
            if (safeClick(el) && !step.nav) clickedInRule = true;
          }
        });
      });
    });
    return chain.then(function () {
      return clickedInRule;
    });
  }

  function unlockScroll(extraClasses) {
    var classes = R.COMMON_UNLOCK_CLASSES.concat(extraClasses || []);
    classes.forEach(function (cls) {
      document.documentElement.classList.remove(cls);
      if (document.body) document.body.classList.remove(cls);
    });
    [document.documentElement, document.body].forEach(function (el) {
      if (!el) return;
      var cs = getComputedStyle(el);
      if (cs.overflow === 'hidden' || cs.overflowY === 'hidden') {
        el.style.setProperty('overflow', 'visible', 'important');
      }
      if (cs.position === 'fixed' && el === document.body) {
        el.style.setProperty('position', 'static', 'important');
      }
    });
  }

  function removeNodes(selectors) {
    (selectors || []).forEach(function (sel) {
      var nodes = document.querySelectorAll(sel);
      for (var i = 0; i < nodes.length; i++) nodes[i].remove();
    });
  }

  function cleanupAfter(rule) {
    setTimeout(function () {
      try {
        unlockScroll(rule ? rule.unlockClasses : []);
        removeNodes(rule ? rule.removeNodes : []);
      } catch (e) {
        /* never break the page */
      }
    }, CLEANUP_DELAY_MS);
  }

  function succeed(rule, viaClick) {
    state.done = true;
    if (viaClick) {
      state.clickedSomething = true;
      markHandled();
    }
    stopObserving();
    cleanupAfter(rule);
  }

  function engageRule(rule) {
    if (state.engagedRule) return;
    state.engagedRule = rule;
    if (rule.cleanupOnly) {
      // Click happens in a child frame; we just tidy the top frame after a grace period.
      setTimeout(function () {
        succeed(rule, false);
      }, rule.graceMs || 2000);
      return;
    }
    runSteps(rule)
      .then(function (clicked) {
        if (clicked) {
          succeed(rule, true);
        } else {
          // Rule detected but nothing clickable — hide.css covers it; let the
          // observer keep watching in case the banner mounts late.
          state.engagedRule = null;
        }
      })
      .catch(function () {
        state.engagedRule = null;
      });
  }

  function frameMatches(rule) {
    var where = rule.frame || 'any';
    if (where === 'top' && !IS_TOP) return false;
    if (where === 'child' && IS_TOP) return false;
    return true;
  }

  function detectRule() {
    for (var i = 0; i < R.RULES.length; i++) {
      var rule = R.RULES[i];
      if (!frameMatches(rule)) continue;
      if (rule.detectFrame) {
        try {
          if (new RegExp(rule.detectFrame, 'i').test(location.href)) {
            if (!rule.detect || document.querySelector(rule.detect) || document.readyState !== 'loading') {
              return rule;
            }
          }
        } catch (e) {
          /* bad regex — skip */
        }
      }
      if (rule.detect && document.querySelector(rule.detect)) return rule;
    }
    return null;
  }

  // --- generic heuristic ------------------------------------------------------
  function runHeuristic() {
    if (!IS_TOP || state.heuristicRan || state.done || state.clickedSomething) return;
    state.heuristicRan = true;

    var all = document.querySelectorAll('body *');
    var candidates = [];
    var scanned = 0;
    for (var i = 0; i < all.length; i++) {
      if (++scanned > 6000) break;
      var el = all[i];
      var idClass = (el.id || '') + ' ' + (typeof el.className === 'string' ? el.className : '');
      if (!containerHintRe.test(idClass)) continue;
      var cs = getComputedStyle(el);
      if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
      if ((parseInt(cs.zIndex, 10) || 0) < 100) continue;
      if (!isVisible(el)) continue;
      candidates.push(el);
      if (candidates.length >= 5) break;
    }

    for (var c = 0; c < candidates.length; c++) {
      var container = candidates[c];
      var buttons = container.querySelectorAll('button, a, [role="button"]');
      for (var b = 0; b < buttons.length; b++) {
        var btn = buttons[b];
        var text = normText(btn);
        if (!text || text.length > 60) continue;
        if (rejectRe.test(text) && !acceptRe.test(text) && isVisible(btn)) {
          if (safeClick(btn)) {
            state.clickedSomething = true;
            markHandled();
            state.done = true;
            stopObserving();
            cleanupAfter(null);
            setTimeout(function (node) {
              return function () {
                if (node.isConnected && isVisible(node)) node.style.setProperty('display', 'none', 'important');
              };
            }(container), CLEANUP_DELAY_MS);
            return;
          }
        }
      }
      // Strong container match but no reject button → last resort: hide it.
      var hint = (container.id || '') + ' ' + (typeof container.className === 'string' ? container.className : '');
      if (/cookie|consent/i.test(hint)) {
        var rect = container.getBoundingClientRect();
        var vh = window.innerHeight || 1;
        var coversPartial = rect.height / vh < 0.9;
        var coversAll = rect.height / vh >= 0.98 && rect.width / (window.innerWidth || 1) >= 0.98;
        if (coversPartial || coversAll) {
          container.style.setProperty('display', 'none', 'important');
          state.done = true;
          stopObserving();
          cleanupAfter(null);
          return;
        }
      }
    }
  }

  // --- main observation loop ---------------------------------------------------
  var observer = null;
  var debounceTimer = null;
  var capTimer = null;

  function stopObserving() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (debounceTimer) clearTimeout(debounceTimer);
    if (capTimer) clearTimeout(capTimer);
  }

  function attempt() {
    if (state.done || state.engagedRule) return;
    if (++state.attempts > MAX_ATTEMPTS) {
      stopObserving();
      runHeuristic();
      return;
    }
    var rule = detectRule();
    if (rule) engageRule(rule);
  }

  function onMutations() {
    if (debounceTimer) return;
    debounceTimer = setTimeout(function () {
      debounceTimer = null;
      attempt();
    }, DEBOUNCE_MS);
  }

  function start() {
    if (alreadyHandled()) {
      // Consent already stored this session — nothing to click. hide.css still
      // suppresses any flash if the site re-renders a banner briefly.
      return;
    }
    attempt();
    if (state.done) return;

    if (document.documentElement) {
      observer = new MutationObserver(onMutations);
      observer.observe(document.documentElement, { childList: true, subtree: true });
    }

    capTimer = setTimeout(function () {
      stopObserving();
      runHeuristic();
    }, OBSERVE_CAP_MS);

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        attempt();
        // Give known-CMP detection a head start before trying the heuristic.
        setTimeout(function () {
          if (!state.done && !state.engagedRule) runHeuristic();
        }, 1500);
      });
    } else {
      setTimeout(function () {
        if (!state.done && !state.engagedRule) runHeuristic();
      }, 1500);
    }
  }

  start();
})();
