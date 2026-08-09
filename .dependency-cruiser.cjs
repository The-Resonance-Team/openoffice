// @ts-check
// Deep-module enforcement for dependency-cruiser, monorepo layout.
//
// Two layers:
//
// 1. Packages are the modules. A package's PUBLIC SURFACE is its entry point
//    (src/index.ts — plus a few small named entries where the shape demands).
//    Implementation lives in src/ subfolders and is private. Cross-package
//    imports go through the bare @openoffice/* specifiers, which dep-cruiser
//    never sees (node_modules, doNotFollow) — so the enforceable rule is:
//    relative imports must never reach into another package's subtree.
//
// 2. Inside packages/core, each domain (session, llm, config, ...) is a deep
//    module with the same entry-point discipline: root files are entry
//    points, subfolders are private, tests import through entry points.
//    Domain cross-imports use relative paths (packages are intra-importing),
//    so the domain rules must stay on the path level.

/** Where packages live. One immediate child dir per package (flat, no nesting). */
const PKGS = '(packages|apps)';

// --- derived patterns (no need to edit) -------------------------------------
/**
 * A package's private internals: anything nested in a package subfolder.
 * Package root files (src/index.ts etc.) are entry points and NOT matched.
 */
const PKG_INTERNALS = `^${PKGS}/[^/]+/`;
/** A core domain's private internals: anything nested inside a domain subfolder. */
const DOMAIN_INTERNALS = '^packages/core/src/[^/]+/[^/]+/';

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-cross-package-relative-imports',
      comment:
        'Relative imports must stay inside the same package. Cross-package imports use the bare @openoffice/* specifier (the package entry), which never matches a path rule.',
      severity: 'error',
      from: { path: `^${PKGS}/` },
      to: { path: `^${PKGS}/`, pathNot: '^$1/$2/' },
    },
    {
      name: 'entrypoint-boundary-from-app',
      comment:
        "App/root code (outside any package) may import a package's entry points only, never its internals.",
      severity: 'error',
      from: { pathNot: `^${PKGS}/` },
      to: { path: PKG_INTERNALS },
    },
    {
      name: 'domain-entrypoint-boundary-across-domains',
      comment:
        "A core domain's own files import each other freely, but may reach OTHER core domains only through their root entry files — never their subfolder internals.",
      severity: 'error',
      from: {
        path: '^packages/core/src/([^/]+)/',
        pathNot: '^packages/core/src/[^/]+/tests/',
      },
      to: {
        path: DOMAIN_INTERNALS,
        pathNot: '^packages/core/src/$1/',
      },
    },
    {
      name: 'tests-through-entrypoints',
      comment:
        "A core domain's tests exercise it through its entry points like everyone else: they may import any domain's entry points and their own tests/ fixtures, but never any domain's internals — not even their own.",
      severity: 'error',
      from: { path: '^packages/core/src/([^/]+)/tests/' },
      to: {
        path: DOMAIN_INTERNALS,
        pathNot: '^packages/core/src/$1/tests/',
      },
    },
    {
      name: 'no-circular-deps',
      comment: 'No dependency cycles within the monorepo.',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: '../../tsconfig.base.json' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'default'],
    },
  },
};
