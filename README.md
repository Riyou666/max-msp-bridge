# Max/MSP Windows skill + MCP bridge

Let Codex inspect, create, connect and modify Max patches on Windows through Max's native APIs, with live readback. Supported bridge operations do not require Computer Use. You can continue working in Max; take turns when editing the same area and read the current state before changes.

An original Codex skill and local MCP bridge for Max on Windows. No Claude Code, macOS external, npm dependencies or API key required.

## Requirements

- Windows, Max 9 with `v8` and Node for Max.
- Node.js 20+ and PowerShell 7 (`node` and `pwsh` on PATH).
- Codex with MCP support.

Tested on Windows x64 with Max 9.2.0 and Node 24.14.1. Other versions have not been verified.

## Install

Clone this repository, then run from its root in PowerShell 7. Replace the example Max path with the directory containing your `Max.exe`:

```powershell
git clone https://github.com/Riyou666/max-msp-windows.git
cd max-msp-windows
./scripts/install.ps1 -MaxRoot 'E:\Applications\Max 9'
```

The installer copies the skill into `$HOME\.codex\skills\max-msp-windows`, backs up an existing Codex config, and adds `mcp_servers.max_windows`. Existing skill installations or registrations stop installation for manual comparison. It does not change Windows execution policy.

Generate a host patch with paths to the installed bridge:

```powershell
node "$HOME\.codex\skills\max-msp-windows\scripts\prepare-demo.mjs" "$PWD\max-control.maxpat"
```

Open that patch in Max, restart/reload Codex's MCP connection, then ask:

> Use max-msp-windows to check the current bridge. In the workspace subpatcher, create a number input → * 2 → number output, send 21, and read back the output to confirm 42.

The generator refuses to overwrite an existing file. Save your patch in Max to persist edits.

## Connecting your projects

**Install once; add the bridge to each patch you want to control live.** Reopening a saved patch that contains the bridge normally starts it automatically. You do not need to edit Codex's `config.toml` for every project or keep the demo open. Opening a patch without the bridge does not connect it, and switching the frontmost window does not change the control target.

### First installation with Codex

Send Codex the repository link and this prompt:

> Read the README at https://github.com/Riyou666/max-msp-windows, check Windows, Max 9, Node.js and PowerShell 7, then install the skill and MCP bridge. Preserve my existing Codex configuration. If an installation already exists, back it up and compare versions instead of installing a duplicate. Generate a separate test patch and verify that the bridge connects to that exact file. Explain any steps I need to take to reload MCP or open Max.

This prompt requests assistance; it does not guarantee unattended installation in every environment. Codex needs access to local files and command execution. You may still need to open Max or respond to permission prompts.

### New projects: start with a bridge-enabled patch

After installation, run this in PowerShell 7. Replace the output path with your project location. The directory must already exist and the destination file must not exist:

```powershell
node "$HOME\.codex\skills\max-msp-windows\scripts\prepare-demo.mjs" 'E:\MyMaxProjects\Assignment01.maxpat'
```

1. Stop any bridge running in another patch, then open the generated file in Max.
2. Double-click `p codex_workspace` and build your project inside it. This is a blank workspace; it does not generate assignment content.
3. Ask Codex to check the connection, confirm the host patch's full path and workspace, then begin assisting.
4. Save the project in Max. Next time, open this project directly; there is no need to generate the bridge again.

Alternatively, ask Codex:

> Use the installed max-msp-windows skill to create a blank bridge-enabled project at `<full-path-to-new-project.maxpat>`. Do not overwrite an existing file, generate creative content or enable audio. Verify that the bridge connects to this file and use the workspace subpatcher as the working area.

If you have already created a patch or started working in it, follow the existing-project instructions below. Do not overwrite it with the generator.

### Existing projects: connect once, save and reuse

Codex can help add the bridge. Provide the full file path, whether it is open in Max, and whether it has unsaved changes:

> Add only the max-msp-windows bridge to `<full-path-to-existing-project.maxpat>`. Its current open/save state is: `<describe state>`. Check for an existing bridge and make a backup first. Preserve existing objects, connections, layout and audio logic; do not complete the project for me. Never overwrite an open patch with unsaved edits from disk; prepare a separate copy if needed. Verify the connected file path and scope afterward.

**There is currently no one-click interface that automatically takes control of any open project.** Depending on the file's state, Codex can prepare a separate copy with the bridge or use the Max interface where supported. These setup actions cannot be performed automatically by an MCP bridge that is not yet connected to the target.

To connect a project manually:

