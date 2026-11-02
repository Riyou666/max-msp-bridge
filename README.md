# Max/MSP Windows skill + MCP bridge

让 Codex 在 Windows 上读取、创建、连线和修改 Max patch，通过 Max 原生 API 操作并回读结果。桥接支持的操作不需要 Computer Use；你仍然可以在 Max 界面工作。双方编辑同一区域时应交替操作并重新读取状态。

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

> 使用 max-msp-windows，检查当前桥接。在 workspace 子补丁中创建数字输入 → * 2 → 数字输出，输入 21，并回读确认输出 42。

The generator refuses to overwrite an existing file. Save your patch in Max to persist edits.

## Existing projects

Back up the project, then copy the complete bridge wiring from the generated host into the intended patch. Stop the old host before starting another: only one active host per port is supported. Inspect the session and scope before edits. The bridge controls its host patch and named subpatchers; it does not automatically follow the frontmost window.

## Tools and boundaries

`max_status`, `max_inspect`, `max_create`, `max_connect`, `max_disconnect`, `max_move`, `max_setvalue`, `max_send`, `max_remove`, `max_reference`.

Version 0.2.0: mutations require named objects, a current session, and the latest inspection revision for the selected scope (`expectedRevision`). A changed inspected state rejects the write. Default scope is the host root; explicitly select your intended subpatcher. Removal is limited to actual object instances created in that receiver session; a same-name replacement is protected. There is no general eval, transactional undo, save endpoint, global console capture or audio analyzer. UI interaction may still be needed for actions outside these tools. Live audio/DSP correctness is a separate check.

The service binds to loopback, uses a per-start token and serializes requests. This is a local same-user bridge, not a sandbox for arbitrary Max objects or a remote service. No runtime credentials or generated machine-specific patches are bundled.

## Validation

```powershell
node --test bridge/*.test.mjs
node scripts/maxpat.mjs validate '<your-patch.maxpat>'
```

The structural validator does not establish object availability or audio correctness. A local live acceptance run verified `21 * 2 = 42`, connection changes, scoped removal, stale-session rejection, and saved graph persistence after reopening. Audio output was not enabled or auditioned.

See [live control](references/live-control.md), [Windows setup](references/windows.md), and [research and provenance](references/research.md). Architecture was informed by MAX-MSP_CC_Framework, MaxMCP and tdmcp; this is an independent implementation, not their Windows distribution.

## Updating from 0.1.0

Stop the bridge before replacing files. Back up the installed skill, then replace its `SKILL.md`, `agents`, `bridge`, `references`, and `scripts` from this repository. Keep your existing Codex registration. Restart the Max bridge and reload Codex MCP; check `max_status.version` is `0.2.0`. Mixing a new receiver with an old MCP client will reject writes because revisions are now mandatory. The fresh-install script intentionally refuses existing installations.

0.2.0 adds runtime graph IDs, object-identity removal guards, single-use state preconditions, and timeout recovery through explicit readback. It does not add transactional undo, audio verification or fully concurrent collaborative editing. See [failure semantics](references/live-control.md#failure-semantics).
