const ITEM_CLASS = "infiniteLoadingItem";
const STYLE_ID = "vc-expand-style";
const INIT_DELAY_MS = 1200;
const OBS_DEBOUNCE_MS = 200;
const PERIODIC_EXPAND_MS = 2000;
const EXPANDED_ATTR = "data-vc-expanded";
const ELLIPSIS_CLASS = "vc-ellipsis";
const MENTION_SUFFIX = "であなたにメンションしました";
const REACTION_SUFFIX = "であなたにリアクションしました";
const DEDUPE_LINES = 5; // limit to avoid expensive full-body comparisons
const MIN_BODY_CHARS = 20; // skip dedupe until body is reasonably populated
const DUPLICATE_ATTR = "data-vc-duplicate";
const EXPAND_DELAY_MS = 500;
const DEDUPE_DELAY_MS = 1000;

let currentObserver = null;
let finderObserver = null;
let periodicTimer = null;
let lastUrl = location.href;
let expandEnabledAt = Date.now() + EXPAND_DELAY_MS;
let dedupeEnabledAt = Date.now() + EXPAND_DELAY_MS + DEDUPE_DELAY_MS;

function nowMs() {
  return Date.now();
}

function setTiming(expandDelayMs = EXPAND_DELAY_MS, dedupeDelayMs = DEDUPE_DELAY_MS) {
  const start = nowMs();
  expandEnabledAt = start + expandDelayMs;
  dedupeEnabledAt = start + expandDelayMs + dedupeDelayMs;
}

function normalizeText(text) {
  return (text || "").replace(/\s+/g, "").trim();
}

function getItems(root = document) {
  if (root.classList && root.classList.contains(ITEM_CLASS)) return [root];
  return Array.from(root.querySelectorAll(`.${ITEM_CLASS}`));
}

function getTitleText(item) {
  const title = item.querySelector("p.line-clamp-2");
  if (!title) return "";
  return normalizeText(title.textContent);
}

function getBodyKey(editor) {
  const text = (editor.innerText || editor.textContent || "").trim();
  if (!text) return "";
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, DEDUPE_LINES);
  return lines.length > 0 ? lines.join("\n") : "";
}

function shouldExpand(item) {
  const titleText = getTitleText(item);
  return titleText.includes(MENTION_SUFFIX);
}

function shouldDedupe(item) {
  const titleText = getTitleText(item);
  return titleText.includes(MENTION_SUFFIX) || titleText.includes(REACTION_SUFFIX);
}

function markDuplicate(item) {
  const isSpacer = (el) => {
    if (!el || !el.classList) return false;
    if (el.classList.contains("items-start") && el.classList.contains("w-full")) return true;
    if (el.classList.contains("relative") && el.classList.contains("mr-3")) return true;
    return false;
  };

  let prev = item.previousElementSibling;
  while (prev && isSpacer(prev)) {
    const toRemove = prev;
    prev = prev.previousElementSibling;
    toRemove.remove();
  }

  item.style.display = "block";
  item.style.height = "0px";
  item.style.minHeight = "0px";
  item.style.margin = "0px";
  item.style.padding = "0px";
  item.style.overflow = "hidden";
  item.style.border = "0";
  item.style.boxShadow = "none";
  item.style.background = "transparent";
  item.setAttribute(DUPLICATE_ATTR, "true");
}

function clearDuplicateMarks(items) {
  for (const item of items) {
    item.style.display = "";
    item.style.height = "";
    item.style.minHeight = "";
    item.style.margin = "";
    item.style.padding = "";
    item.style.overflow = "";
    item.style.border = "";
    item.style.boxShadow = "";
    item.style.background = "";
    item.removeAttribute(DUPLICATE_ATTR);
  }
}

function getVisualItems(items) {
  // DOM order can differ from on-screen order in virtualized lists.
  // Use visual position to pick the "first" item reliably.
  return items
    .map((item) => {
      const rect = item.getBoundingClientRect();
      return { item, top: rect.top, left: rect.left, height: rect.height };
    })
    .filter((entry) => Number.isFinite(entry.top) && entry.height > 0)
    .sort((a, b) => (a.top - b.top) || (a.left - b.left))
    .map((entry) => entry.item);
}

function applyDuplicateMarks(items) {
  const ordered = getVisualItems(items);
  const firstByKey = new Map();
  for (const item of ordered) {
    if (!shouldDedupe(item)) continue;
    const editor = item.querySelector(".editor-content");
    if (!editor) continue;
    const key = getBodyKey(editor);
    if (!key || key.length < MIN_BODY_CHARS) continue;

    if (!firstByKey.has(key)) {
      firstByKey.set(key, item);
      continue;
    }
    markDuplicate(item);
  }
}

function applyTenLinePreview(editor) {
  editor.classList.remove("line-clamp-3");
  editor.classList.remove("line-clamp-4");
  editor.classList.remove("line-clamp-2");
  editor.classList.add("line-clamp-none");

  editor.style.display = "-webkit-box";
  editor.style.webkitBoxOrient = "vertical";
  editor.style.webkitLineClamp = "10";
  editor.style.overflow = "hidden";

  const existing = editor.querySelector(`.${ELLIPSIS_CLASS}`);
  if (existing) existing.remove();

  requestAnimationFrame(() => {
    if (editor.scrollHeight > editor.clientHeight + 1) {
      const ellipsis = document.createElement("span");
      ellipsis.className = ELLIPSIS_CLASS;
      ellipsis.textContent = " ...";
      editor.appendChild(ellipsis);
    }
  });

  editor.setAttribute(EXPANDED_ATTR, "true");
}

