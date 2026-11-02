# Project setup and updates

[Back to README](../README.md)

## Connecting your projects

**Install once; add the bridge to each patch you want to control live.** Reopening a saved patch that contains the bridge normally starts it automatically. You do not need to edit Codex's `config.toml` for every project or keep the demo open. Opening a patch without the bridge does not connect it, and switching the frontmost window does not change the control target.

### First installation with Codex

Send Codex the repository link and this prompt:

> Read the README at https://github.com/Riyou666/max-msp-bridge, check Windows, Max 9, Node.js and PowerShell 7, then install the skill and MCP bridge. Preserve my existing Codex configuration. If an installation already exists, back it up and compare versions instead of installing a duplicate. Generate a separate test patch and verify that the bridge connects to that exact file. Explain any steps I need to take to reload MCP or open Max.

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

**There is currently no one-click interface that automatically takes control of any open project.** Depending on the file's state, Codex can prepare a separate copy with the bridge without overwriting an open unsaved patch. These setup actions cannot be performed automatically by an MCP bridge that is not yet connected to the target.

To connect a project manually:

1. Save and back up the target project. Check whether it already contains a bridge to avoid duplicates.
2. Generate a temporary demo host, open it and click `script stop`. Stop any other bridge using the same port too.
3. In Max's unlocked editing mode, copy **the five objects `script start`, `script stop`, `node.script …`, `v8 …` and `print max-bridge-status`, together with their interconnecting patchcords**, into an empty area at the target patch's top level. Preserve the script paths, autostart attributes and `__maxbridge_` object names. You do not need to copy the example `workspace` subpatcher or change your existing musical connections.
4. Check that the copied bridge has started. If it has not, click the target patch's `script start` in locked mode. Save the target project.
5. Ask Codex to inspect the root scope `[]` and confirm the file path first. Existing projects may not contain a subpatcher named `workspace`. Use each subpatcher's runtime ID or unique scripting name (varname) when selecting a scope.

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

## Updating an existing live installation

From a separate, updated repository checkout, run:

```powershell
node scripts/upgrade-live.mjs --apply --patch 'E:\MyMaxProjects\Assignment01.maxpat'
```

Use the exact path of the currently connected host. The updater checks that path, backs up the installed skill under `$HOME\.codex\backups\max-msp-windows`, replaces runtime files, waits for the receiver to reload, and restarts only the bridge through Max APIs. It does not close the project, edit its file, change Codex configuration, or use Computer Use. If the receiver does not reload or the bridge is disconnected, it reports the failure without automating the UI. The updater must run from a checkout separate from the installed skill.

Reload Codex MCP after updating to discover the new tools. Verify `max_status.version` and `max_inspect.result.receiverVersion` are both `0.3.0`. Runtime object IDs and revision tokens from before the upgrade are invalid. Keep the backup until verification is complete.

For a stopped installation, back it up and replace `SKILL.md`, `agents`, `bridge`, `references`, and `scripts` manually, then start the bridge. The fresh-install script intentionally refuses existing installations.

See [live control and failure semantics](live-control.md) for exact tool arguments and limitations.
