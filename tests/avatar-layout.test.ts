import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("아바타 설명은 한글 단어를 우선 통째로 줄바꿈한다", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const rule = css.match(/\.avatar-facts dd\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(rule, /word-break:\s*keep-all/);
  assert.match(rule, /overflow-wrap:\s*break-word/);
  assert.match(rule, /text-wrap:\s*pretty/);
});

test("아바타 배경은 단순한 CSS 그림이며 원본 풍경은 보존한다", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const scene = css.match(/\.preview \.avatar-scene\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(scene, /radial-gradient/);
  assert.match(scene, /linear-gradient/);
  assert.doesNotMatch(scene, /url\(/);
  const original = readFileSync(new URL("../public/avatars/saju-landscape.png", import.meta.url));
  assert.equal(original.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
});
