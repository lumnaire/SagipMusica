/**
 * First-visit intro sequence. Markup and styles live inline in index.html.
 *
 * Why this is a separate file rather than an inline <script>: the production
 * CSP (vercel.json) is `script-src 'self'`, which blocks inline script
 * outright. It is loaded render-blocking from <head> so the decision below is
 * made -- and the panel painted -- before the browser paints anything else.
 * The landing page must never flash behind it.
 *
 * Fail-safe by construction. The panel is `display: none` until THIS file sets
 * data-sm-intro on <html>. If it is blocked, 404s, or throws before that line,
 * the site simply loads with no intro. There is no path where the page is left
 * covered by a panel nothing can remove -- and a 12s watchdog covers the rest.
 *
 * To replay it while working on it, load the site with ?intro=1.
 */
(function () {
  "use strict";

  var STORAGE_KEY = "sm.intro.seen.v1";

  /* Timings, in ms. The CSS owns the entrance choreography; these only decide
     when the sequence may start and when it is allowed to leave. */
  var ASSET_CAP = 1400; /* longest wait for fonts + logo before starting anyway */
  var MIN_HOLD = 2950; /* entrance runs ~2.4s; the rest is the beat after it */
  var APP_CAP = 2200; /* longest extra wait for the landing page to mount */
  var EXIT = 1250; /* panel slide, incl. its 140ms delay -- keep >= the CSS */
  var REDUCED_HOLD = 1100;
  var REDUCED_EXIT = 560;
  var WATCHDOG = 12000;

  var doc = document;
  var root = doc.documentElement;

  /* ---- 1. Should it run at all? ------------------------------------------ */

  var forced = /(^|[?&])intro=1(&|$)/.test(location.search);

  if (!forced) {
    /* The marketing entry point only. A first-time visitor arriving on a deep
       link (/download, /login) gets the page they asked for; the intro waits
       until they actually land on the front door. */
    if (location.pathname !== "/") return;
    try {
      if (window.localStorage.getItem(STORAGE_KEY)) return;
    } catch {
      /* Storage walled off (private mode, blocked cookies). Showing the intro
         is the friendlier failure than silently never showing it. */
    }
  }

  /* Painted from the first frame: this attribute is what un-hides the panel,
     and it is set while <head> is still parsing. */
  root.setAttribute("data-sm-intro", "run");

  /* Recorded now rather than at the end, so a refresh part-way through does
     not start the whole thing over. */
  try {
    window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {}

  var reduced = false;
  try {
    reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {}

  var panel = null;
  var exiting = false;
  var finished = false;
  var watchdog = setTimeout(watch, WATCHDOG);

  /* ---- 2. Teardown ------------------------------------------------------- */

  function watch() {
    /* A backgrounded tab throttles timers and pauses animations, so a hidden
       page has not stalled -- it is just waiting its turn. Check again later
       rather than tearing down an intro the visitor has not seen yet. */
    if (doc.hidden) {
      watchdog = setTimeout(watch, 4000);
      return;
    }
    cleanup();
  }

  function cleanup() {
    if (finished) return;
    finished = true;
    clearTimeout(watchdog);
    doc.removeEventListener("keydown", onKey, true);
    root.removeAttribute("data-sm-intro");
    if (panel && panel.parentNode) panel.parentNode.removeChild(panel);
    setInert(false);
  }

  function setInert(on) {
    var app = doc.getElementById("root");
    if (!app) return;
    /* Keeps Tab from reaching the landing page underneath while it is covered.
       Unsupported in older browsers, where the 4s exposure is harmless. */
    try {
      app.inert = on;
    } catch {}
  }

  function exit() {
    if (exiting || finished) return;
    exiting = true;
    if (!panel) {
      cleanup();
      return;
    }
    /* Release the scroll lock as the slide begins. The panel still covers the
       whole viewport for this frame, so the reflow from the scrollbar coming
       back happens behind it rather than in the middle of the reveal. */
    root.setAttribute("data-sm-intro", "out");
    panel.classList.add("is-out");
    setTimeout(cleanup, (reduced ? REDUCED_EXIT : EXIT) + 120);
  }

  function onKey(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "Escape" || e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      exit();
    }
  }

  /* ---- 3. Gates ---------------------------------------------------------- */

  /** Runs cb once every waiter has settled, or once the cap expires. */
  function whenAssetsReady(cb) {
    var pending = 1;
    var fired = false;
    var cap = setTimeout(go, ASSET_CAP);

    function go() {
      if (fired) return;
      fired = true;
      clearTimeout(cap);
      cb();
    }
    function settle() {
      if (--pending <= 0) go();
    }
    function wait(promise) {
      pending++;
      try {
        promise.then(settle, settle);
      } catch {
        settle();
      }
    }

    /* Fonts first: the wordmark rises letter by letter, and a Fraunces swap
       landing mid-animation reads as a glitch. */
    if (doc.fonts && doc.fonts.load) {
      wait(doc.fonts.load('500 4rem "Fraunces"'));
      wait(doc.fonts.load('400 1rem "Inter"'));
    }

    var mark = panel.querySelector(".sm-intro__mark");
    if (mark && !mark.complete) {
      pending++;
      mark.addEventListener("load", settle);
      mark.addEventListener("error", settle);
    }

    settle();
  }

  /** Runs cb once the landing page has actually mounted, or the cap expires. */
  function whenAppReady(cb) {
    var app = doc.getElementById("root");
    var obs = null;
    var fired = false;
    var cap;

    function ready() {
      return !!doc.querySelector("#root [data-landing-ready]");
    }
    function go() {
      if (fired) return;
      fired = true;
      clearTimeout(cap);
      if (obs) obs.disconnect();
      cb();
    }

    /* Without this the curtain can lift on the auth spinner, or on a blank
       root while the bundle is still parsing. The cap is there because a
       signed-in visitor is redirected away and no landing page ever mounts. */
    if (ready()) return go();
    cap = setTimeout(go, APP_CAP);
    if (app && window.MutationObserver) {
      obs = new MutationObserver(function () {
        if (ready()) go();
      });
      obs.observe(app, { childList: true, subtree: true });
    }
  }

  function whenVisible(cb) {
    if (!doc.hidden) return cb();
    /* Opened in a background tab: hold the sequence rather than play it to an
       empty room. */
    var on = function () {
      if (doc.hidden) return;
      doc.removeEventListener("visibilitychange", on);
      cb();
    };
    doc.addEventListener("visibilitychange", on);
  }

  function onReady(cb) {
    if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", cb);
    else cb();
  }

  /* ---- 4. Wordmark ------------------------------------------------------- */

  /**
   * Wraps each letter in its own overflow mask so it can rise out of nothing.
   * Done here rather than in the markup to keep index.html readable -- nothing
   * is visible before the timeline starts, so there is no flash to cause.
   */
  function splitChars(node) {
    if (!node) return;
    var text = (node.textContent || "").trim();
    node.textContent = "";
    node.setAttribute("aria-label", text);
    for (var i = 0; i < text.length; i++) {
      var mask = doc.createElement("span");
      mask.className = "sm-ch";
      mask.setAttribute("aria-hidden", "true");
      mask.style.setProperty("--i", String(i));
      var glyph = doc.createElement("i");
      glyph.textContent = text.charAt(i);
      mask.appendChild(glyph);
      node.appendChild(mask);
    }
  }

  /* ---- 5. Run ------------------------------------------------------------ */

  onReady(function () {
    panel = doc.getElementById("sm-intro");
    if (!panel) {
      cleanup();
      return;
    }

    if (reduced) panel.classList.add("is-reduced");
    splitChars(panel.querySelector("[data-sm-split]"));
    setInert(true);

    panel.addEventListener("click", exit);
    doc.addEventListener("keydown", onKey, true);

    whenVisible(function () {
      whenAssetsReady(function () {
        panel.classList.add("is-in");
        setTimeout(function () {
          whenAppReady(exit);
        }, reduced ? REDUCED_HOLD : MIN_HOLD);
      });
    });
  });
})();
