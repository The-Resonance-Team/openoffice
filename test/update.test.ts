import { describe, expect, test, beforeEach } from "bun:test";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  existsSync,
  mkdirSync,
  chmodSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  parseVersion,
  compareVersions,
  newestRelease,
  artifactName,
  fetchChecksums,
  verifySha256,
  sha256,
  swapBinary,
  cleanupPendingUpdate,
  checkForUpdate,
  performUpdate,
  type ReleaseInfo,
} from "../src/update";

function releases(...tags: string[]): ReleaseInfo[] {
  return tags.map((tag) => ({
    tag,
    version: tag.replace(/^v/, ""),
    prerelease: tag.includes("-"),
  }));
}

describe("parseVersion / compareVersions", () => {
  test("parses stable and pre-release", () => {
    expect(parseVersion("v1.2.3")).toEqual({ core: [1, 2, 3], pre: null });
    expect(parseVersion("1.2.3-rc.1")).toEqual({
      core: [1, 2, 3],
      pre: "rc.1",
    });
    expect(parseVersion("nonsense")).toBeNull();
  });

  test("stable beats pre-release at same core", () => {
    const a = parseVersion("v1.2.3")!;
    const b = parseVersion("v1.2.3-rc.1")!;
    expect(compareVersions(a, b)).toBeGreaterThan(0);
    expect(compareVersions(b, a)).toBeLessThan(0);
  });

  test("pre-release at higher core beats older stable", () => {
    const a = parseVersion("v1.2.0")!;
    const b = parseVersion("v1.3.0-rc.1")!;
    expect(compareVersions(b, a)).toBeGreaterThan(0);
  });

  test("prerelease identifier ordering", () => {
    expect(
      compareVersions(
        parseVersion("v1.0.0-rc.2")!,
        parseVersion("v1.0.0-rc.10")!
      )
    ).toBeLessThan(0);
    expect(
      compareVersions(
        parseVersion("v1.0.0-alpha")!,
        parseVersion("v1.0.0-beta")!
      )
    ).toBeLessThan(0);
  });
});

describe("newestRelease", () => {
  test("offers newest tag including pre-releases", () => {
    const rels = releases("v0.1.0", "v0.2.0-rc.1", "v0.2.0");
    const best = newestRelease(rels, "0.1.0");
    expect(best?.tag).toBe("v0.2.0");
  });

  test("pre-release wins when it is the only newer tag", () => {
    const rels = releases("v0.1.1", "v0.2.0-rc.1");
    expect(newestRelease(rels, "0.1.1")?.tag).toBe("v0.2.0-rc.1");
  });

  test("no update when current is newest", () => {
    expect(newestRelease(releases("v0.1.0", "v0.2.0"), "0.2.0")).toBeNull();
  });
});

describe("artifactName", () => {
  test("maps platforms and archs", () => {
    expect(artifactName("darwin", "arm64")).toBe("openoffice-darwin-arm64");
    expect(artifactName("darwin", "x64")).toBe("openoffice-darwin-x64");
    expect(artifactName("linux", "x64")).toBe("openoffice-linux-x64");
    expect(artifactName("win32", "x64")).toBe("openoffice-windows-x64.exe");
  });
});

describe("fetchChecksums + verifySha256", () => {
  test("parses sha256sum format and verifies", async () => {
    const data = Buffer.from("binary-bytes");
    const hash = sha256(data);
    const fakeFetch = async () =>
      new Response(`${hash}  openoffice-darwin-arm64\ngarbage-line\n`);
    const map = await fetchChecksums("v1.0.0", fakeFetch);
    expect(map.get("openoffice-darwin-arm64")).toBe(hash);
    expect(verifySha256(data, hash)).toBe(true);
    expect(verifySha256(Buffer.from("tampered"), hash)).toBe(false);
  });
});

