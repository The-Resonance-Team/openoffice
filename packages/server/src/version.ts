import pkg from '../package.json';

// Injected by the release build: bun build --compile --define:OOO_VERSION="X.Y.Z".
// Falls back to package.json in dev.
declare const OOO_VERSION: string | undefined;

export const VERSION: string =
  (typeof OOO_VERSION === 'string' ? OOO_VERSION : undefined) ?? pkg.version;
