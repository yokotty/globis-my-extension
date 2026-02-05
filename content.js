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
const COLLAPSED_ATTR = "data-vc-collapsed";

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

function getItemSignature(item, editor) {
  const titleText = getTitleText(item);
  return `${titleText}||${editor.innerText || editor.textContent || ""}`;
}

function shouldExpand(item) {
  const titleText = getTitleText(item);
  return titleText.includes(MENTION_SUFFIX);
}

function resetItemState(item, editor) {
  item.style.display = "";
  item.style.height = "";
  item.style.minHeight = "";
  item.style.margin = "";
  item.style.padding = "";
  item.style.overflow = "";
  item.removeAttribute(HIDDEN_ATTR);
  item.removeAttribute(COLLAPSED_ATTR);
  editor.removeAttribute(EXPANDED_ATTR);
}

function expandEditor(editor) {
  editor.classList.remove("line-clamp-3");
  editor.classList.remove("line-clamp-4");
  editor.classList.remove("line-clamp-2");
  editor.classList.add("line-clamp-none");

  editor.style.maxHeight = "none";
  editor.style.overflow = "visible";
  editor.style.display = "block";
  editor.style.webkitLineClamp = "unset";
  editor.style.webkitBoxOrient = "initial";

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
      resetItemState(item, editor);
    }
    itemSignature.set(item, signature);

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

    .editor-content[${EXPANDED_ATTR}="true"] {
      max-height: none !important;
      overflow: visible !important;
      display: block !important;
      -webkit-line-clamp: unset !important;
      -webkit-box-orient: initial !important;
    }

    .${ITEM_CLASS}[${COLLAPSED_ATTR}="true"] {
      height: 0 !important;
      min-height: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
      border: 0 !important;
      box-shadow: none !important;
      background: transparent !important;
      overflow: hidden !important;
    }

    .${ITEM_CLASS}[${COLLAPSED_ATTR}="true"] * {
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
  itemSignature = new WeakMap();
  clearObservers();
  stopPeriodicExpand();
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

if (document.readyState === "complete") {
  bootstrap();
} else {
  window.addEventListener("load", bootstrap);
}
