import { createRequire } from "node:module";
import { beforeAll, describe, expect, it } from "vitest";
import { loadClassicScript } from "./helpers/load-classic-script.js";

const require = createRequire(import.meta.url);

// Regression tests for two escaping fixes in valueDetails() (settings-advanced.js):
// - "string array" built a <textarea> from value.value.join("\n") with no
//   escaping -- a config value containing </textarea><script> could break
//   out of the textarea and execute.
// - "password (write-only string)" inserted value.value directly into a
//   value="..." attribute with no escaping -- a value containing a `"`
//   could break out of the attribute.
// Both config types come from FTL's config API (an authenticated admin can
// set arbitrary string/array values there), so a malicious or corrupted
// config value must not become live markup in the settings page.
beforeAll(() => {
  globalThis.$ = require("jquery");
  globalThis.jQuery = globalThis.$;

  loadClassicScript("utils.js");

  // settings-advanced.js has a top-level `$(() => {...})` ready block that
  // calls createDynamicConfigTabs() (issues an $.ajax GET) and
  // initOnlyChanged() (uses the bootstrap-toggle jQuery plugin, unrelated
  // to anything under test here and not part of this minimal setup).
  // Stub both so the ready block -- which fires asynchronously, after this
  // file's synchronous test assertions have already run -- resolves
  // harmlessly instead of throwing an unhandled error into the test run.
  globalThis.$.ajax = () => ({
    done() {
      return this;
    },
    fail() {
      return this;
    },
  });
  globalThis.$.fn.bootstrapToggle = function () {
    return this;
  };

  loadClassicScript("settings-advanced.js");
});

// Parses the returned HTML fragment into a detached DOM node so assertions
// can inspect real elements/attributes rather than doing substring
// matching on the raw markup string.
function parseFragment(html) {
  const container = document.createElement("div");
  container.innerHTML = html;
  return container;
}

describe("settings-advanced.js valueDetails -- string array (textarea)", () => {
  it("escapes a value that would otherwise break out of the textarea", () => {
    const payload = '</textarea><img src=x onerror="window.__pwned=true">';
    const html = globalThis.valueDetails("some.key", {
      modified: false,
      flags: { env_var: false },
      type: "string array",
      value: [payload],
      allowed: undefined,
    });

    const fragment = parseFragment(html);
    const textarea = fragment.querySelector("textarea");
    expect(textarea).not.toBeNull();

    // If the payload had broken out, there would be a real <img> as a
    // sibling of the textarea (or elsewhere in the fragment) instead of
    // just being part of the textarea's text content.
    expect(fragment.querySelector("img")).toBeNull();
    expect(globalThis.__pwned).toBeUndefined();
    expect(textarea.value).toBe(payload);
  });

  it("still renders a normal array value, one item per line", () => {
    const html = globalThis.valueDetails("dns.upstreams", {
      modified: false,
      flags: { env_var: false },
      type: "string array",
      value: ["8.8.8.8", "1.1.1.1"],
      allowed: undefined,
    });

    const textarea = parseFragment(html).querySelector("textarea");
    expect(textarea.value).toBe("8.8.8.8\n1.1.1.1");
  });
});

describe("settings-advanced.js valueDetails -- password (write-only string)", () => {
  it("escapes a value that would otherwise break out of the value attribute", () => {
    const payload = '" onmouseover="window.__pwned=true" data-x="';
    const html = globalThis.valueDetails("webserver.api.app_pwhash", {
      modified: false,
      flags: { env_var: false },
      type: "password (write-only string)",
      value: payload,
      allowed: undefined,
    });

    const input = parseFragment(html).querySelector('input[type="password"]');
    expect(input).not.toBeNull();

    // The parsed DOM is the ground truth for whether the attribute
    // actually broke out: if it had, `value` would not round-trip to the
    // original payload and/or a stray onmouseover attribute would exist
    // on the input (or a sibling element).
    expect(input.getAttribute("value")).toBe(payload);
    expect(input.hasAttribute("onmouseover")).toBe(false);
  });
});
