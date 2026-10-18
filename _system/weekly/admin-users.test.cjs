const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { stripTypeScriptTypes } = require("node:module");
const { test } = require("node:test");

function server(options = {}) {
  const calls = [];
  let handler;
  const client = {
    auth: {
      getUser: async () => ({ data: { user: options.unauthenticated ? null : { id: "caller" } }, error: null }),
      admin: {
        createUser: async input => { calls.push(["create", input]); return { data: { user: { id: "new-user" } }, error: options.duplicate ? { message: "Phone already registered" } : null }; },
        deleteUser: async id => { calls.push(["delete", id]); return { error: options.cleanupFails ? { message: "Delete unavailable" } : null }; },
      },
    },
    from(table) {
      const query = {
        select() { return query; }, eq() { return query; },
        async maybeSingle() { return { data: table === "planner_family_members" ? { role: options.role || "admin", active: options.active !== false } : options.existingPhone ? { user_id: "existing" } : null, error: null }; },
        async insert(row) { calls.push([table, row]); return { error: options.profileFails && table === "planner_family_private" ? { message: "Database unavailable" } : null }; },
      };
      return query;
    },
  };
  const file = path.resolve(__dirname, "..", "..", "supabase", "functions", "create-planner-member", "index.ts");
  const code = stripTypeScriptTypes(fs.readFileSync(file, "utf8").replace(/^import .*;\r?\n/, ""));
  vm.runInNewContext(code, {
    createClient: () => client, Response, console: { error() {} },
    Deno: { env: { get: () => "configured" }, serve: callback => { handler = callback; } },
  });
  return { calls, request: (input, token = "valid") => handler(new Request("https://example.test/create", {
    method: "POST", headers: token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : {},
    body: JSON.stringify(input),
  })) };
}
const valid = { name: "Dhruva", phone: "+919876543210", password: "Separate-Pass42!" };
test("rejects missing/expired sessions and non-admin users before account creation", async () => {
  for (const [options, token, status] of [[{}, "", 401], [{ unauthenticated: true }, "expired", 401], [{ role: "member" }, "valid", 403], [{ active: false }, "valid", 403]]) {
    const instance = server(options);
    assert.equal((await instance.request(valid, token)).status, status);
    assert.equal(instance.calls.length, 0);
  }
});
test("validates mobile and password before creating a user", async () => {
  const instance = server();
  assert.equal((await instance.request({ ...valid, phone: "+91123" })).status, 400);
  assert.equal((await instance.request({ ...valid, password: "short" })).status, 400);
  assert.equal(instance.calls.length, 0);
});
test("creates only a member, returns name+phone ID, never returns/stores readable password", async () => {
  const instance = server();
  const response = await instance.request({ ...valid, role: "admin" });
  assert.equal(response.status, 201);
  const data = await response.json();
  assert.equal(data.loginId, "DHRUVA9876543210");
  assert.equal(JSON.stringify(data).includes(valid.password), false);
  const profile = instance.calls.find(call => call[0] === "planner_family_members")[1];
  assert.equal(profile.role, "member");
  assert.equal(JSON.stringify(profile).includes(valid.password), false);
  assert.equal(instance.calls[0][1].password, valid.password);
  assert.equal(instance.calls[0][1].email, "member.919876543210@members.vyom.invalid");
  assert.equal(instance.calls[0][1].email_confirm, true);
  assert.equal(instance.calls[0][1].phone, undefined);
});
test("rejects a mobile already in the private member roster", async () => {
  const instance = server({ existingPhone: true });
  assert.equal((await instance.request(valid)).status, 409);
  assert.equal(instance.calls.length, 0);
});
test("does not overwrite an existing phone account", async () => {
  const instance = server({ duplicate: true });
  assert.equal((await instance.request(valid)).status, 400);
  assert.equal(instance.calls.length, 1);
});
test("rolls back new Auth account if profile setup fails; reports cleanup failure explicitly", async () => {
  for (const cleanupFails of [false, true]) {
    const instance = server({ profileFails: true, cleanupFails });
    const response = await instance.request(valid);
    assert.equal(response.status, 500);
    assert.ok(instance.calls.some(call => call[0] === "delete"));
    assert.match((await response.json()).error, cleanupFails ? /inspect\/remove Auth user/ : /new account was removed/);
  }
});
