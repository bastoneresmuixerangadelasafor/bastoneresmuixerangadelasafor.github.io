import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const read = path => readFileSync(new URL(path, root), "utf8");

test("production and preview pages retain their configured backends", () => {
  assert.match(read(".config/production.env"), /^API_BACKEND=["']?gas["']?\s*$/m);
  assert.match(read("templates/production.md"), /^api_backend: gas\s*$/m);
  assert.match(read("templates/new.md"), /^api_backend: supabase\s*$/m);
  assert.match(read("docs/index.html"), /const API_BACKEND = "gas"/);
  assert.match(read("docs/new.html"), /const API_BACKEND = "supabase"/);
  assert.match(read("docs/index.html"), /const SESSION_TOKEN = "session_token"/);
  assert.match(read("docs/new.html"), /const SESSION_TOKEN = "supabase_preview_session_token"/);
});

test("GAS and Supabase keep separate sessions and cached API data", () => {
  const values = new Map();
  const localStorage = {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
  const source = `${read("docs/scripts/cache.js")}\nglobalThis.cache = CACHE;`;
  const gas = { localStorage, API_BACKEND: "gas", SESSION_TOKEN: "session_token", URLSearchParams, console };
  const supabase = { localStorage, API_BACKEND: "supabase", SESSION_TOKEN: "supabase_preview_session_token", URLSearchParams, console };
  vm.runInNewContext(source, gas);
  vm.runInNewContext(source, supabase);
  gas.cache.saveToken({ token: "gas-token" });
  supabase.cache.saveToken({ token: "supabase-token" });
  gas.cache._write({ key: "events", data: ["gas-event"] });
  supabase.cache._write({ key: "events", data: ["supabase-event"] });
  assert.equal(gas.cache.getToken(), "gas-token");
  assert.equal(supabase.cache.getToken(), "supabase-token");
  assert.equal(gas.cache.getEvents()[0], "gas-event");
  assert.equal(supabase.cache.getEvents()[0], "supabase-event");
  supabase.cache.clearSession();
  assert.equal(gas.cache.getToken(), "gas-token");
  assert.equal(supabase.cache.getToken(), null);
});
