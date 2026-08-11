// @openoffice/server — the daemon process: HTTP wiring (createApp), client
// implementation, spawn/lifecycle, self-update, version, data dir.
// The engine lives in @openoffice/core; the wire contract in @openoffice/protocol.

export { AskChannel, createApp } from './server';
export type { ServerDeps, McpApi } from './server';
export { loadAuthConfig, authRequired, createAuthMiddleware, authHeaders } from './server/auth';
export type { ServerAuthConfig } from './server/auth';
export { loadCorsOrigins, createCorsMiddleware } from './server/cors';
export { OpenOfficeClient, connectClient } from './server/client';
export { startDaemon, readDaemonInfo, isAlive, spawnDaemon } from './server/daemon';
export {
  parseVersion,
  compareVersions,
  newestRelease,
  listReleases,
  artifactName,
  downloadAsset,
  fetchChecksums,
  sha256,
  verifySha256,
  swapBinary,
  cleanupPendingUpdate,
  readCheckCache,
  writeCheckCache,
  checkForUpdate,
  performUpdate,
  REPO,
} from './update';
export type { FetchFn, ReleaseInfo, UpdateStatus, ParsedVersion } from './update';
export { VERSION } from './version';
export { getDataDir } from './data-dir';
export { readPdf, PdfError } from './read-pdf';
export type { PdfErrorCode } from './read-pdf';
