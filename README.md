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

## 每次开始项目，怎样接桥？

**安装只需做一次；每个要实时操作的 patch 都需要接入桥接。** 已接好并保存的 patch 再次打开时通常会自动启动桥接。不需要每次修改 Codex 的 `config.toml`，也不必一直打开演示文件。仅打开任意一个未接桥的 Max 项目，不会自动连接；切换最前面的窗口也不会切换控制目标。

### 第一次安装：可以直接交给 Codex

把仓库链接和下面这段话一起发给 Codex：

> 请读取 https://github.com/Riyou666/max-msp-windows 的 README，检查 Windows、Max 9、Node.js 和 PowerShell 7，然后帮我安装 skill 与 MCP 桥接。请保留已有 Codex 配置；若已有同名安装，先备份并比较版本，不要重复安装。生成独立测试 patch，并验证连接到的是该文件。若需要我重新加载 MCP 或打开 Max，请说明具体步骤。

这是安装请求模板，不是保证所有环境都能无人值守安装。Codex 需要能访问本机文件、运行命令；某些环境仍需要你打开 Max 或完成权限提示。

### 新项目：从带桥接的空白起点开始

安装完成后，在 PowerShell 7 运行下面的命令。把输出路径改成你自己的项目目录；目录必须已存在，目标文件必须尚不存在：

```powershell
node "$HOME\.codex\skills\max-msp-windows\scripts\prepare-demo.mjs" 'E:\MyMaxProjects\Assignment01.maxpat'
```

1. 先停止其他 patch 中的桥接，再在 Max 打开生成的文件。
2. 双击 `p codex_workspace`，在其中自己制作项目。它是空白工作区，不会自动生成作业内容。
3. 让 Codex 检查连接，确认主 patch 的完整路径和工作区，再开始协助。
4. 在 Max 中保存项目。以后直接打开这个项目即可，不必重复生成桥接文件。

也可以直接告诉 Codex：

> 请使用已安装的 max-msp-windows，在 `<新项目的完整路径.maxpat>` 创建带桥接的空白项目。不要覆盖已有文件，不要生成作品内容或开启音频。检查桥接连接到该文件，并使用 workspace 子补丁作为工作区。

如果你已经在 Max 中创建了空白项目或写了部分内容，请按下面的“已有项目”流程接入，不要用生成器覆盖它。

### 已有项目：接入一次，保存后重复使用

可以让 Codex 帮你接入。提供文件的完整路径，以及它是否正在 Max 中打开、是否有未保存修改：

> 请只给 `<已有项目的完整路径.maxpat>` 接入 max-msp-windows 桥接。我当前的打开／保存状态是：`<填写状态>`。先检查已有桥接并备份，保留原对象、连线、布局和声音逻辑，不要代做项目。不要从磁盘覆盖打开且未保存的 patch；必要时先生成独立副本。接入后验证实际连接的文件路径与作用域。

**当前没有“自动接管任意打开项目”的一键接口。** Codex 可以根据文件状态准备接桥副本，或在环境支持时通过 Max 界面接入；这些安装操作不由尚未连接的 MCP 桥接自动完成。

手动接入时：

1. 保存并备份目标项目，检查它是否已经带桥接，避免重复添加。
2. 生成一个临时桥接演示文件，打开后点击 `script stop`。同一端口上的其他桥接也应停止。
3. 在 Max 解锁编辑模式下，把演示文件中的 **`script start`、`script stop`、`node.script …`、`v8 …` 和 `print max-bridge-status` 五个对象及其相互连线**一起复制到目标 patch 的顶层空白区域。保留脚本路径、自动启动属性和 `__maxbridge_` 对象名；不需要复制示例 `workspace` 子补丁或改动原有音乐连线。
4. 确认复制后桥接已启动；若没有，在锁定模式下点击目标 patch 的 `script start`。保存目标项目。
5. 让 Codex 先读取根作用域 `[]` 并核对文件路径。已有项目未必有名为 `workspace` 的子补丁；进入子补丁时使用其实际 scripting name（varname），不要照搬演示的作用域。

如果希望把桥接整理进子补丁，注意当前接收器只控制它所在的 patch 及其下级作用域；不能把它随意藏进一个子补丁后仍期待它控制外层整个项目。

### 以后打开、切换项目与检查连接

- **打开已接桥项目：**桥接通常自动启动；失败时检查 Max Console 中的脚本路径或端口错误，再使用 `script start`。
- **切换项目：**先在旧项目点击 `script stop`（或关闭旧桥接宿主），再打开／启动目标项目。默认端口为 `8711`，同一端口只允许一个运行中的桥接。其他不带桥接的 Max 窗口可以继续打开。
- **安装或更新后：**重新加载 Codex MCP，或重启 Codex。日常换项目通常不必重启 Codex，但必须重新读取 session；不要沿用上个项目的 session 或 revision。
- **确认接对了：**让 Codex 调用 `max_status`，然后用返回的 session 调用根作用域的 `max_inspect`，核对 `filepath`。连接成功不代表已经连接到你想要的文件。
- **换电脑／分享项目：**生成的 patch 包含本机桥接脚本的绝对路径。朋友需要在自己的电脑安装 skill，并重新接桥或更新这两个脚本路径，不能直接沿用你的路径。

### 只需要调试帮助，不代做作业

可以在项目开始时告诉 Codex：

> 这是我的作业，我自己设计和制作。你只担任调试助手：先确认桥接与文件路径，不修改内容。遇到问题先解释原因、给提示；只有我明确说“帮我改”时，才修改指定部分，不扩展成完整作业。

你可以继续在 Max 中操作；轮到 Codex 修改时，暂时不要编辑同一区域。它会先读取当前状态，遇到冲突应重新分析。修改完成后在 Max 保存；桥接本身没有保存接口。

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
