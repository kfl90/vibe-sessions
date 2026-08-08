/*
 * CMP rule table — pure data, consumed by autoconsent.js.
 *
 * Rule shape:
 *   name          identifier for logging
 *   detect        CSS selector whose presence means "this CMP is on the page"
 *                 (checked with the shadow-DOM-piercing query in the engine)
 *   detectFrame   optional regex (string) matched against location.href to
 *                 detect CMPs that render inside dedicated iframes
 *   frame         'top' | 'child' | 'any' — where this rule may fire (default 'any')
 *   steps         executed in order. Each step:
 *                   { click: 'selector' }            click first match (pierces shadow DOM)
 *                   { clickText: 'regex-source', within: 'selector' }
 *                                                    click button/a whose trimmed text
 *                                                    matches the regex, scoped to `within`
 *                   { waitFor: 'selector' }          wait for selector to appear
 *                   optional: true                   skip silently if not found
 *                   timeout: ms                      per-step wait budget (default 2000)
 *   unlockClasses classes this CMP puts on <html>/<body> to lock scrolling
 *   removeNodes   leftover overlay/underlay selectors to remove after success
 */
(function () {
  'use strict';

  var RULES = [
    {
      name: 'onetrust',
      detect: '#onetrust-banner-sdk, .optanon-alert-box-wrapper',
      frame: 'any',
      steps: [
        { click: '#onetrust-reject-all-handler', optional: true },
        // Sites without a configured reject-all: open preference center, refuse all.
        {
          click: '#onetrust-pc-btn-handler, .optanon-toggle-display',
          optional: true,
          nav: true,
          skipIfDone: true
        },
        { click: '.ot-pc-refuse-all-handler, .save-preference-btn-handler', optional: true, timeout: 3000, skipIfDone: true }
      ],
      unlockClasses: ['ot-overflow-hidden'],
      removeNodes: ['.onetrust-pc-dark-filter']
    },
    {
      name: 'cookiebot',
      detect: '#CybotCookiebotDialog',
      frame: 'any',
      steps: [
        {
          click:
            '#CybotCookiebotDialogBodyButtonDecline, #CybotCookiebotDialogBodyLevelButtonLevelOptinDeclineAll'
        }
      ],
      unlockClasses: [],
      removeNodes: ['#CybotCookiebotDialogBodyUnderlay']
    },
    {
      name: 'quantcast',
      detect: '#qc-cmp2-container, .qc-cmp2-container',
      frame: 'any',
      steps: [
        // Direct reject if the summary screen offers it…
        {
          clickText: '^(reject( all)?|disagree|do not (agree|consent))$',
          within: '.qc-cmp2-summary-buttons',
          optional: true
        },
        // …otherwise the two-step flow: MORE OPTIONS → footer REJECT ALL.
        {
          clickText: '^(more options|options|manage|purposes)$',
          within: '.qc-cmp2-summary-buttons',
          optional: true,
          nav: true,
          skipIfDone: true
        },
        { waitFor: '.qc-cmp2-footer', optional: true, timeout: 3000, skipIfDone: true },
        {
          clickText: '^(reject all|save & exit|disagree( to all)?)$',
          within: '.qc-cmp2-footer',
          optional: true,
          timeout: 3000,
          skipIfDone: true
        }
      ],
      unlockClasses: ['qc-cmp-ui-showing'],
      removeNodes: ['#qc-cmp2-container', '.qc-cmp2-container']
    },
    {
      name: 'didomi',
      detect: '#didomi-host, #didomi-notice',
      frame: 'any',
      steps: [
        {
          click:
            '#didomi-notice-disagree-button, button.didomi-components-button--decline, .didomi-continue-without-agreeing'
        }
      ],
      unlockClasses: ['didomi-popup-open'],
      removeNodes: []
    },
    {
      name: 'sourcepoint-frame',
      detectFrame: 'privacy-mgmt\\.com|sp-prod\\.net|sourcepoint|/index\\.html\\?message_id=',
      detect: '.message-container, .sp_choice_type_13, .sp_choice_type_11',
      frame: 'child',
      steps: [
        { click: 'button.sp_choice_type_13', optional: true },
        { clickText: '^(reject( all)?|refuse( all)?)$', within: 'body', optional: true, skipIfDone: true }
      ],
      unlockClasses: [],
      removeNodes: []
    },
    {
      name: 'sourcepoint-top',
      detect: 'div[id^="sp_message_container_"]',
      frame: 'top',
      // The click happens inside the iframe (rule above). Top frame only cleans up
      // once the iframe signals success or after a grace period; handled by the
      // engine's cleanupOnly flag.
      cleanupOnly: true,
      graceMs: 2500,
      steps: [],
      unlockClasses: ['sp-message-open'],
      removeNodes: ['div[id^="sp_message_container_"]']
    },
    {
      name: 'trustarc',
      detect: '#truste-consent-track',
      frame: 'any',
      steps: [
        // "Required only" = functional reject. The multi-page consent-pref iframe
        // wizard is deliberately not automated in v1; hide.css covers it.
        { click: '#truste-consent-required' }
      ],
      unlockClasses: [],
      removeNodes: ['.truste_overlay', '.truste_box_overlay']
    },
    {
      name: 'usercentrics',
      detect: '#usercentrics-root',
      frame: 'any',
      steps: [
        // Rendered inside an open shadow root — engine's $deep pierces it.
        { click: 'button[data-testid="uc-deny-all-button"]' }
      ],
      unlockClasses: [],
      removeNodes: []
    },
    {
      name: 'klaro',
      detect: '.klaro .cookie-notice, .klaro .cookie-modal',
      frame: 'any',
      steps: [{ click: '.klaro .cm-btn-decline, .klaro .cn-decline' }],
      unlockClasses: [],
      removeNodes: []
    },
    {
      name: 'osano',
      detect: '.osano-cm-window',
      frame: 'any',
      steps: [{ click: '.osano-cm-denyAll, .osano-cm-button--type_denyAll' }],
      unlockClasses: ['osano-cm-disabled'],
      removeNodes: []
    },
    {
      name: 'cookieyes',
      detect: '.cky-consent-container',
      frame: 'any',
      steps: [{ click: '.cky-btn-reject, [data-cky-tag="reject-button"]' }],
      unlockClasses: [],
      removeNodes: ['.cky-overlay']
    },
    {
      name: 'complianz',
      detect: '#cmplz-cookiebanner-container',
      frame: 'any',
      steps: [{ click: '.cmplz-deny' }],
      unlockClasses: [],
      removeNodes: []
    },
    {
      name: 'borlabs',
      detect: '#BorlabsCookieBox',
      frame: 'any',
      steps: [
        { click: 'a[data-cookie-refuse], ._brlbs-refuse-btn a, ._brlbs-btn-refuse' }
      ],
      unlockClasses: [],
      removeNodes: []
    },
    {
      name: 'tarteaucitron',
      detect: '#tarteaucitronRoot',
      frame: 'any',
      steps: [{ click: '#tarteaucitronAllDenied2, .tarteaucitronDeny' }],
      unlockClasses: [],
      removeNodes: ['#tarteaucitronAlertBig']
    },
    {
      name: 'funding-choices',
      detect: '.fc-consent-root',
      frame: 'any',
      steps: [{ click: 'button.fc-cta-do-not-consent' }],
      unlockClasses: [],
      removeNodes: ['.fc-dialog-overlay']
    },
    {
      name: 'google-consent',
      detectFrame: '^https?://consent\\.(google|youtube)\\.[a-z.]+/',
      detect: 'form[action*="consent.google"], form[action*="consent.youtube"]',
      frame: 'any',
      steps: [
        { click: 'button[aria-label*="Reject all" i]', optional: true },
        {
          clickText: '^(reject all|alle ablehnen|tout refuser|rifiuta tutto|rechazar todo)$',
          within: 'body',
          optional: true,
          skipIfDone: true
        }
      ],
      unlockClasses: [],
      removeNodes: []
    }
  ];

  // Multilingual "reject" texts for the generic heuristic (exact trimmed match).
  var REJECT_TEXT =
    '^(reject all|decline all|refuse all|deny all|reject|decline|deny|refuse' +
    '|only (necessary|essential|required)( cookies)?' +
    '|(use )?necessary( cookies)? only|essential (cookies )?only' +
    '|continue without (accepting|agreeing)' +
    '|alle ablehnen|ablehnen|nur (notwendige|erforderliche)( cookies)?( akzeptieren)?' +
    '|tout refuser|refuser( tout)?|continuer sans accepter' +
    '|rifiuta( tutto|re)?|rechazar( todo| todas)?|recusar( tudo)?' +
    '|alles afwijzen|weigeren|avvisa alla|afvis alle' +
    '|odrzuć( wszystkie)?|отклонить( все)?)$';

  // Anything matching this must never be clicked by the heuristic,
  // even if it also matches REJECT_TEXT (accept-trap protection).
  var ACCEPT_BLACKLIST =
    '(accept|agree|allow|zustimm|akzeptier|einverstanden|alles akzeptieren' +
    '|j’accepte|jaccepte|accepter(?! sans)|accetta|aceptar|aceitar|toestaan)';

  // Container id/class hints for the generic heuristic.
  var CONTAINER_HINT = '(cookie|consent|gdpr|privacy|cmp|banner)';

  // Scroll-lock classes commonly left on <html>/<body> by CMPs.
  var COMMON_UNLOCK_CLASSES = [
    'ot-overflow-hidden',
    'sp-message-open',
    'didomi-popup-open',
    'cmplz-blocked-content',
    'qc-cmp-ui-showing'
  ];

  window.__cbRules = {
    RULES: RULES,
    REJECT_TEXT: REJECT_TEXT,
    ACCEPT_BLACKLIST: ACCEPT_BLACKLIST,
    CONTAINER_HINT: CONTAINER_HINT,
    COMMON_UNLOCK_CLASSES: COMMON_UNLOCK_CLASSES
  };
})();
