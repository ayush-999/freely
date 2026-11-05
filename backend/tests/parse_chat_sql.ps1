param(
    [Parameter(Mandatory = $true)]
    [string]$ScriptDomDll
)

# Offline syntax validation only. ScriptDom parses text; it cannot execute SQL.
# Tested with Microsoft's NuGet ScriptDom 180.140.0 net472 assembly and its
# TSql150Parser (SQL Server 2019 syntax). No SQL client or connection is used.
$ErrorActionPreference = 'Stop'
Add-Type -Path (Resolve-Path -LiteralPath $ScriptDomDll)
$workspace = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
$parser = New-Object Microsoft.SqlServer.TransactSql.ScriptDom.TSql150Parser($true)
$failed = $false
foreach ($relativePath in @(
    'backend\database\schema.sql',
    'backend\database\migrations\001_chat_up.sql',
    'backend\database\migrations\001_chat_down.sql'
)) {
    $reader = New-Object System.IO.StringReader([IO.File]::ReadAllText((Join-Path $workspace $relativePath)))
    $parseErrors = $null
    try { $null = $parser.Parse($reader, [ref]$parseErrors) }
    finally { $reader.Dispose() }
    if ($parseErrors.Count -gt 0) {
        $failed = $true
        foreach ($parseError in $parseErrors) {
            Write-Output "$relativePath $($parseError.Line):$($parseError.Column) $($parseError.Message)"
        }
    } else { Write-Output "$relativePath : syntax PASS (not executed)" }
}
if ($failed) { exit 1 }