1. Save and back up the target project. Check whether it already contains a bridge to avoid duplicates.
2. Generate a temporary demo host, open it and click `script stop`. Stop any other bridge using the same port too.
3. In Max's unlocked editing mode, copy **the five objects `script start`, `script stop`, `node.script …`, `v8 …` and `print max-bridge-status`, together with their interconnecting patchcords**, into an empty area at the target patch's top level. Preserve the script paths, autostart attributes and `__maxbridge_` object names. You do not need to copy the example `workspace` subpatcher or change your existing musical connections.
4. Check that the copied bridge has started. If it has not, click the target patch's `script start` in locked mode. Save the target project.
5. Ask Codex to inspect the root scope `[]` and confirm the file path first. Existing projects may not contain a subpatcher named `workspace`. Use each subpatcher's actual scripting name (varname) when selecting a scope.

The receiver controls the patch containing it and that patch's child scopes. Placing the bridge inside a separate subpatcher does not give it access to the entire enclosing project.

### Reopening, switching projects and checking connections

- **Reopen a connected project:** the bridge normally starts automatically. If it fails, check Max Console for script-path or port errors, then use `script start`.
- **Switch projects:** click `script stop` in the old project (or close the old bridge host), then open or start the target project. The default port is `8711`; only one bridge can run on a given port. Other Max windows without a bridge can remain open.
- **After installing or updating:** reload Codex MCP or restart Codex. Routine project switching usually does not require restarting Codex, but it does require reading a new session. Do not reuse the previous project's session or revision.
- **Verify the target:** ask Codex to call `max_status`, then use the returned session to call `max_inspect` at the root scope and check `filepath`. A working connection does not prove it points to the intended file.
- **Move to another computer or share a project:** generated patches contain absolute paths to the local bridge scripts. Each recipient must install the skill and reconnect the patch or update both script paths for their own computer.

### Debugging assistance without completing your assignment

You can set this working agreement at the start of a project:

> This is my assignment, and I will design and build it myself. Act only as a debugging assistant: confirm the bridge and file path first without making changes. Explain causes and offer hints when I encounter a problem. Modify only the specified part when I explicitly ask you to fix it; do not expand the work into a completed assignment.

You can continue using Max. While Codex modifies an area, pause your edits there. Codex should inspect the current state first and reassess any conflict. Save changes in Max afterward; the bridge has no save endpoint.

## Tools and boundaries

`max_status`, `max_inspect`, `max_create`, `max_connect`, `max_disconnect`, `max_move`, `max_setvalue`, `max_send`, `max_remove`, `max_reference`.

Version 0.2.0: mutations require named objects, a current session, and the latest inspection revision for the selected scope (`expectedRevision`). A changed inspected state rejects the write. Default scope is the host root; explicitly select your intended subpatcher. Removal is limited to actual object instances created in that receiver session; a same-name replacement is protected. There is no general eval, transactional undo, save endpoint, global console capture or audio analyzer. UI interaction may still be needed for actions outside these tools. Live audio/DSP correctness is a separate check.

The service binds to loopback, uses a per-start token and serializes requests. This is a local same-user bridge, not a sandbox for arbitrary Max objects or a remote service. No runtime credentials or generated machine-specific patches are bundled.

## Validation

```powershell
node --test
node scripts/maxpat.mjs validate '<your-patch.maxpat>'
```

The structural validator does not establish object availability or audio correctness. A local live acceptance run verified `21 * 2 = 42`, connection changes, scoped removal, stale-session rejection, and saved graph persistence after reopening. Audio output was not enabled or auditioned.

See [live control](references/live-control.md), [Windows setup](references/windows.md), and [research and provenance](references/research.md). Architecture was informed by MAX-MSP_CC_Framework, MaxMCP and tdmcp; this is an independent implementation, not their Windows distribution.

## Updating from 0.1.0

Stop the bridge before replacing files. Back up the installed skill, then replace its `SKILL.md`, `agents`, `bridge`, `references`, and `scripts` from this repository. Keep your existing Codex registration. Restart the Max bridge and reload Codex MCP; check `max_status.version` is `0.2.0`. Mixing a new receiver with an old MCP client will reject writes because revisions are now mandatory. The fresh-install script intentionally refuses existing installations.

0.2.0 adds runtime graph IDs, object-identity removal guards, single-use state preconditions, and timeout recovery through explicit readback. It does not add transactional undo, audio verification or fully concurrent collaborative editing. See [failure semantics](references/live-control.md#failure-semantics).
