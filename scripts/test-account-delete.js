#!/usr/bin/env node
const API = (process.env.GV_API_BASE || "http://localhost:3001").replace(/\/$/, "");
const email = `delete-test-${Date.now()}@example.com`;
const password = "TestDelete123!";

function assert(label, ok) {
  if (!ok) { console.error("FAIL:", label); process.exitCode = 1; return false; }
  console.log("OK:", label);
  return true;
}

async function main() {
  const reg = await fetch(`${API}/api/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name: "Delete Test", tier: "locker" }),
  });
  const regBody = await reg.json();
  assert("register test user", reg.ok && regBody.session?.token);
  const token = regBody.session.token;

  const sessionBefore = await fetch(`${API}/api/session`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert("session valid before delete", sessionBefore.ok);

  const del = await fetch(`${API}/api/account/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ password, confirm: "DELETE" }),
  });
  const delBody = await del.json();
  assert("delete account", del.ok && delBody.deleted);

  const sessionAfter = await fetch(`${API}/api/session`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert("session invalid after delete", sessionAfter.status === 401);

  const login = await fetch(`${API}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  assert("login fails after delete", login.status === 401 || login.status === 404);

  if (process.exitCode) console.error("\nAccount delete tests failed.");
  else console.log("\nAll account delete tests passed.");
}

main().catch((e) => { console.error(e); process.exit(1); });
