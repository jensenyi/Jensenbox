param(
    [Parameter(Mandatory = $true)]
    [string]$RunDate,

    [Parameter(Mandatory = $true)]
    [ValidateSet('CREATED','INPUT_READY','RESEARCHED','IDEATED','SELECTED','SCRIPTED','VISUALIZED','REVISION_REQUIRED','QA_PASSED','REJECTED','GEO_ASSETIZED','READY_TO_PUBLISH','PUBLISHED','REVIEWED','ARCHIVED')]
    [string]$Status
)

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$manifestPath = Join-Path $root "runs\$RunDate\run_manifest.json"

if (-not (Test-Path -LiteralPath $manifestPath)) {
    throw "Run manifest not found: $manifestPath"
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$normalOrder = @('CREATED','INPUT_READY','RESEARCHED','IDEATED','SELECTED','SCRIPTED','VISUALIZED','QA_PASSED','GEO_ASSETIZED','READY_TO_PUBLISH','PUBLISHED','REVIEWED','ARCHIVED')
$current = [string]$manifest.status

if ($Status -in @('REVISION_REQUIRED','REJECTED')) {
    if ($current -notin @('VISUALIZED','REVISION_REQUIRED','QA_PASSED')) {
        throw "Cannot move from $current to $Status."
    }
} else {
    $currentIndex = [array]::IndexOf($normalOrder, $current)
    $targetIndex = [array]::IndexOf($normalOrder, $Status)
    if ($current -eq 'REVISION_REQUIRED') {
        if ($Status -notin @('SCRIPTED','VISUALIZED','QA_PASSED','REJECTED')) {
            throw "Revision can only return to production/QA or be rejected."
        }
    } elseif ($targetIndex -ne ($currentIndex + 1) -and $Status -ne $current) {
        throw "Illegal status jump: $current -> $Status"
    }
}

$manifest.status = $Status
$manifest.updated_at = (Get-Date).ToString('yyyy-MM-ddTHH:mm:sszzz')
$manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $manifestPath -Encoding UTF8
Write-Host "Updated $($manifest.run_id): $current -> $Status"
