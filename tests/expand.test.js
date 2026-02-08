const {
  expandText,
  shouldExpand,
  setTimingForTest,
  EXPANDED_ATTR,
  DUPLICATE_ATTR,
} = require("../content.js");

function buildItem({
  title,
  body,
  top,
} = {}) {
  const item = document.createElement("div");
  item.className = "infiniteLoadingItem";
  const titleP = document.createElement("p");
  titleP.className = "line-clamp-2";
  titleP.textContent = title;
  const editor = document.createElement("div");
  editor.className = "editor-content line-clamp-3";
  editor.textContent = body;
  item.appendChild(titleP);
  item.appendChild(editor);
  item.getBoundingClientRect = () => ({
    top,
    left: 0,
    height: 10,
    width: 100,
    right: 100,
    bottom: top + 10,
  });
  return item;
}

beforeEach(() => {
  document.body.innerHTML = "";
  setTimingForTest({ expandAt: 0, dedupeAt: 0 });
});

test("shouldExpand matches mention notifications", () => {
  const item = buildItem({
    title: "横田さんがクラスであなたにメンションしました",
    body: "本文",
    top: 0,
  });
  document.body.appendChild(item);
  expect(shouldExpand(item)).toBe(true);
});

test("reaction notifications are not expanded", () => {
  const item = buildItem({
    title: "横田さんがクラスであなたにリアクションしました",
    body: "本文",
    top: 0,
  });
  document.body.appendChild(item);
  expandText(document);
  const editor = item.querySelector(".editor-content");
  expect(editor.getAttribute(EXPANDED_ATTR)).toBe(null);
});

test("expandText expands mention body", () => {
  const item = buildItem({
    title: "横田さんがクラスであなたにメンションしました",
    body: "本文",
    top: 0,
  });
  document.body.appendChild(item);
  expandText(document);
  const editor = item.querySelector(".editor-content");
  expect(editor.getAttribute(EXPANDED_ATTR)).toBe("true");
  expect(editor.style.webkitLineClamp).toBe("10");
});

test("preview uses 10-line clamp for long bodies", () => {
  const longBody = Array.from({ length: 12 }, (_, i) => `行${i + 1}`).join("\n");
  const item = buildItem({
    title: "横田さんがクラスであなたにメンションしました",
    body: longBody,
    top: 0,
  });
  document.body.appendChild(item);
  expandText(document);
  const editor = item.querySelector(".editor-content");
  expect(editor.getAttribute(EXPANDED_ATTR)).toBe("true");
  expect(editor.style.webkitLineClamp).toBe("10");
  expect(editor.style.overflow).toBe("hidden");
});

test("expand is delayed until expandAt", () => {
  jest.useFakeTimers();
  const item = buildItem({
    title: "横田さんがクラスであなたにメンションしました",
    body: "本文",
    top: 0,
  });
  document.body.appendChild(item);

  const now = Date.now();
  setTimingForTest({ expandAt: now + 1000, dedupeAt: 0 });
  expandText(document);

  const editor = item.querySelector(".editor-content");
  expect(editor.getAttribute(EXPANDED_ATTR)).toBe(null);

  jest.advanceTimersByTime(1000);
  expandText(document);
  expect(editor.getAttribute(EXPANDED_ATTR)).toBe("true");

  jest.useRealTimers();
});

test("duplicate items are marked after ordering", () => {
  const bodyText = "同じ本文です。同じ本文です。同じ本文です。";
  const first = buildItem({
    title: "横田さんがクラスであなたにメンションしました",
    body: bodyText,
    top: 0,
  });
  const second = buildItem({
    title: "横田さんがクラスであなたにメンションしました",
    body: bodyText,
    top: 20,
  });
  document.body.appendChild(first);
  document.body.appendChild(second);

  expandText(document);

  expect(first.getAttribute(DUPLICATE_ATTR)).toBe(null);
  expect(second.getAttribute(DUPLICATE_ATTR)).toBe("true");
});

test("dedupe is delayed until dedupeAt", () => {
  jest.useFakeTimers();
  const bodyText = "同じ本文です。同じ本文です。同じ本文です。";
  const first = buildItem({
    title: "横田さんがクラスであなたにメンションしました",
    body: bodyText,
    top: 0,
  });
  const second = buildItem({
    title: "横田さんがクラスであなたにメンションしました",
    body: bodyText,
    top: 20,
  });
  document.body.appendChild(first);
  document.body.appendChild(second);

  const now = Date.now();
  setTimingForTest({ expandAt: 0, dedupeAt: now + 2000 });
  expandText(document);

  expect(second.getAttribute(DUPLICATE_ATTR)).toBe(null);

  jest.advanceTimersByTime(2000);
  expandText(document);
  expect(second.getAttribute(DUPLICATE_ATTR)).toBe("true");

  jest.useRealTimers();
});

test("duplicate item removes its preceding spacer siblings", () => {
  setTimingForTest({ expandAt: 0, dedupeAt: 0 });
  const bodyText = "同じ本文です。同じ本文です。同じ本文です。";

  const spacerA1 = document.createElement("div");
  spacerA1.className = "flex mt-4 md:mt-6 w-full items-start";
  const spacerB1 = document.createElement("div");
  spacerB1.className = "relative mr-3";

  const spacerA2 = document.createElement("div");
  spacerA2.className = "flex mt-4 md:mt-6 w-full items-start";
  const spacerB2 = document.createElement("div");
  spacerB2.className = "relative mr-3";

  const first = buildItem({
    title: "横田さんがクラスであなたにメンションしました",
    body: bodyText,
    top: 0,
  });
  const second = buildItem({
    title: "横田さんがクラスであなたにメンションしました",
    body: bodyText,
    top: 20,
  });

  document.body.appendChild(spacerA1);
  document.body.appendChild(spacerB1);
  document.body.appendChild(first);
  document.body.appendChild(spacerA2);
  document.body.appendChild(spacerB2);
  document.body.appendChild(second);

  expandText(document);

  expect(second.getAttribute(DUPLICATE_ATTR)).toBe("true");
  expect(spacerA2.isConnected).toBe(false);
  expect(spacerB2.isConnected).toBe(false);
});

test("different bodies are not marked as duplicates", () => {
  const first = buildItem({
    title: "横田さんがクラスであなたにメンションしました",
    body: "本文Aです。本文Aです。本文Aです。",
    top: 0,
  });
  const second = buildItem({
    title: "横田さんがクラスであなたにメンションしました",
    body: "本文Bです。本文Bです。本文Bです。",
    top: 20,
  });
  document.body.appendChild(first);
  document.body.appendChild(second);

  expandText(document);

  expect(first.getAttribute(DUPLICATE_ATTR)).toBe(null);
  expect(second.getAttribute(DUPLICATE_ATTR)).toBe(null);
});

test("reaction notifications are also deduped", () => {
  setTimingForTest({ expandAt: 0, dedupeAt: 0 });
  const bodyText = "リアクション本文です。リアクション本文です。";
  const first = buildItem({
    title: "横田さんがクラスであなたにリアクションしました",
    body: bodyText,
    top: 0,
  });
  const second = buildItem({
    title: "横田さんがクラスであなたにリアクションしました",
    body: bodyText,
    top: 20,
  });
  document.body.appendChild(first);
  document.body.appendChild(second);

  expandText(document);

  expect(first.getAttribute(DUPLICATE_ATTR)).toBe(null);
  expect(second.getAttribute(DUPLICATE_ATTR)).toBe("true");
});