function applyExpansions(items, now) {
  for (const item of items) {
    const editor = item.querySelector(".editor-content");
    if (!editor) continue;
    if (!shouldExpand(item)) continue;
    if (now < expandEnabledAt) continue;
    if (editor.getAttribute(EXPANDED_ATTR) === "true") continue;
    applyTenLinePreview(editor);
  }
}

function applyDedupe(items, now) {
  clearDuplicateMarks(items);
  if (now < dedupeEnabledAt) return;
  applyDuplicateMarks(items);
}

function expandText(root = document) {
  const items = getItems(root);
  if (items.length === 0) return;
  const now = nowMs();

  applyExpansions(items, now);
  applyDedupe(items, now);
}

function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .${ITEM_CLASS} p.line-clamp-2 {
      line-height: 1.2;
    }

    .${ITEM_CLASS} .editor-content,
    .${ITEM_CLASS} .editor-content p {
      line-height: 1.3;
    }

    .${ITEM_CLASS} .ProseMirror-trailingBreak,
    .${ITEM_CLASS} .ProseMirror-separator {
      display: none;
    }

    .editor-content[${EXPANDED_ATTR}="true"] {
      display: -webkit-box !important;
      -webkit-box-orient: vertical !important;
      -webkit-line-clamp: 10 !important;
      overflow: hidden !important;
    }

    .editor-content .${ELLIPSIS_CLASS} {
      white-space: nowrap;
    }

    .${ITEM_CLASS}[${DUPLICATE_ATTR}="true"] {
      height: 0 !important;
      min-height: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
      border: 0 !important;
      box-shadow: none !important;
      background: transparent !important;
      overflow: hidden !important;
    }

    .${ITEM_CLASS}[${DUPLICATE_ATTR}="true"] * {
      display: none !important;
    }
  `;
  document.head.appendChild(style);
}

function getListParent() {
  const item = document.querySelector(`.${ITEM_CLASS}`);
  return item ? item.parentElement : null;
}

function startListObserver(listParent) {
  if (currentObserver) currentObserver.disconnect();

  let timer = null;
  const obs = new MutationObserver(() => {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      expandText(listParent);
    }, OBS_DEBOUNCE_MS);
  });

  obs.observe(listParent, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
  });
  currentObserver = obs;
}

function tryStartListObserver() {
  const listParent = getListParent();
  if (!listParent) return false;
  expandText(listParent);
  startListObserver(listParent);
  return true;
}

function watchForListParent() {
  if (tryStartListObserver()) return;
  if (finderObserver || !document.body) return;

  finderObserver = new MutationObserver(() => {
    if (!tryStartListObserver()) return;
    finderObserver.disconnect();
    finderObserver = null;
  });
  finderObserver.observe(document.body, { childList: true, subtree: true });
}

function clearObservers() {
  if (currentObserver) {
    currentObserver.disconnect();
    currentObserver = null;
  }
  if (finderObserver) {
    finderObserver.disconnect();
    finderObserver = null;
  }
}

function startPeriodicExpand() {
  if (periodicTimer) return;
  periodicTimer = setInterval(() => expandText(document), PERIODIC_EXPAND_MS);
}

function stopPeriodicExpand() {
  if (!periodicTimer) return;
  clearInterval(periodicTimer);
  periodicTimer = null;
}

function init() {
  injectStyle();
  watchForListParent();
  expandText(document);
}

function scheduleInit() {
  init();
  setTimeout(init, INIT_DELAY_MS);
}

function resetStateForNavigation() {
  clearObservers();
  stopPeriodicExpand();
  setTiming();
}

function onUrlChange() {
  if (lastUrl === location.href) return;
  lastUrl = location.href;
  resetStateForNavigation();
  scheduleInit();
  startPeriodicExpand();
}

function hookHistory() {
  const originalPushState = history.pushState;
  history.pushState = function (...args) {
    originalPushState.apply(this, args);
    onUrlChange();
  };
  const originalReplaceState = history.replaceState;
  history.replaceState = function (...args) {
    originalReplaceState.apply(this, args);
    onUrlChange();
  };
  window.addEventListener("popstate", onUrlChange);
}

function bootstrap() {
  scheduleInit();
  hookHistory();
  startPeriodicExpand();
}

const isTestEnv = typeof module !== "undefined" && module.exports;
if (!isTestEnv) {
  if (document.readyState === "complete") {
    bootstrap();
  } else {
    window.addEventListener("load", bootstrap);
  }
}

function setTimingForTest({ expandAt, dedupeAt } = {}) {
  if (typeof expandAt === "number") expandEnabledAt = expandAt;
  if (typeof dedupeAt === "number") dedupeEnabledAt = dedupeAt;
}

if (isTestEnv) {
  module.exports = {
    getItems,
    getBodyKey,
    shouldExpand,
    applyTenLinePreview,
    expandText,
    clearDuplicateMarks,
    applyDuplicateMarks,
    markDuplicate,
    setTimingForTest,
    EXPANDED_ATTR,
    DUPLICATE_ATTR,
  };
}
