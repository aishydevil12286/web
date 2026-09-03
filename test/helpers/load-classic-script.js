import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * The project's scripts/js/*.js files are classic (non-module) browser
 * scripts: they declare top-level `function` names that become globals when
 * loaded via a real <script> tag, and rely on other globals (jQuery, utils,
 * etc.) already being present. There is no bundler/module system to import
 * them through, so tests load them the same way a browser would: read the
 * file and run it against the current global scope.
 *
 * Call this only within a jsdom test environment (vitest.config.js sets
 * environment: "jsdom" for everything under test/), where `window` is
 * already the global object.
 *
 * This uses vm.runInThisContext(), not eval(): every one of these files
 * starts with "use strict", and per spec, top-level function/var
 * declarations inside *strict-mode eval code* are scoped to that eval call
 * only and never attach to the global object -- eval("use strict"; ...)
 * would silently make escapeHtml() etc. disappear the moment loadScript()
 * returns. That restriction is specific to eval; a real <script> tag (and
 * vm.runInThisContext, which uses the same "Script" semantics) attaches
 * strict-mode top-level declarations to the global object exactly like a
 * browser would.
 *
 * @param {string} relativePath - path under scripts/js/, e.g. "utils.js"
 */
export function loadClassicScript(relativePath) {
  const filename = path.join(repoRoot, "scripts", "js", relativePath);
  const code = fs.readFileSync(filename, "utf8");
  vm.runInThisContext(code, { filename });
}
