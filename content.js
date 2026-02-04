const ITEM_CLASS = "infiniteLoadingItem";
const STYLE_ID = "vc-expand-style";
const INIT_DELAY_MS = 1200;
const OBS_DEBOUNCE_MS = 200;
const EXPANDED_ATTR = "data-vc-expanded";
const MENTION_SUFFIX = "であなたにメンションしました";
const HIDDEN_ATTR = "data-vc-hidden";
const DEDUPE_LINES = 5;

const seenBodies = new Set();

function shouldExpand(item) {
  const title = item.querySelector("p.line-clamp-2");
  if (!title) return false;
  const text = (title.textContent || "").trim();
  return text.endsWith(MENTION_SUFFIX);
}

function expandText(root = document) {
  const items = root.classList && root.classList.contains(ITEM_CLASS)
    ? [root]
    : Array.from(root.querySelectorAll(`.${ITEM_CLASS}`));
  if (items.length === 0) return;

  for (const item of items) {
    const editor = item.querySelector(".editor-content");
    if (!editor) continue;
    if (editor.getAttribute(EXPANDED_ATTR) === "true") continue;
    if (item.getAttribute(HIDDEN_ATTR) === "true") continue;

    const text = (editor.innerText || editor.textContent || "").trim();
    if (text) {
      const lines = text
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, DEDUPE_LINES);
      if (lines.length > 0) {
        const key = lines.join("\n");
        if (seenBodies.has(key)) {
          item.style.display = "none";
          item.setAttribute(HIDDEN_ATTR, "true");
          continue;
        }
        seenBodies.add(key);
      }
    }
    if (!shouldExpand(item)) continue;

    editor.classList.remove("line-clamp-3");
    editor.classList.remove("line-clamp-4");
    editor.classList.remove("line-clamp-2");
    editor.classList.add("line-clamp-none");

    editor.style.maxHeight = "none";
    editor.style.overflow = "visible";

    editor.setAttribute(EXPANDED_ATTR, "true");
  }
}

function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .editor-content.${EXPANDED_ATTR} {
      max-height: none;
    }
  `;
  document.head.appendChild(style);
}

function waitForListParent() {
  const item = document.querySelector(`.${ITEM_CLASS}`);
  if (item && item.parentElement) return item.parentElement;
  return null;
}

function init() {
  injectStyle();

  const listParent = waitForListParent();
  if (listParent) {
    expandText(listParent);
    startObserver(listParent);
    return;
  }

  let tries = 0;
  const interval = setInterval(() => {
    const parent = waitForListParent();
    tries += 1;
    if (parent) {
      clearInterval(interval);
      expandText(parent);
      startObserver(parent);
    } else if (tries > 40) {
      clearInterval(interval);
    }
  }, 500);
}

function startObserver(listParent) {
  let timer = null;
  const obs = new MutationObserver((mutations) => {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          const el = node;
          if (el.classList && el.classList.contains(ITEM_CLASS)) {
            expandText(el);
          } else {
            const nested = el.querySelector ? el.querySelector(`.${ITEM_CLASS}`) : null;
            if (nested) expandText(el);
          }
        }
      }
    }, OBS_DEBOUNCE_MS);
  });
  obs.observe(listParent, { childList: true, subtree: true });
}

if (document.readyState === "complete") {
  setTimeout(init, INIT_DELAY_MS);
} else {
  window.addEventListener("load", () => setTimeout(init, INIT_DELAY_MS));
}
