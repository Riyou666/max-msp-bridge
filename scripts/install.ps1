param(
    [string]$SkillHome = (Join-Path $env:USERPROFILE '.codex\skills'),
    [string]$ConfigPath = (Join-Path $env:USERPROFILE '.codex\config.toml'),
    [Parameter(Mandatory = $true)][string]$MaxRoot
)
$ErrorActionPreference = 'Stop'
$source = Split-Path -Parent $PSScriptRoot
$destination = Join-Path $SkillHome 'max-msp-windows'
$node = (Get-Command node -ErrorAction Stop).Source
$powershell = (Get-Command pwsh -ErrorAction Stop).Source
if (-not (Test-Path -LiteralPath (Join-Path $MaxRoot 'Max.exe'))) { throw 'MaxRoot must contain Max.exe' }
$config = if (Test-Path -LiteralPath $ConfigPath) { [IO.File]::ReadAllText($ConfigPath) } else { '' }
if ($config -match '(?m)^\[mcp_servers\.max_windows(?:\]|\.)') { throw 'max_windows is already configured; inspect before replacing it.' }
if (Test-Path -LiteralPath $destination) { throw 'Skill destination already exists; compare before updating.' }
$server = Join-Path $destination 'bridge\mcp-server.mjs'
# JSON quoted path strings are compatible with TOML basic strings.
$nodeToml = ConvertTo-Json -InputObject $node -Compress
$serverToml = ConvertTo-Json -InputObject $server -Compress
$maxToml = ConvertTo-Json -InputObject $MaxRoot -Compress
$pwshToml = ConvertTo-Json -InputObject $powershell -Compress
New-Item -ItemType Directory -Path $destination -Force | Out-Null
foreach ($item in @('SKILL.md','agents','bridge','references','scripts')) {
    Copy-Item -LiteralPath (Join-Path $source $item) -Destination $destination -Recurse
}
New-Item -ItemType Directory -Path (Split-Path -Parent $ConfigPath) -Force | Out-Null
$block = @"

[mcp_servers.max_windows]
command = $nodeToml
args = [$serverToml]
startup_timeout_sec = 20
tool_timeout_sec = 30

[mcp_servers.max_windows.env]
MAX_ROOT = $maxToml
MAX_POWERSHELL = $pwshToml
"@
if (Test-Path -LiteralPath $ConfigPath) {
    $backup = $ConfigPath + '.max-windows-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.bak'
    Copy-Item -LiteralPath $ConfigPath -Destination $backup
}
[IO.File]::WriteAllText($ConfigPath, $config.TrimEnd() + "`r`n" + $block + "`r`n", [Text.UTF8Encoding]::new($false))
[ordered]@{skill=$destination;server='max_windows';config=$ConfigPath;backup=$backup} | ConvertTo-Json
