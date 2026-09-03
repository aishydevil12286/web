import { createRequire } from "node:module";
import { beforeAll, describe, expect, it } from "vitest";
import { loadClassicScript } from "./helpers/load-classic-script.js";

// utils.js's own top-level `$(() => { $.ajaxSetup(...) })` block needs a
// real jQuery global to be present when the file is loaded, same as it
// would in the browser (utils.js is always loaded after jquery.js there).
//
// Under vitest's jsdom environment, `window`/`document` are already real
// Node globals *before* jquery.js's own module-load-time IIFE runs, so
// `require("jquery")` returns jQuery already bound to them directly --
// unlike a bare Node script, there is no separate `factory(window)` step
// to call here.
const require = createRequire(import.meta.url);

beforeAll(() => {
  globalThis.$ = require("jquery");
  globalThis.jQuery = globalThis.$;
  loadClassicScript("utils.js");
});

describe("utils.escapeHtml", () => {
  it("escapes the five HTML-significant characters", () => {
    expect(globalThis.escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#039;");
  });

  it("neutralizes a script-tag injection payload", () => {
    const payload = "<script>alert(1)</script>";
    const escaped = globalThis.escapeHtml(payload);
    expect(escaped).not.toContain("<script>");
    expect(escaped).toBe("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("neutralizes an attribute-breakout payload", () => {
    const payload = '" onmouseover="alert(1)';
    const escaped = globalThis.escapeHtml(payload);
    expect(escaped).not.toContain('"');
  });

  it("leaves plain text untouched", () => {
    expect(globalThis.escapeHtml("router1")).toBe("router1");
  });

  it("passes non-string input through unchanged (documented early-return)", () => {
    expect(globalThis.escapeHtml(42)).toBe(42);
    expect(globalThis.escapeHtml(null)).toBe(null);
  });
});
