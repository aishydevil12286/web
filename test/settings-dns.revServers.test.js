import { createRequire } from "node:module";
import { beforeAll, describe, expect, it } from "vitest";
import { loadClassicScript } from "./helpers/load-classic-script.js";

const require = createRequire(import.meta.url);

// Regression test for the revServers DataTable XSS: network/ip/domain come
// from FTL's dns.revServers config (admin-settable via the API) and are
// rendered into a DataTable whose columns had a createdCell callback but no
// render -- DataTables' default behavior for a column with no render is to
// insert the cell data as raw HTML. Fixed by adding an explicit render()
// that calls utils.escapeHtml(); see settings-dns.js. This test exercises
// the real createRevServerTable() function from that file end to end
// (real jQuery, real datatables.net-bs, a real DOM), not a re-implementation
// of its logic, so it keeps testing the actual shipped code.
beforeAll(() => {
  globalThis.$ = require("jquery");
  globalThis.jQuery = globalThis.$;

  // datatables.net's UMD, when window is already a global (as it is under
  // vitest's jsdom environment), exports a (root, $) => {...} init
  // function rather than eagerly binding itself -- call it explicitly.
  require("datatables.net")(globalThis.window, globalThis.$);
  require("datatables.net-bs")(globalThis.window, globalThis.$);

  loadClassicScript("utils.js");

  // settings-dns.js has top-level side effects that don't belong in a unit
  // test: `$(() => { processDNSConfig(); })` fires an $.ajax GET once the
  // document is "ready", and `$("#btnAddRevServers").on("click", ...)`
  // just registers a (never-fired-here) handler. Stub $.ajax so the former
  // resolves harmlessly instead of erroring on a network call jsdom can't
  // make.
  globalThis.$.ajax = () => ({
    done() {
      return this;
    },
    fail() {
      return this;
    },
  });

  loadClassicScript("settings-dns.js");
});

function renderRevServersTable(textareaContent) {
  document.body.innerHTML = `
    <textarea class="revServers">${textareaContent}</textarea>
    <table id="revServers-table"></table>
  `;
  globalThis.createRevServerTable();
}

describe("settings-dns.js revServers table", () => {
  it("escapes an XSS payload in the domain column instead of injecting it as HTML", () => {
    const payload = '<img src=x onerror="window.__pwned=true">';
    renderRevServersTable(`true,192.168.1.0/24,10.0.0.1,${payload}`);

    const domainCell = document.querySelector("#revServers-table tbody td.revserver-domain");
    expect(domainCell).not.toBeNull();

    // The payload must not have become a real element: no <img> in the
    // rendered DOM, and window.__pwned must never have been set.
    expect(domainCell.querySelector("img")).toBeNull();
    expect(globalThis.__pwned).toBeUndefined();

    // The literal text is still visible to the user (as text, not markup).
    expect(domainCell.textContent).toBe(payload);
  });

  it("escapes an XSS payload in the network and ip columns the same way", () => {
    const networkPayload = '<svg onload="window.__pwned=true">';
    const ipPayload = '"><script>window.__pwned=true</script>';
    renderRevServersTable(`true,${networkPayload},${ipPayload},example.com`);

    const networkCell = document.querySelector("#revServers-table tbody td.revserver-network");
    const ipCell = document.querySelector("#revServers-table tbody td.revserver-ip");

    expect(networkCell.querySelector("svg")).toBeNull();
    expect(ipCell.querySelector("script")).toBeNull();
    expect(globalThis.__pwned).toBeUndefined();

    expect(networkCell.textContent).toBe(networkPayload);
    expect(ipCell.textContent).toBe(ipPayload);
  });

  it("still displays a normal, non-malicious row correctly", () => {
    renderRevServersTable("true,192.168.1.0/24,10.0.0.1,router.local");

    const row = document.querySelector("#revServers-table tbody tr");
    expect(row.querySelector(".revserver-network").textContent).toBe("192.168.1.0/24");
    expect(row.querySelector(".revserver-ip").textContent).toBe("10.0.0.1");
    expect(row.querySelector(".revserver-domain").textContent).toBe("router.local");
  });

  it("the data-initial-value attribute (used to detect unsaved edits) still holds the raw, unescaped value", () => {
    // createdCell() receives the original data, not the render() output --
    // this must keep working: .attr() uses setAttribute, which never
    // parses its value as HTML regardless of content, so this is safe
    // independent of the render() escaping above.
    const payload = "<b>bold</b>";
    renderRevServersTable(`true,net,ip,${payload}`);

    const domainCell = document.querySelector("#revServers-table tbody td.revserver-domain");
    expect(domainCell.dataset.initialValue).toBe(payload);
  });
});
