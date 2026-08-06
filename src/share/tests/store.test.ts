import { describe, expect, test, beforeEach } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ShareStore } from "../store";
import { SessionStore } from "../../session/store";

let dir: string;
let store: ShareStore;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "share-store-"));
  // shares references sessions(id) — the real composition is SessionStore +
  // ShareStore over one DB (daemon does both).
  const sessionStore = new SessionStore(join(dir, "test.db"));
  sessionStore.save({
    id: "s1",
    agent: "a",
    model: "m",
    title: "",
    cwd: "/tmp",
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  store = new ShareStore(sessionStore.db);
});

describe("ShareStore", () => {
  test("create returns a 64-hex token and persists it", () => {
    const token = store.create("s1");
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(store.findByToken(token)).toBe("s1");
  });

  test("re-creating a share replaces the token (old token dead)", () => {
    const oldToken = store.create("s1");
    const newToken = store.create("s1");
    expect(newToken).not.toBe(oldToken);
    expect(store.findByToken(oldToken)).toBeNull();
    expect(store.findByToken(newToken)).toBe("s1");
  });

  test("revoke deletes the row and is idempotent", () => {
    const token = store.create("s1");
    store.revoke("s1");
    expect(store.findByToken(token)).toBeNull();
    store.revoke("s1");
  });

  test("unknown token yields null (unknown ≡ revoked)", () => {
    expect(store.findByToken("deadbeef")).toBeNull();
  });

  test("get returns the token for a shared session, null otherwise", () => {
    expect(store.get("s1")).toBeNull();
    const token = store.create("s1");
    expect(store.get("s1")).toBe(token);
    store.revoke("s1");
    expect(store.get("s1")).toBeNull();
  });
});
