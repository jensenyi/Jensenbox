param(
    [datetime]$Date = (Get-Date)
)

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$dateText = $Date.ToString('yyyy-MM-dd')
$compact = $Date.ToString('yyyyMMdd')
$runId = "RUN-$compact"
$runDir = Join-Path $root "runs\$dateText"

if (Test-Path -LiteralPath $runDir) {
    Write-Host "Run already exists: $runDir"
    exit 0
}

New-Item -ItemType Directory -Force -Path $runDir | Out-Null
@('scripts', 'visuals', 'geo_assets', 'evidence', 'versions') | ForEach-Object {
    New-Item -ItemType Directory -Force -Path (Join-Path $runDir $_) | Out-Null
}

$createdAt = (Get-Date).ToString('yyyy-MM-ddTHH:mm:sszzz')
$replacements = @{
    '{{RUN_DATE}}' = $dateText
    '{{RUN_ID}}' = $runId
    '{{DATE_COMPACT}}' = $compact
    '{{CREATED_AT}}' = $createdAt
}

function Expand-Template {
    param([string]$Template, [string]$Destination)
    $content = Get-Content -LiteralPath $Template -Raw -Encoding UTF8
    foreach ($key in $replacements.Keys) {
        $content = $content.Replace($key, $replacements[$key])
    }
    Set-Content -LiteralPath $Destination -Value $content -Encoding UTF8
}

Expand-Template (Join-Path $root 'templates\00_input.md') (Join-Path $runDir '00_input.md')
Expand-Template (Join-Path $root 'templates\run_manifest.json') (Join-Path $runDir 'run_manifest.json')
Expand-Template (Join-Path $root 'templates\selected_ideas.json') (Join-Path $runDir '04_selected_ideas.json')
Expand-Template (Join-Path $root 'templates\post_publish_review.md') (Join-Path $runDir '09_post_publish_review.md')

@'
run_id,content_id,platform,title,status,owner,script_path,visual_path,cta,published_url
'@ | Set-Content -LiteralPath (Join-Path $runDir '08_publish_plan.csv') -Encoding UTF8

Write-Host "Created: $runDir"
Write-Host "Next: fill 00_input.md with 3 trends, 3 competitors, and 1 brand case."
& (Join-Path $PSScriptRoot 'build-ui-state.ps1') -Root $root
