// Mobile layer for the GAP page. Loaded AFTER gap-ui.js and touches none
// of its logic: it only reads gap-ui.js's top-level `session` (classic
// scripts share one global lexical scope) and adds
//   - visual-viewport tracking, so the terminal ends above the soft keyboard
//   - a key bar for keys phone keyboards lack (Tab, arrows, brackets, :=)
//   - the Files/Examples bottom sheet
//   - tap-to-focus and keyboard-friendly attributes on xterm's input
"use strict";

(() => {
  const root = document.documentElement;
  const vv = window.visualViewport;
  const sheet = document.getElementById("side-panel");
  const backdrop = document.getElementById("backdrop");
  const menuBtn = document.getElementById("menu");
  const keybar = document.getElementById("keybar");
  const wrap = document.getElementById("terminal-wrap");
  const isDesktop = () => window.matchMedia("(min-width: 821px)").matches;

  // ---- viewport + refit -------------------------------------------------
  let fitQueued = false;
  function refit() {
    if (fitQueued) return;
    fitQueued = true;
    requestAnimationFrame(() => {
      fitQueued = false;
      try { session && session.fitAddon.fit(); } catch (e) {}
    });
  }
  function syncViewport() {
    if (!isDesktop()) {
      const h = vv ? vv.height : window.innerHeight;
      root.style.setProperty("--app-h", h + "px");
      // iOS scrolls the layout viewport to reveal the focused input;
      // follow it instead of letting the page jump.
      root.style.setProperty("--app-top", (vv ? vv.offsetTop : 0) + "px");
    } else {
      root.style.removeProperty("--app-h");
      root.style.removeProperty("--app-top");
    }
    refit();
  }
  if (vv) {
    vv.addEventListener("resize", syncViewport);
    vv.addEventListener("scroll", syncViewport);
  }
  window.addEventListener("resize", syncViewport);
  window.addEventListener("orientationchange", syncViewport);
  new ResizeObserver(refit).observe(wrap);
  syncViewport();

  // ---- key bar ----------------------------------------------------------
  // [label, bytes sent to the terminal, optional extra CSS class].
  // "\x1b[D" after a bracket pair puts the cursor between the brackets.
  const LEFT = "\x1b[D";
  const KEYS = [
    ["Tab", "\t", "wide"], ["↑", "\x1b[A"], ["↓", "\x1b[B"],
    ["←", LEFT], ["→", "\x1b[C"],
    [";", ";"], [":=", ":="], ["()", "()" + LEFT], ["[]", "[]" + LEFT],
    ["{}", "{}" + LEFT], ['""', '""' + LEFT], [",", ","], [".", "."],
    ["^", "^"], ["\\", "\\"], ["Enter", "\r", "wide"],
  ];

  function sendKey(data) {
    if (typeof session === "undefined" || session === null) return;
    const x = session.xterm;
    // input() feeds the terminal as if typed, which is what the pty
    // line discipline expects; paste() is the fallback for old xterm.
    if (typeof x.input === "function") x.input(data, true);
    else x.paste(data);
  }

  for (const [label, data, cls] of KEYS) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    if (cls) b.className = cls;
    b.setAttribute("aria-label", label);
    // pointerdown + preventDefault: act immediately and, crucially, keep
    // focus in the terminal so the soft keyboard stays open.
    b.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      sendKey(data);
    });
    keybar.append(b);
  }

  // ---- bottom sheet -----------------------------------------------------
  function setSheet(open) {
    sheet.classList.toggle("open", open);
    backdrop.classList.toggle("open", open);
    menuBtn.setAttribute("aria-expanded", String(open));
    if (!open && typeof session !== "undefined" && session) session.xterm.focus();
  }
  menuBtn.addEventListener("click", () => setSheet(!sheet.classList.contains("open")));
  document.getElementById("sheet-close").addEventListener("click", () => setSheet(false));
  backdrop.addEventListener("click", () => setSheet(false));
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") setSheet(false);
  });
  // Inserting an example or a Read(...) command is the end of the
  // errand: close the sheet and return to the terminal. (gap-ui.js's own
  // click handler runs first and pastes the text.)
  sheet.addEventListener("click", (ev) => {
    if (isDesktop()) return;
    const t = ev.target.closest("button");
    if (t && (t.classList.contains("example-button") || t.textContent === "↳"))
      setSheet(false);
  });

  // ---- terminal input behaviour ------------------------------------------
  wrap.addEventListener("click", () => {
    if (typeof session !== "undefined" && session) session.xterm.focus();
  });
  // Stop phone keyboards from capitalising, autocorrecting or curling quotes
  // in GAP code. Re-applied whenever a new xterm (restart) mounts.
  new MutationObserver(() => {
    const ta = document.querySelector("#terminal .xterm-helper-textarea");
    if (!ta || ta.dataset.gapMobile) return;
    ta.dataset.gapMobile = "1";
    ta.setAttribute("autocapitalize", "off");
    ta.setAttribute("autocorrect", "off");
    ta.setAttribute("autocomplete", "off");
    ta.setAttribute("spellcheck", "false");
    ta.setAttribute("enterkeyhint", "enter");
  }).observe(document.getElementById("terminal"), { childList: true, subtree: true });
})();