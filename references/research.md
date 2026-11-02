# Research and design evidence

Investigated 2026-11-02. Repository default branches can change; these are the inspected commit snapshots, not claims about future releases. Counts in upstream READMEs are author-reported and were not independently audited.

| Project | Evidence inspected | Decision |
|---|---|---|
| [Taylor Brook MAX-MSP_CC_Framework](https://github.com/taylorbrook/MAX-MSP_CC_Framework/tree/ef656373a9db0e81f9bb7390af1fa9633384f618) | README, patch-agent skill, validation source, LICENSE; MIT; README explicitly requires macOS and Claude Code | Adopt installed-object evidence, scoped graph checking, preservation of edits, separate static/live checks. Do not transplant its complete orchestrator, automatic git commits, Mach-O validation or universal stylistic rules. |
| [Signalcompose MaxMCP](https://github.com/signalcompose/MaxMCP/tree/11029d498ea697d5f08ad1ac380499f3189a1b33) | README, CMakeLists, max-resources skill, LICENSE | Native Max execution and live readback are valuable. Documented build/distribution targets Apple Silicon/macOS; Windows support is listed as future work. Some CMake branches are platform-conditional; this alone does not establish a functioning Windows release. Its license is custom; no upstream source or skills were copied into this implementation. |
| [Pantani tdmcp](https://github.com/Pantani/tdmcp/tree/c25e5bd2d80ae8f125892b07bf91420fc5a95b89) | README, architecture document | Reuse the architectural idea: MCP client → Node service → in-application bridge, with create/readback/preview. TD's Python/operator layer and knowledge base cannot directly control Max. The local implementation replaces those with Max's Node and Patcher APIs. No TD installation changes were made. |
| [tpd911/maxmsp-mcp](https://github.com/tpd911/maxmsp-mcp) | README only | Useful Node + in-patcher JS bridge precedent. Not installed or audited. README has Windows setup text but also Unix environment activation and client-specific commands; these are not proof of tested Windows/Codex support. |

## Methods applied

These are engineering choices inferred from the sources and verified where possible, not a claim that named experts unanimously use a particular approach.

1. **Version-matched data:** inspect the actual Max.exe version, local XML references, help patches and examples. Return source paths and SHA-256 with lookups. Missing or ambiguous documentation remains uncertain; avoid an unversioned copied object database.
2. **Platform boundary:** separate host instructions, filesystem paths, executable transport and Max runtime. Use PowerShell for Windows discovery; Node for portable MCP; Max v8 for Patcher mutations. No `.mxo`/Homebrew dependency.
3. **Progressive context:** one concise skill entrypoint plus conditional domain and bridge references. Skill guidance does not pretend to be an executable agent framework.
4. **Observable acceptance tests:** compare before/after graphs and a control-value propagation result. Exercise disconnect, create/remove, scope, stale-session rejection and preservation of pre-existing content. Keep a real stdio integration test, not just mocks that repeat implementation details.
5. **Bounded mutation:** structured named operations, explicit session/scope, serialized requests, expiration inside Max and no blind retry on timeout. Local transport bound to loopback; no generic eval or external API key.
6. **Separate correctness layers:** graph syntax, Max object loading, control behavior, layout and DSP/audio each need different evidence. This release verifies live control; it does not claim a complete DSP validation engine.

## Primary API references

- [Max Patcher API](https://docs.cycling74.com/apiref/js/patcher/): object creation, traversal and wiring.
- [Maxobj API](https://docs.cycling74.com/apiref/js/maxobj/) and [MaxobjConnection](https://docs.cycling74.com/apiref/js/maxobjconnection/): object values, geometry and actual patchcord readback.
- [Node for Max](https://docs.cycling74.com/apiref/nodeformax/): transport-to-patch messaging.
- [MCP stdio transport](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports): newline-delimited JSON-RPC; no diagnostic text on stdout.
- [Codex MCP configuration](https://developers.openai.com/codex/mcp): stdio command/args and per-server environment.
- [Skill structure](https://developers.openai.com/codex/skills/): entrypoint plus supporting resources.

## Local acceptance record

Verified Max 9.2.0.e9c80e453de on Windows x64, Node 24.14.1. `reference.ps1` successfully extracted `cycle~` from the installed reference. The static demo passed graph validation. Five initial automated tests passed. The stdio end-to-end smoke test made 19 tool calls and observed `21 * 2 = 42` through actual Max objects, two live cords, output unchanged after disconnect, successful reconnection, temporary-node removal, stale-session rejection, and refusal to remove an unowned pre-existing label. Per-machine traces are not distributed because they contain local paths and session identifiers.

Two deployment issues were found by live testing: use a `.js` filename recognized by Max's file resolver and persist node.script's autostart attributes; use a shared user temporary directory because the restricted command runner has a different TEMP. The normal sandbox blocks localhost network access, so integration tests ran with the authorized local-process permission. These are environment observations, not assumed universal Max defects.

Limitations: one active host per port; scope traversal only inside that host; no global frontmost-patch routing; unnamed objects cannot be mutated through the current primitives; no transactional undo, global console tool, audio analysis/recording, complete DSP model, or native external build system. No audio output was enabled or auditioned in the control test. Use Max save/reopen plus file validation for persistence; a successful API response is not a saved project.

Final installation verification: the official skill validator passed for both staged and installed copies. Codex TOML parsed successfully and preserved its existing MCP registrations. The final `Max-Codex-Control.maxpat` uses the installed bridge scripts. After closing the test host and reopening this saved patch, a new bridge session retained all three generated objects and both cords; resending 21 returned 42. Installed `max_reference` also returned cycle~ with two documented inlets and one outlet using the configured PowerShell 7 runtime. Numeric UI state persistence is not claimed; the input was explicitly resent after reopening. Loading the newly registered tool names into the Codex chat still requires a client MCP reload/restart.

## 0.2.0 repair validation

The revised bridge passed 15 automated tests, including object replacement, graph identity, state preconditions and timeout recovery with simulated transport timing. A separate Max 9.2 host on an isolated port passed 37 MCP tool calls and real arithmetic propagation. Additional live tests used an in-patch fixture to remove and replace a bridge-created object with the same name: deletion was rejected. Two unnamed objects retained distinct IDs with correctly identified cord endpoints, and a stale revision was rejected after another edit. Audio and real scheduler-stall recovery were not tested.

To reproduce live checks, generate a fresh isolated host with `prepare-demo.mjs`, open it in Max, verify its port, then run `node bridge/live-smoke.mjs --demo --patch <absolute-test-patch>` followed by `node bridge/live-regression.mjs --demo --patch <absolute-test-patch>`. These intentionally mutate only the exact path checked before execution. The second check leaves a protected replacement and unnamed objects in the disposable test patch.

## 0.3.0 background debugging validation

Twenty-three automated tests cover unnamed ID selection, scope boundaries, punctuated/ambiguous varnames, stale IDs, native-wrapper reuse simulation, ownership markers, bounded Console tail reads, and audio-setting compare-before-write behavior, in addition to earlier regressions.

On Max 9.2, the 37-call smoke test and replacement regression passed on a disposable host. `live-background.mjs` then connected and disconnected unnamed objects by ID, observed control propagation without renaming, captured a unique printed marker from the global Console, read native Preferences/audio status, and verified same-value audio writes are no-ops and stale values are rejected. The restart tool changed the bridge session without closing the host. No GUI automation was used.

The installed bridge was hot-upgraded while its actual project remained open. Graph comparison before/after reported unchanged objects and patchcords. Read-only Console, Preferences and audio queries passed on that host. Actual audio-setting changes were unit-tested with mocks; the live test deliberately left global audio settings unchanged. This is not an audio-quality test or proof of support for all Preferences panels.

An additional Max-specific limitation was found during testing: native wrappers may be reused after delete/recreate. Reference equality alone is insufficient for creation ownership. New bridge-created objects now receive an annotation ownership marker, which is checked along with their runtime reference. Existing user objects are neither annotated nor renamed.
