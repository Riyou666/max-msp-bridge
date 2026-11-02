# Live Max control

Architecture: Codex stdio MCP → local Node client → authenticated loopback HTTP → Max `node.script` → Max `v8` Patcher API → result readback. This is an original minimal implementation, not a Windows build of Signalcompose MaxMCP or a renamed tdmcp.

Requirements: Windows, Max 9 with v8 and Node for Max, Node 20+ for the MCP process. No npm dependencies or Python environment. `max_reference` additionally uses PowerShell and `MAX_ROOT`. The installer selects an available PowerShell 7 executable with `MAX_POWERSHELL`; the original machine's legacy powershell.exe blocks unsigned script files. No system execution-policy change is made.

Generate the editable host patch outside the installed skill if possible:

```powershell
node '<skill>\scripts\prepare-demo.mjs' '<project>\max-control.maxpat'
```

Open this generated file in Max. Its node.script autostarts; the START/STOP messages also control it. The root contains the bridge wiring and a `workspace` subpatcher. The initial root is a wrapper; inspect and edit `scope: ["workspace"]` for creative work. The node and v8 paths are absolute, generated for the installation. Move/copy the complete bridge wiring into another patch only when that patch is the requested target; then inspect its root before mutation. One active bridge on port 8711 is supported. Opening a second host should fail with a port-in-use error, never silently switch targets.

MCP registration shape (substitute actual absolute paths):

```toml
[mcp_servers.max_windows]
command = 'C:\Program Files\nodejs\node.exe'
args = ['<skill>\bridge\mcp-server.mjs']
startup_timeout_sec = 20
tool_timeout_sec = 30

[mcp_servers.max_windows.env]
MAX_ROOT = 'E:\Applications\Max 9'
MAX_POWERSHELL = '<actual path to pwsh.exe>'
```

Restart/reload the Codex MCP connection after registration. A running HTTP bridge alone does not mean tools have been loaded into the current chat. Preserve unrelated config. No API key is needed; the bridge generates a per-start local token in the user's temporary directory and never puts it in the skill/config/repository.

## Working loop

1. `max_status {}` returns the current session.
2. `max_inspect {session, scope:["workspace"]}` returns actual objects, values, rectangles, patchcords with unique object IDs, and a `revision`. Every mutation requires that value as `expectedRevision`. Inspect before each mutation; a failed attempt consumes its revision too. Reassess conflicts instead of automatically replaying.
3. For each new object use `max_create {session, scope, expectedRevision, name, object, args, x, y}`. `object` is just the class (e.g. `cycle~`), args is an array (e.g. `[220]`). Inspect before reusing a name.
4. Use `max_connect` / `max_disconnect` with source/destination varnames and zero-based ports. The receiver checks actual patchcord readback. A failure does not prove no side effect; inspect.
5. `max_move`, `max_setvalue`, and limited `max_send` operate on named objects. `setvalue` may output according to the object's behavior. `max_send` can trigger sound or connected actions; consider downstream effects. Do not use it to enable DSP unless requested.
6. `max_remove` only removes the actual object instances created in the current receiver lifetime. A same-name replacement does not inherit ownership. It also removes attached cords. For existing objects use a backed-up file edit or extend the bridge deliberately; do not bypass this boundary with arbitrary code.
7. Verify the affected graph and behavioral readout. Save in Max, then validate/read the saved file when persistence matters. The bridge has no save, general eval, global console capture or audio recording endpoint.

Bridge scope is a sequence of existing subpatcher **varnames**. An empty array selects the wrapper root, not whichever Max window is frontmost. No selection of arbitrary other top-level patches is implied. Unnamed objects are readable, but structured mutations require varnames. Bridge internals have reserved `__maxbridge_` names and cannot be targeted by these tools.

## Failure semantics

Requests are serialized. Stale sessions are rejected. Each HTTP request has a deadline checked inside Max before execution. A timeout blocks further writes until the original result arrives or a subsequent `max_inspect` succeeds after its deadline. Inspection acts as a recovery barrier; previously unknown outcomes remain explicitly unknown in the bounded in-memory history, never silently become success. `max_status` exposes pending request IDs and up to 32 recent outcomes. MCP errors include the request ID. Do not retry a write automatically.

Completed HTTP IDs are cached (up to 256); changing arguments under a cached ID is rejected. New MCP calls use new IDs. Restarting loses the history and invalidates sessions. There is no disk journal or automatic rollback of a partially completed multi-call operation.

Revisions compare the inspected scope's object identities, names, text, rectangles, values, port counts and connections immediately before mutation. Selection is excluded. Revisions are single-use, limited to the last 64 inspections, and invalidated by receiver reload. Continuously changing controls may prevent writes: pause those changes or work in a quieter scope. This is conservative conflict detection, not an atomic transaction across the UI and all Max scheduling threads. Unobserved object attributes, nested contents outside the inspected scope, DSP state and external side effects are not covered.

Object IDs are runtime-only and do not modify varnames or persist across reload. Unnamed graph endpoints now have IDs, but mutations still use existing simple varnames. Strict object-reference identity was verified with Max 9.2; other Max versions require live validation.

Only loopback is bound, requests require a random token and browser Origin requests are rejected. This is a local same-user tool, not a remote multi-user service. Object creation and messages can still have Max-side effects; the absence of an eval endpoint is not a sandbox for arbitrary Max objects.

## Evidence levels

`max_status`: transport available. `max_inspect`: Max execution path available. Connection readback: real wiring exists. Numeric propagation: observed control behavior. Visual screenshot: visible patch layout. Audio recording/listening: separate sound evidence. Never claim the latter from the former.
