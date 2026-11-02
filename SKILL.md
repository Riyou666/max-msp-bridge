---
name: max-msp-windows
description: Build, inspect, debug and edit Cycling '74 Max/MSP patches on Windows, including live patch control through the bundled MCP bridge, DSP, Gen and Max JavaScript. Use for .maxpat/.gendsp work, Max object references and Max patch automation.
---

# Max/MSP on Windows

Turn the user's musical or interaction intent into a readable, working Max patch. Use installed-version evidence and actual patch state. This skill supports file editing without a live connection and live editing through `max_windows` MCP when connected.

## Start with context

Identify the target file or bridge session, Max version, standalone versus Max for Live, and requested change. Preserve the user's layout and working signal paths. Clarify only missing choices that materially affect the result.

Run `scripts/probe-max.ps1 -MaxRoot '<installation directory>'` to discover executable/version, resource directories and redirected Documents location. Without an argument it checks running Max, MAX_ROOT, registry installs and standard locations. If none match, ask for the install directory; do not recursively scan all drives.

Consult [Windows and object lookup](references/windows.md) for paths, port metadata and script commands. Read [domain guidance](references/domains.md) only for relevant DSP, JS, Gen, M4L or external work.

## Choose the execution route

- **Connected live patch:** call `max_status`, then `max_inspect`. Use the returned session ID in every mutation. Read [live control](references/live-control.md). No tool availability means no live connection; never invent MCP calls.
- **Files:** read the complete target JSON and dependencies before editing. Keep unknown fields, object IDs, patchline order, varnames and presentation attributes. Write a new file or a backup before replacing an existing one. Never overwrite an unsaved open patch from disk.
- **Documentation:** query local `.maxref.xml`, `.maxhelp`, `.maxsnip` and examples for the installed version. Use Cycling '74 online reference if the local material is incomplete. A local XML placeholder such as TEXT_HERE is missing evidence, not a fact.

## Build and verify

1. State a compact signal/control plan: inputs, processing, controls, output and expected observable behavior.
2. Look up uncertain objects and messages, including port roles and creation-argument-dependent port counts. A cached `numinlets` field is not proof that an object exists or compiles. Package documentation does not prove its Windows binary is installed.
3. Make a small coherent change. Use deterministic unique names for generated objects. Put controls above processing and outputs below; avoid restyling existing objects unless asked.
4. Use explicit trigger order where behavior depends on message ordering; `trigger` fires right-to-left. Initialize cold inlets before a hot-inlet calculation. Do not impose trigger on every unrelated fan-out.
5. For sound-producing patches, initialize gain at zero, provide a ramped gain control and visible stop/mute. Do not automatically enable DSP or select hardware merely by opening a generated patch. Check feedback topology and gain before auditioning.
6. Run `node scripts/maxpat.mjs validate '<patch.maxpat>'`. It checks JSON graph structure recursively, **not** object existence, DSP stability or sound. Fix errors with narrow edits; validation must not silently delete cords.
7. Read live objects/connections/values back after mutations. Verify input-to-output behavior in Max, console/compiler errors where observable, and save/reopen persistence where required. Report each level separately: static pass, live API pass, visual inspection, audio test. Never equate one with another.

## Tool and agent design

Keep knowledge, orchestration and execution separate. Prefer structured operations with explicit scope to unrestricted code execution. Read state before and after a change; if a mutation times out, inspect before retrying. Use local versioned references on demand instead of loading a huge copied manual into context.

The bundled MCP supplies a scoped bridge and primitive operations; it is not a full Max console/audio analyzer. See [research and provenance](references/research.md) for the evaluated upstream projects, commit pins, design tradeoffs and unimplemented capabilities. No Claude Code installation, macOS binary or external API key is required.
