const ITEM_CLASS = "infiniteLoadingItem";
const STYLE_ID = "vc-expand-style";
const INIT_DELAY_MS = 1200;
const OBS_DEBOUNCE_MS = 200;
const PERIODIC_EXPAND_MS = 2000;
const EXPANDED_ATTR = "data-vc-expanded";
const HIDDEN_ATTR = "data-vc-hidden";
const MENTION_SUFFIX = "であなたにメンションしました";
const DEDUPE_LINES = 5;
const MIN_BODY_CHARS = 20;

let seenBodies = new Set();
let itemBodyKey = new WeakMap();
let itemSignature = new WeakMap();
let currentObserver = null;
let finderObserver = null;
let periodicTimer = null;
let lastUrl = location.href;

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

function getItemSignature(item, editor) {
  const titleText = getTitleText(item);
  const bodyKey = getBodyKey(editor);
  return `${titleText}||${bodyKey}`;
}

function shouldExpand(item) {
  const titleText = getTitleText(item);
  return titleText.includes(MENTION_SUFFIX);
}

function hideIfDuplicate(item, editor) {
  if (itemBodyKey.has(item)) return false;
  const key = getBodyKey(editor);
  if (!key) return false;
  if (key.length < MIN_BODY_CHARS) return false;
  if (seenBodies.has(key)) {
    item.style.display = "none";
    item.setAttribute(HIDDEN_ATTR, "true");
    return true;
  }
  seenBodies.add(key);
  itemBodyKey.set(item, key);
  return false;
}

function expandEditor(editor) {
  editor.classList.remove("line-clamp-3");
  editor.classList.remove("line-clamp-4");
  editor.classList.remove("line-clamp-2");
  editor.classList.add("line-clamp-none");

  editor.style.maxHeight = "none";
  editor.style.overflow = "visible";

  editor.setAttribute(EXPANDED_ATTR, "true");
}

function expandText(root = document) {
  const items = getItems(root);
  if (items.length === 0) return;

  for (const item of items) {
    const editor = item.querySelector(".editor-content");
    if (!editor) continue;

    const signature = getItemSignature(item, editor);
    const prevSignature = itemSignature.get(item);
    if (prevSignature && prevSignature !== signature) {
      item.style.display = "";
      item.removeAttribute(HIDDEN_ATTR);
      editor.removeAttribute(EXPANDED_ATTR);
    }
    itemSignature.set(item, signature);

    if (editor.getAttribute(EXPANDED_ATTR) === "true") continue;
    if (item.getAttribute(HIDDEN_ATTR) === "true") continue;

    if (hideIfDuplicate(item, editor)) continue;
    if (!shouldExpand(item)) continue;

    expandEditor(editor);
  }
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

    .editor-content.${EXPANDED_ATTR} {
      max-height: none;
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
  setTimeout(init, INIT_DELAY_MS);
}

function onUrlChange() {
  if (lastUrl === location.href) return;
  lastUrl = location.href;
  seenBodies = new Set();
  itemBodyKey = new WeakMap();
  itemSignature = new WeakMap();
  clearObservers();
  stopPeriodicExpand();
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

if (document.readyState === "complete") {
  bootstrap();
} else {
  window.addEventListener("load", bootstrap);
}