describe("swapBinary + cleanupPendingUpdate", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "ooo-update-"));
  });

  test("swaps binary keeping .old until next run", () => {
    const binPath = join(dir, "openoffice");
    writeFileSync(binPath, "old-binary");
    chmodSync(binPath, 0o755);

    const oldPath = swapBinary(Buffer.from("new-binary"), binPath);

    expect(readFileSync(binPath, "utf-8")).toBe("new-binary");
    expect(readFileSync(oldPath, "utf-8")).toBe("old-binary");
    expect((oldPath as unknown as string).endsWith(".old")).toBe(true);

    const markerDir = join(dir, "data");
    mkdirSync(markerDir);
    writeFileSync(
      join(markerDir, "update-pending.json"),
      JSON.stringify({ oldPath })
    );
    cleanupPendingUpdate(markerDir);
    expect(existsSync(oldPath)).toBe(false);
  });

  test("rolls back when the new binary cannot replace", () => {
    const binPath = join(dir, "openoffice");
    writeFileSync(binPath, "old-binary");
    mkdirSync(binPath.replace(/openoffice$/, "blocker"));
    // make the target a directory so the rename fails
    const blockedPath = join(dir, "openoffice.new");
    mkdirSync(blockedPath);
    expect(() => swapBinary(Buffer.from("new"), binPath)).toThrow();
    expect(readFileSync(binPath, "utf-8")).toBe("old-binary");
  });
});

describe("checkForUpdate", () => {
  test("uses the TTL cache on repeat calls", async () => {
    let calls = 0;
    const fakeFetch = async () => {
      calls++;
      return new Response(
        JSON.stringify([{ tag_name: "v9.9.9", prerelease: false }]),
        {
          headers: { "content-type": "application/json" },
        }
      );
    };
    const dir = mkdtempSync(join(tmpdir(), "ooo-check-"));
    const first = await checkForUpdate("0.1.0", dir, fakeFetch);
    expect(first.available).toBe(true);
    expect(first.version).toBe("9.9.9");
    expect(calls).toBe(1);
    const second = await checkForUpdate("0.1.0", dir, fakeFetch);
    expect(second.available).toBe(true);
    expect(calls).toBe(1);
  });
});

describe("performUpdate", () => {
  test("downloads, verifies, and swaps", async () => {
    const data = Buffer.from("fresh-binary");
    const hash = sha256(data);
    const routes: Record<string, Response> = {
      "https://api.github.com/repos/The-Resonance-Team/openoffice/releases?per_page=50":
        new Response(
          JSON.stringify([{ tag_name: "v2.0.0", prerelease: false }]),
          { headers: { "content-type": "application/json" } }
        ),
      "https://github.com/The-Resonance-Team/openoffice/releases/download/v2.0.0/openoffice-darwin-arm64":
        new Response(data),
      "https://github.com/The-Resonance-Team/openoffice/releases/download/v2.0.0/SHA256SUMS":
        new Response(`${hash}  openoffice-darwin-arm64\n`),
    };
    const fakeFetch = async (url: string | URL | Request) => {
      const u = String(url);
      const res = routes[u];
      if (!res) throw new Error(`unexpected fetch: ${u}`);
      return res;
    };
    const dir = mkdtempSync(join(tmpdir(), "ooo-perform-"));
    const binPath = join(dir, "openoffice");
    writeFileSync(binPath, "old");

    const result = await performUpdate("0.1.0", binPath, dir, fakeFetch);
    expect(result).toEqual({ status: "updated", version: "2.0.0" });
    expect(readFileSync(binPath, "utf-8")).toBe("fresh-binary");
  });

  test("refuses on checksum mismatch", async () => {
    const routes: Record<string, Response> = {
      "https://api.github.com/repos/The-Resonance-Team/openoffice/releases?per_page=50":
        new Response(
          JSON.stringify([{ tag_name: "v2.0.0", prerelease: false }]),
          { headers: { "content-type": "application/json" } }
        ),
      "https://github.com/The-Resonance-Team/openoffice/releases/download/v2.0.0/openoffice-darwin-arm64":
        new Response("tampered"),
      "https://github.com/The-Resonance-Team/openoffice/releases/download/v2.0.0/SHA256SUMS":
        new Response(`${"0".repeat(64)}  openoffice-darwin-arm64\n`),
    };
    const fakeFetch = async (url: string | URL | Request) =>
      routes[String(url)];
    const dir = mkdtempSync(join(tmpdir(), "ooo-perform-"));
    const binPath = join(dir, "openoffice");
    writeFileSync(binPath, "old");

    const result = await performUpdate("0.1.0", binPath, dir, fakeFetch);
    expect(result.status).toBe("error");
    expect(readFileSync(binPath, "utf-8")).toBe("old");
  });
});
