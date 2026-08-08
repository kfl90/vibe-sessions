// Functional tests for the cookie auto-reject extension.
//
// Loads Extension/Resources unchanged into Chromium (the MV3 folder is
// engine-portable), serves the CMP fixtures over localhost, and asserts the
// extension clicks the right button exactly once, banners disappear, and
// scroll locks are released.
import { chromium } from 'playwright';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './serve.mjs';

const PORT = 8788;
const BASE = `http://127.0.0.1:${PORT}`;
const EXT_PATH = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'Extension', 'Resources');

const TESTS = [
  {
    fixture: 'onetrust.html',
    name: 'OneTrust: direct reject-all',
    async verify(page) {
      await waitRejected(page);
      await assertClicks(page, 1);
      await assertGone(page, '#onetrust-consent-sdk');
      await assertScrollUnlocked(page);
    }
  },
  {
    fixture: 'onetrust-pc.html',
    name: 'OneTrust: preference-center fallback (no reject-all on banner)',
    async verify(page) {
      await waitRejected(page, 12000);
      await assertClicks(page, 1);
      await assertGone(page, '#onetrust-consent-sdk');
    }
  },
  {
    fixture: 'cookiebot.html',
    name: 'Cookiebot: decline',
    async verify(page) {
      await waitRejected(page);
      await assertClicks(page, 1);
      await assertGone(page, '#CybotCookiebotDialog');
      await assertGone(page, '#CybotCookiebotDialogBodyUnderlay');
    }
  },
  {
    fixture: 'quantcast.html',
    name: 'Quantcast Choice: two-step MORE OPTIONS → REJECT ALL',
    async verify(page) {
      await waitRejected(page, 12000);
      await assertClicks(page, 1);
      await assertGone(page, '#qc-cmp2-container');
    }
  },
  {
    fixture: 'didomi.html',
    name: 'Didomi: disagree',
    async verify(page) {
      await waitRejected(page);
      await assertClicks(page, 1);
      await assertGone(page, '#didomi-host');
      const hasClass = await page.evaluate(() => document.body.classList.contains('didomi-popup-open'));
      assert(!hasClass, 'didomi-popup-open class still on <body>');
    }
  },
  {
    fixture: 'sourcepoint.html',
    name: 'Sourcepoint: reject inside iframe, top-frame cleanup',
    async verify(page) {
      let frame = null;
      for (let i = 0; i < 40 && !frame; i++) {
        frame = page.frames().find((f) => f.url().includes('sourcepoint-frame'));
        if (!frame) await page.waitForTimeout(250);
      }
      assert(frame, 'sourcepoint iframe not found');
      await frame.waitForFunction(() => window.__cbTestResult === 'rejected', null, { timeout: 10000 });
      // Top-frame cleanup happens after the grace period (2.5 s) + cleanup delay.
      await page.waitForFunction(
        () => !document.querySelector('div[id^="sp_message_container_"]'),
        null,
        { timeout: 10000 }
      );
      const hasClass = await page.evaluate(() => document.documentElement.classList.contains('sp-message-open'));
      assert(!hasClass, 'sp-message-open class still on <html>');
      await assertScrollUnlocked(page);
    }
  },
  {
    fixture: 'usercentrics.html',
    name: 'Usercentrics: deny inside open shadow root',
    async verify(page) {
      await waitRejected(page);
      await assertClicks(page, 1);
      await assertGone(page, '#usercentrics-root');
    }
  },
  {
    fixture: 'trustarc.html',
    name: 'TrustArc: required only',
    async verify(page) {
      await waitRejected(page);
      await assertClicks(page, 1);
      await assertGone(page, '#truste-consent-track');
    }
  },
  {
    fixture: 'cookieyes.html',
    name: 'CookieYes: reject + leftover overlay/scroll-lock cleanup',
    async verify(page) {
      await waitRejected(page);
      await assertClicks(page, 1);
      // The fixture intentionally leaves the overlay and body overflow:hidden
      // behind — the extension's cleanup pass must fix both.
      await page.waitForFunction(() => !document.querySelector('.cky-overlay'), null, { timeout: 5000 });
      await page.waitForFunction(
        () => getComputedStyle(document.body).overflow !== 'hidden',
        null,
        { timeout: 5000 }
      );
    }
  },
  {
    fixture: 'late-injection.html',
    name: 'Late-injected banner (3 s): MutationObserver path',
    async verify(page) {
      await waitRejected(page, 15000);
      await assertClicks(page, 1);
    }
  },
  {
    fixture: 'generic-german.html',
    name: 'Unknown CMP: heuristic clicks "Alle ablehnen", not "Alle akzeptieren"',
    async verify(page) {
      await waitRejected(page, 12000);
      await assertClicks(page, 1);
      const result = await page.evaluate(() => window.__cbTestResult);
      assert(result === 'rejected', `expected rejected, got ${result}`);
    }
  },
  {
    fixture: 'negative.html',
    name: 'Negative: normal in-content Reject button must NOT be clicked',
    async verify(page) {
      // Give the engine ample time (heuristic runs ~1.5 s after DCL).
      await page.waitForTimeout(6000);
      await assertClicks(page, 0);
      const visible = await page.isVisible('#reject');
      assert(visible, 'in-content button was hidden — false positive');
    }
  }
];

