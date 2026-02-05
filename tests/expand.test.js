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
    title: "青木さんがクラスであなたにメンションしました",
    body: "本文",
    top: 0,
  });
  document.body.appendChild(item);
  expect(shouldExpand(item)).toBe(true);
});

test("expandText expands mention body", () => {
  const item = buildItem({
    title: "青木さんがクラスであなたにメンションしました",
    body: "本文",
    top: 0,
  });
  document.body.appendChild(item);
  expandText(document);
  const editor = item.querySelector(".editor-content");
  expect(editor.getAttribute(EXPANDED_ATTR)).toBe("true");
  expect(editor.classList.contains("line-clamp-none")).toBe(true);
});

test("expand is delayed until expandAt", () => {
  jest.useFakeTimers();
  const item = buildItem({
    title: "青木さんがクラスであなたにメンションしました",
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
    title: "青木さんがクラスであなたにメンションしました",
    body: bodyText,
    top: 0,
  });
  const second = buildItem({
    title: "青木さんがクラスであなたにメンションしました",
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
    title: "青木さんがクラスであなたにメンションしました",
    body: bodyText,
    top: 0,
  });
  const second = buildItem({
    title: "青木さんがクラスであなたにメンションしました",
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
