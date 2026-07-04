param(
    [Parameter(Mandatory = $true)]
    [string]$RunDate
)

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$runDir = Join-Path $root "runs\$RunDate"

if (-not (Test-Path -LiteralPath $runDir)) {
    throw "Run directory not found: $runDir"
}

$manifestPath = Join-Path $runDir 'run_manifest.json'
if (-not (Test-Path -LiteralPath $manifestPath)) {
    throw 'run_manifest.json is missing.'
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$errors = New-Object System.Collections.Generic.List[string]

if ($manifest.run_id -notmatch '^RUN-[0-9]{8}$') { $errors.Add('Invalid run_id.') }
if (-not $manifest.status) { $errors.Add('Missing status.') }

$requiredByStatus = [ordered]@{
    INPUT_READY = @('00_input.md')
    RESEARCHED = @('01_research_packet.json')
    IDEATED = @('02_competitor_patterns.json', '03_ideas.csv')
    SELECTED = @('04_selected_ideas.json')
    SCRIPTED = @('05_script_manifest.json')
    VISUALIZED = @('06_visual_manifest.json')
    QA_PASSED = @('07_quality_report.json')
    GEO_ASSETIZED = @('08_geo_manifest.json')
    READY_TO_PUBLISH = @('08_publish_plan.csv')
    REVIEWED = @('09_post_publish_review.md')
}

$statusOrder = @('CREATED','INPUT_READY','RESEARCHED','IDEATED','SELECTED','SCRIPTED','VISUALIZED','REVISION_REQUIRED','QA_PASSED','GEO_ASSETIZED','READY_TO_PUBLISH','PUBLISHED','REVIEWED','ARCHIVED')
$currentIndex = [array]::IndexOf($statusOrder, [string]$manifest.status)

foreach ($entry in $requiredByStatus.GetEnumerator()) {
    $requiredIndex = [array]::IndexOf($statusOrder, [string]$entry.Key)
    if ($currentIndex -ge $requiredIndex) {
        foreach ($file in $entry.Value) {
            if (-not (Test-Path -LiteralPath (Join-Path $runDir $file))) {
                $errors.Add("Status $($manifest.status) requires $file")
            }
        }
    }
}

if ($errors.Count -gt 0) {
    Write-Host 'VALIDATION FAILED' -ForegroundColor Red
    $errors | ForEach-Object { Write-Host "- $_" }
    exit 1
}

Write-Host "VALIDATION PASSED: $($manifest.run_id) [$($manifest.status)]" -ForegroundColor Green
