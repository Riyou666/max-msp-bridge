param(
    [Parameter(Mandatory=$true)][string]$MaxRoot,
    [Parameter(Mandatory=$true)][string]$Name,
    [string]$Domain,
    [string]$PackageRoot
)
$ErrorActionPreference = 'Stop'
# Exact filename match, not a wildcard interpolation of names such as *~.
$roots = @((Join-Path $MaxRoot 'resources\docs\refpages'), (Join-Path $MaxRoot 'resources\packages'))
if ($PackageRoot) { $roots += $PackageRoot }
$files = @($roots | Where-Object { Test-Path -LiteralPath $_ } | ForEach-Object {
    Get-ChildItem -LiteralPath $_ -Recurse -File -Filter '*.maxref.xml'
} | Where-Object { $_.Name -eq ($Name + '.maxref.xml') -and (-not $Domain -or $_.DirectoryName -match ([regex]::Escape($Domain) + '-ref$')) })
if (-not $files) { throw "No exact reference for '$Name'. Resolve aliases or search installed help/examples; do not invent a schema." }
function TextOf($node) { if ($null -eq $node) { return $null }; return (($node.InnerText -replace '\s+', ' ').Trim()) }
function Entries($nodes) {
    @($nodes | ForEach-Object {
        $entry = [ordered]@{}
        foreach ($attribute in $_.Attributes) { $entry[$attribute.Name] = $attribute.Value }
        $entry['text'] = TextOf $_
        $entry
    })
}
$result = @($files | ForEach-Object {
    # Disable DTD/entity resolution even for reference files supplied by packages.
    $settings = [System.Xml.XmlReaderSettings]::new()
    $settings.DtdProcessing = [System.Xml.DtdProcessing]::Prohibit
    $settings.XmlResolver = $null
    $reader = [System.Xml.XmlReader]::Create($_.FullName, $settings)
    $doc = [System.Xml.XmlDocument]::new()
    try { $doc.Load($reader) } finally { $reader.Dispose() }
    $root = $doc.DocumentElement
    [ordered]@{
        source = $_.FullName; sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash
        name = $root.GetAttribute('name'); module = $root.GetAttribute('module')
        description = TextOf ($root.SelectSingleNode('description'))
        inlets = @(Entries ($root.SelectNodes('inletlist/inlet')))
        outlets = @(Entries ($root.SelectNodes('outletlist/outlet')))
        arguments = @(Entries ($root.SelectNodes('objarglist/objarg')))
        methods = @(Entries ($root.SelectNodes('methodlist/method')))
        attributes = @(Entries ($root.SelectNodes('attributelist/attribute')))
        caveat = 'Documentation evidence only. Variable I/O, aliases, inherited attributes and placeholders require help-patch/live checks.'
    }
})
ConvertTo-Json -InputObject $result -Depth 12
