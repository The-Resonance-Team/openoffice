# 0015 — CodeMode's sandbox must be real isolation, not node:vm

Porting opencode's CodeMode idea (the model writes one program to sequence multiple tool calls, instead of one round-trip per call) — not its implementation, which is Effect-native and out of scope per `map.md`/ADR 0011.

The feature's entire value proposition is confinement: a program that can only call the tools it's given, with no ambient filesystem, process, network, or module access. Node's built-in `vm` module does not provide that — it is a documented, escapable non-sandbox (prototype-chain and constructor escapes are known techniques, not theoretical edge cases). Building the `code` tool (issue TBD) on `vm` would ship something that claims confinement it doesn't have, on the one feature whose entire point is confinement — worse than not building it, because it would look safe.

The `code` tool must use a real isolated JS engine (`quickjs-emscripten`, `isolated-vm`, or equivalent evaluated at implementation time — this ADR sets the constraint, not the specific library, since engine maturity and platform support can shift). This is the only decision recorded here: everything downstream (which tools are exposed inside the sandbox, timeout/output limits) follows the existing Tool/Permission model from ADR 0006 and needs no new architecture.

## Considered options

- **`node:vm`**: rejected outright — doesn't provide the isolation the feature requires. Not a cost/benefit tradeoff; it fails the requirement.
- **No sandbox, just run the program in-process with the tool functions in scope**: rejected for the same reason, more directly — this is `node:vm`'s failure mode without even the vm module's partial pretense of a boundary.
