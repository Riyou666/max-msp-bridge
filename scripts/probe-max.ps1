param([string]$MaxRoot)
$ErrorActionPreference = 'Stop'
$candidates = @()
if ($MaxRoot) { $candidates += $MaxRoot }
elseif ($env:MAX_ROOT) { $candidates += $env:MAX_ROOT }
else {
    $candidates += @(Get-Process -Name Max -ErrorAction SilentlyContinue | ForEach-Object { if ($_.Path) { Split-Path -Parent $_.Path } })
    foreach ($key in @('HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*','HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*')) {
        $candidates += @(Get-ItemProperty -Path $key -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -match '^Max(\s|$)' -and $_.InstallLocation } | ForEach-Object { $_.InstallLocation })
    }
    foreach ($v in @('Max 9','Max 8')) { $candidates += Join-Path $env:ProgramFiles "Cycling '74\$v" }
}
$found = @()
foreach ($candidate in ($candidates | Select-Object -Unique)) {
    $exe = Join-Path $candidate 'Max.exe'
    if (-not (Test-Path -LiteralPath $exe -PathType Leaf)) { continue }
    $item = Get-Item -LiteralPath $exe
    $major = $item.VersionInfo.FileMajorPart
    $docs = [Environment]::GetFolderPath('MyDocuments')
    $found += [ordered]@{
        root = $item.DirectoryName; executable = $item.FullName
        version = $item.VersionInfo.ProductVersion
        resources = Join-Path $item.DirectoryName 'resources'
        examples = Join-Path $item.DirectoryName 'examples'
        userPackages = Join-Path $docs "Max $major\Packages"
    }
}
if ($found.Count -eq 0) { throw 'Max.exe not found. Supply -MaxRoot with the actual installation folder.' }
ConvertTo-Json -InputObject @($found) -Depth 5
