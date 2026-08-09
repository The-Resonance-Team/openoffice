import { describe, expect, test } from "bun:test";
import { AttachedClients } from "../attached";

describe("AttachedClients", () => {
  test("attach and detach count per session, independently", () => {
    const attached = new AttachedClients();
    expect(attached.count("s1")).toBe(0);
    attached.attach("s1");
    attached.attach("s1");
    expect(attached.count("s1")).toBe(2);
    attached.detach("s1");
    expect(attached.count("s1")).toBe(1);
    expect(attached.count("s2")).toBe(0);
  });

  test("detach floors at zero (double aborts, daemon restart)", () => {
    const attached = new AttachedClients();
    attached.detach("s1");
    attached.detach("s1");
    expect(attached.count("s1")).toBe(0);
    attached.attach("s1");
    attached.detach("s1");
    attached.detach("s1");
    expect(attached.count("s1")).toBe(0);
  });

  test("an explicit end is granted only to the last attached client", () => {
    const attached = new AttachedClients();
    expect(attached.shouldEndOnExplicitEnd("s1")).toBe(true);
    attached.attach("s1");
    attached.attach("s1");
    expect(attached.shouldEndOnExplicitEnd("s1")).toBe(false);
    attached.detach("s1");
    expect(attached.shouldEndOnExplicitEnd("s1")).toBe(true);
  });
});