// --- assertion helpers -------------------------------------------------------
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
async function waitRejected(page, timeout = 8000) {
  await page.waitForFunction(() => window.__cbTestResult === 'rejected', null, { timeout });
}
async function assertClicks(page, expected) {
  const clicks = await page.evaluate(() => window.__cbClicks);
  assert(clicks === expected, `expected ${expected} click(s), got ${clicks}`);
}
async function assertGone(page, selector) {
  const exists = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return false;
    const cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden';
  }, selector);
  assert(!exists, `${selector} still visible`);
}
async function assertScrollUnlocked(page) {
  const locked = await page.evaluate(() => {
    const b = getComputedStyle(document.body).overflow === 'hidden';
    const h = getComputedStyle(document.documentElement).overflow === 'hidden';
    return b || h;
  });
  assert(!locked, 'page scroll still locked');
}

// --- runner --------------------------------------------------------------------
async function launch(userDataDir) {
  const opts = {
    headless: true,
    args: [
      `--disable-extensions-except=${EXT_PATH}`,
      `--load-extension=${EXT_PATH}`
    ]
  };
  // Extensions need full Chromium in new-headless mode, not the headless
  // shell. Prefer a pre-installed browser (CI containers set CHROMIUM_PATH or
  // ship /opt/pw-browsers/chromium); otherwise use Playwright's own install.
  const preinstalled = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
  try {
    return await chromium.launchPersistentContext(userDataDir, {
      ...opts,
      executablePath: preinstalled
    });
  } catch {
    try {
      return await chromium.launchPersistentContext(userDataDir, { ...opts, channel: 'chromium' });
    } catch {
      return await chromium.launchPersistentContext(userDataDir, opts);
    }
  }
}

const server = await startServer(PORT);
const userDataDir = mkdtempSync(join(tmpdir(), 'cb-tests-'));
const context = await launch(userDataDir);

let failed = 0;
for (const test of TESTS) {
  // Fresh page per fixture: sessionStorage (the per-host handled flag) is
  // per-tab, so each test starts clean.
  const page = await context.newPage();
  try {
    await page.goto(`${BASE}/${test.fixture}`, { waitUntil: 'domcontentloaded' });
    await test.verify(page);
    console.log(`PASS  ${test.name}`);
  } catch (err) {
    failed += 1;
    console.error(`FAIL  ${test.name}\n      ${err.message.split('\n')[0]}`);
  } finally {
    await page.close();
  }
}

await context.close();
server.close();
rmSync(userDataDir, { recursive: true, force: true });

console.log(failed === 0 ? `\nAll ${TESTS.length} tests passed.` : `\n${failed}/${TESTS.length} tests FAILED.`);
process.exit(failed === 0 ? 0 : 1);
