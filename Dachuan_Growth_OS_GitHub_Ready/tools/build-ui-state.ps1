param(
    [string]$Root = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'
$runsRoot = Join-Path $Root 'runs'
$dataRoot = Join-Path $Root 'data'
$config = Get-Content -LiteralPath (Join-Path $Root 'config.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$manifestFile = Get-ChildItem -LiteralPath $runsRoot -Filter 'run_manifest.json' -File -Recurse |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

if (-not $manifestFile) {
    throw 'No run_manifest.json found.'
}

$manifest = Get-Content -LiteralPath $manifestFile.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
$threads = $config.module_threads
$state = [ordered]@{
    generatedAt = (Get-Date).ToString('yyyy-MM-ddTHH:mm:sszzz')
    latestRun = $manifest
    ui = [ordered]@{
        enabled = $config.ui.enabled
        url = $config.ui.url
        externalModelConnected = $config.ui.external_model_connected
        modelLabel = $config.ui.model_label
        modelName = $config.ui.model_name
    }
    modules = @(
        [ordered]@{ code = 'CC'; name = 'Control Center'; role = 'Status, handoff, decisions'; thread = $threads.control_center }
        [ordered]@{ code = 'RI'; name = 'Research and Ideas'; role = 'Research / Competitor / Idea'; thread = $threads.research_and_ideas }
        [ordered]@{ code = 'CV'; name = 'Content and Visual'; role = 'Script / Visual'; thread = $threads.content_and_visual }
        [ordered]@{ code = 'QG'; name = 'Quality and GEO'; role = 'Quality / GEO'; thread = $threads.quality_and_geo }
    )
}

New-Item -ItemType Directory -Force -Path $dataRoot | Out-Null
$json = $state | ConvertTo-Json -Depth 12 -Compress
$content = "window.CONTENT_FACTORY_STATE = $json;"
[IO.File]::WriteAllText((Join-Path $dataRoot 'ui-state.js'), $content, [Text.UTF8Encoding]::new($false))
Write-Host "Updated UI state from $($manifestFile.FullName)"
