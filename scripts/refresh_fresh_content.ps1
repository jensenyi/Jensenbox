param(
    [string]$RootPath = (Split-Path -Parent $PSScriptRoot),
    [string]$TriggerType = 'manual',
    [switch]$RetryFailedOnly
)

$ErrorActionPreference = 'Stop'

$rootPath = [IO.Path]::GetFullPath($RootPath)
$configPath = Join-Path $rootPath 'config.json'
$sourceConfigPath = Join-Path $rootPath 'sources\source-config.json'
$dataRoot = Join-Path $rootPath 'data\fresh-content'
$poolPath = Join-Path $dataRoot 'reference-pool.json'
$historyPath = Join-Path $dataRoot 'run-history.json'
$statusPath = Join-Path $dataRoot 'current-run.json'
$summaryPath = Join-Path $dataRoot 'latest-summary.json'
$healthPath = Join-Path $dataRoot 'source-health.json'
$lockPath = Join-Path $dataRoot 'refresh.lock.json'
$envPath = Join-Path $rootPath '.env.local'

function Ensure-Directory {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) {
        New-Item -ItemType Directory -Path $Path -Force | Out-Null
    }
}

function Read-JsonFile {
    param([string]$Path, $Default)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        return $Default
    }

    $raw = Get-Content -LiteralPath $Path -Raw -Encoding UTF8
    if ([string]::IsNullOrWhiteSpace($raw)) {
        return $Default
    }

    return $raw | ConvertFrom-Json
}

function Write-JsonFile {
    param([string]$Path, $Data)
    $json = $Data | ConvertTo-Json -Depth 20
    [IO.File]::WriteAllText($Path, $json, [Text.UTF8Encoding]::new($false))
}

function Import-EnvFile {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return }
    foreach ($line in Get-Content -LiteralPath $Path -Encoding UTF8) {
        if ($line -notmatch '^\s*([^#=\s]+)\s*=\s*(.+?)\s*$') { continue }
        $name = $matches[1]
        $value = $matches[2].Trim().Trim('"').Trim("'")
        if (-not [Environment]::GetEnvironmentVariable($name, 'Process')) {
            [Environment]::SetEnvironmentVariable($name, $value, 'Process')
        }
    }
}

function Test-ContainsChinese {
    param([string]$Text)
    return -not [string]::IsNullOrWhiteSpace($Text) -and $Text -match '[\u4e00-\u9fff]'
}

function Repair-MojibakeText {
    param([string]$Text)
    if ([string]::IsNullOrWhiteSpace($Text)) { return $Text }
    if ($Text -notmatch '[ÃÂäåçèéæïã]') { return $Text }
    try {
        $fixed = [Text.Encoding]::UTF8.GetString([Text.Encoding]::GetEncoding(28591).GetBytes($Text))
        if (Test-ContainsChinese -Text $fixed) { return $fixed }
    } catch {
    }
    return $Text
}

function Set-ObjectProperty {
    param($InputObject, [string]$Name, $Value)
    if ($InputObject.PSObject.Properties[$Name]) {
        $InputObject.$Name = $Value
    } else {
        Add-Member -InputObject $InputObject -NotePropertyName $Name -NotePropertyValue $Value -Force
    }
}

function Get-ChatCompletionsUrl {
    $baseUrl = [Environment]::GetEnvironmentVariable('OPENAI_BASE_URL', 'Process')
    if ([string]::IsNullOrWhiteSpace($baseUrl)) { $baseUrl = 'https://api.deepseek.com' }
    $baseUrl = $baseUrl.TrimEnd('/')
    if ($baseUrl -match '/chat/completions$') { return $baseUrl }
    if ($baseUrl -match '/v1$') { return "$baseUrl/chat/completions" }
    return "$baseUrl/v1/chat/completions"
}

$translationCache = @{}

function ConvertTo-ChineseContent {
    param(
        [string]$Title,
        [string]$Summary,
        [string]$SourceName
    )

    $titleText = Sanitize-TextValue -Text $Title
    $summaryText = Sanitize-TextValue -Text $Summary
    if ((Test-ContainsChinese -Text $titleText) -and (Test-ContainsChinese -Text $summaryText)) {
        return [pscustomobject]@{ title = $titleText; summary = $summaryText; translated = $false }
    }

    $apiKey = [Environment]::GetEnvironmentVariable('OPENAI_API_KEY', 'Process')
    if ([string]::IsNullOrWhiteSpace($apiKey)) {
        return [pscustomobject]@{ title = $titleText; summary = $summaryText; translated = $false }
    }

    $cacheKey = "$titleText`n$summaryText"
    if ($translationCache.ContainsKey($cacheKey)) { return $translationCache[$cacheKey] }

    try {
        $model = [Environment]::GetEnvironmentVariable('OPENAI_MODEL', 'Process')
        if ([string]::IsNullOrWhiteSpace($model)) { $model = 'deepseek-chat' }
        $body = @{
            model = $model
            temperature = 0.2
            max_tokens = 500
            messages = @(
                @{ role = 'system'; content = '你是内容工厂的信息标准化助手。把输入新闻标题和摘要翻译/改写成简体中文，保留事实、品牌名、平台名和来源，不添加不存在的信息。只输出 JSON。' },
                @{ role = 'user'; content = "来源：$SourceName`n标题：$titleText`n摘要：$summaryText`n`n输出 JSON：{""title"":""中文标题"",""summary"":""中文摘要，80字以内""}" }
            )
        } | ConvertTo-Json -Depth 8

        $response = Invoke-RestMethod -Method Post -Uri (Get-ChatCompletionsUrl) -Headers @{
            Authorization = "Bearer $apiKey"
            'Content-Type' = 'application/json'
        } -Body $body -TimeoutSec 45

        $content = [string]$response.choices[0].message.content
        $content = $content -replace '^\s*```json\s*', '' -replace '\s*```\s*$', ''
        $parsed = $content | ConvertFrom-Json
        $translatedTitle = Repair-MojibakeText -Text (Sanitize-TextValue -Text ([string]$parsed.title))
        $translatedSummary = Repair-MojibakeText -Text (Sanitize-TextValue -Text ([string]$parsed.summary))
        if ([string]::IsNullOrWhiteSpace($translatedTitle)) { $translatedTitle = $titleText }
        if ([string]::IsNullOrWhiteSpace($translatedSummary)) { $translatedSummary = $summaryText }
        $result = [pscustomobject]@{ title = $translatedTitle; summary = $translatedSummary; translated = $true }
    } catch {
        $result = [pscustomobject]@{ title = $titleText; summary = $summaryText; translated = $false }
    }

    $translationCache[$cacheKey] = $result
    return $result
}

function Normalize-Url {
    param([string]$Url)
    if ([string]::IsNullOrWhiteSpace($Url)) { return '' }
    try {
        $uri = [Uri]$Url
        $builder = [UriBuilder]::new($uri)
        $builder.Fragment = ''
        $builder.Port = if ($builder.Port -eq 80 -or $builder.Port -eq 443) { -1 } else { $builder.Port }
        return $builder.Uri.AbsoluteUri.TrimEnd('/').ToLowerInvariant()
    } catch {
        return $Url.Trim().ToLowerInvariant()
    }
}

function Normalize-TextKey {
    param([string]$Text)
    if ([string]::IsNullOrWhiteSpace($Text)) { return '' }
    $value = $Text.ToLowerInvariant()
    $value = [Regex]::Replace($value, '<[^>]+>', ' ')
    $value = [Regex]::Replace($value, '[^a-z0-9\u4e00-\u9fff]+', ' ')
    $value = [Regex]::Replace($value, '\s+', ' ').Trim()
    return $value
}

function New-EventKey {
    param(
        [string]$Title,
        [string]$PublishedAt
    )
    $titleKey = Normalize-TextKey -Text $Title
    $dateKey = ''
    if (-not [string]::IsNullOrWhiteSpace($PublishedAt)) {
        try {
            $dateKey = ([datetimeoffset]$PublishedAt).ToString('yyyy-MM-dd')
        } catch {
            $dateKey = ''
        }
    }
    return ($titleKey + '|' + $dateKey).Trim('|')
}

function Strip-Html {
    param([string]$Text)
    if ([string]::IsNullOrWhiteSpace($Text)) { return '' }
    $decoded = [System.Net.WebUtility]::HtmlDecode($Text)
    $stripped = [Regex]::Replace($decoded, '<[^>]+>', ' ')
    $stripped = [Regex]::Replace($stripped, '[\x00-\x08\x0B\x0C\x0E-\x1F]', ' ')
    $stripped = [Regex]::Replace($stripped, '\s+', ' ').Trim()
    if ($stripped.Length -gt 240) {
        return $stripped.Substring(0, 240)
    }
    return $stripped
}

function Sanitize-TextValue {
    param([string]$Text)
    if ([string]::IsNullOrWhiteSpace($Text)) { return '' }
    $value = [System.Net.WebUtility]::HtmlDecode([string]$Text)
    $value = [Regex]::Replace($value, '[\x00-\x08\x0B\x0C\x0E-\x1F]', ' ')
    $value = [Regex]::Replace($value, '\s+', ' ').Trim()
    return $value
}

function Get-XmlText {
    param($Value)
    if ($null -eq $Value) { return '' }
    if ($Value -is [string]) { return $Value }
    if ($Value.PSObject.Properties.Name -contains 'InnerText') {
        return [string]$Value.InnerText
    }
    return [string]$Value
}

function Get-ImageUrlFromHtml {
    param([string]$Html)
    if ([string]::IsNullOrWhiteSpace($Html)) { return '' }

    $patterns = @(
        '<meta[^>]+property=["'']og:image["''][^>]+content=["'']([^"'']+)["'']',
        '<meta[^>]+name=["'']twitter:image["''][^>]+content=["'']([^"'']+)["'']',
        '<img[^>]+src=["'']([^"'']+)["'']'
    )

    foreach ($pattern in $patterns) {
        $match = [Regex]::Match($Html, $pattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
        if ($match.Success) {
            return [string]$match.Groups[1].Value
        }
    }

    return ''
}

function Get-FirstMatchValue {
    param(
        [string]$Text,
        [string[]]$Patterns
    )
    if ([string]::IsNullOrWhiteSpace($Text)) { return '' }
    foreach ($pattern in $Patterns) {
        $match = [Regex]::Match($Text, $pattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
        if ($match.Success -and $match.Groups.Count -gt 1) {
            return [System.Net.WebUtility]::HtmlDecode([string]$match.Groups[1].Value).Trim()
        }
    }
    return ''
}

function Resolve-AbsoluteUrl {
    param(
        [string]$Url,
        [string]$BaseUrl
    )
    if ([string]::IsNullOrWhiteSpace($Url)) { return '' }
    try {
        if ($Url -match '^https?://') { return [string]$Url }
        if ([string]::IsNullOrWhiteSpace($BaseUrl)) { return [string]$Url }
        return [string]([Uri]::new([Uri]$BaseUrl, $Url)).AbsoluteUri
    } catch {
        return [string]$Url
    }
}

function Test-PreferredNewsImageUrl {
    param([string]$Url)
    $value = StringValue -Text $Url
    if ([string]::IsNullOrWhiteSpace($value)) { return $false }
    if ($value -notmatch '^https?://') { return $false }
    if ($value -notmatch '\.(jpg|jpeg|png|webp)(\?|$)') { return $false }
    if ($value -match '(logo|avatar|icon|favicon|apple-touch|wechat|qrcode|qr|default|placeholder|spacer|loading|sprite)') { return $false }
    if ($value -match '100logo') { return $false }
    return $true
}

function StringValue {
    param([string]$Text)
    return ([string]$Text).Trim()
}

function Get-CandidateImageUrlsFromHtml {
    param(
        [string]$Html,
        [string]$BaseUrl
    )

    $matches = New-Object System.Collections.Generic.List[string]
    $patterns = @(
        'https://socialbeta\.oss-cn-hangzhou\.aliyuncs\.com/[^"''\s>]+\.(?:jpg|jpeg|png|webp)(?:\?[^"''\s>]*)?',
        'https://cdn\.morketing\.com/[^"''\s>]+\.(?:jpg|jpeg|png|webp)(?:\?[^"''\s>]*)?',
        'https://img\.huxiucdn\.com/[^"''\s>]+\.(?:jpg|jpeg|png|webp)(?:\?[^"''\s>]*)?',
        '<meta[^>]+property=["'']og:image["''][^>]+content=["'']([^"'']+)["'']',
        '<meta[^>]+name=["'']twitter:image["''][^>]+content=["'']([^"'']+)["'']',
        '<img[^>]+(?:data-src|data-original|src)=["'']([^"'']+)["'']'
    )

    foreach ($pattern in $patterns) {
        foreach ($match in [Regex]::Matches($Html, $pattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
            $raw = if ($match.Groups.Count -gt 1 -and $match.Groups[1].Value) { [string]$match.Groups[1].Value } else { [string]$match.Value }
            $candidate = Resolve-AbsoluteUrl -Url $raw -BaseUrl $BaseUrl
            if ([string]::IsNullOrWhiteSpace($candidate)) { continue }
            if (-not $matches.Contains($candidate)) {
                $matches.Add($candidate)
            }
        }
    }

    return $matches
}

function Select-BestImageUrl {
    param(
        [string[]]$Candidates,
        [string]$PageUrl
    )

    $bestUrl = ''
    $bestScore = -999

    foreach ($candidate in $Candidates) {
        $url = StringValue -Text $candidate
        if (-not (Test-PreferredNewsImageUrl -Url $url)) { continue }

        $score = 0
        if ($url -match 'socialbeta\.oss-cn-hangzhou\.aliyuncs\.com') { $score += 48 }
        if ($url -match 'cdn\.morketing\.com') { $score += 46 }
        if ($url -match 'img\.huxiucdn\.com') { $score += 44 }
        if ($url -match '/upload/') { $score += 10 }
        if ($url -match '/cover/') { $score += 12 }
        if ($url -match '(article-cover|general-cover)') { $score += 12 }
        if ($url -match '(banner|thumb|thumbnail)') { $score += 4 }
        if ($url -match '(logo|avatar|icon|favicon|apple-touch|100logo)') { $score -= 80 }
        if ($url.Length -gt 120) { $score += 4 }

        if ($score -gt $bestScore) {
            $bestScore = $score
            $bestUrl = $url
        }
    }

    return $bestUrl
}

function Get-ArticleMetaFromHtml {
    param(
        [string]$Html,
        [string]$Url
    )

    $title = Sanitize-TextValue -Text (Get-FirstMatchValue -Text $Html -Patterns @(
        '<meta[^>]+property=["'']og:title["''][^>]+content=["'']([^"'']+)["'']',
        '<title>([^<]+)</title>'
    ))
    $summary = Sanitize-TextValue -Text (Get-FirstMatchValue -Text $Html -Patterns @(
        '<meta[^>]+name=["'']description["''][^>]+content=["'']([^"'']+)["'']',
        '<meta[^>]+property=["'']og:description["''][^>]+content=["'']([^"'']+)["'']'
    ))
    $publishedAt = Sanitize-TextValue -Text (Get-FirstMatchValue -Text $Html -Patterns @(
        '<meta[^>]+property=["'']article:published_time["''][^>]+content=["'']([^"'']+)["'']',
        '"publish(?:ed)?(?:_time|Time)"\s*:\s*"([^"]+)"',
        '"datePublished"\s*:\s*"([^"]+)"'
    ))
    $imageCandidates = @(Get-CandidateImageUrlsFromHtml -Html $Html -BaseUrl $Url)
    $imageUrl = Select-BestImageUrl -Candidates $imageCandidates -PageUrl $Url

    return [pscustomobject]@{
        title = $title
        summary = $summary
        publishedAt = $publishedAt
        imageUrl = $imageUrl
    }
}

function Get-ImageUrlFromRssItem {
    param($Item)

    foreach ($propertyName in @('enclosure', 'thumbnail', 'content')) {
        if ($Item.PSObject.Properties.Name -contains $propertyName) {
            $value = $Item.$propertyName
            if ($value -and $value.url) { return [string]$value.url }
            if ($value -and $value.href) { return [string]$value.href }
        }
    }

    if ($Item.PSObject.Properties.Name -contains 'InnerXml') {
        $fromXml = Get-ImageUrlFromHtml -Html ([string]$Item.InnerXml)
        if ($fromXml) { return $fromXml }
    }

    $description = ''
    if ($Item.PSObject.Properties.Name -contains 'description') {
        $description = Get-XmlText -Value $Item.description
    }

    return Get-ImageUrlFromHtml -Html $description
}

function Get-WebEntries {
    param($Source)

    $listResponse = Invoke-WebRequest -UseBasicParsing -Uri ([string]$Source.url) -TimeoutSec 30
    $html = [string]$listResponse.Content
    $pattern = [string]$Source.articleLinkPattern
    if ([string]::IsNullOrWhiteSpace($pattern)) {
        throw "missing_article_link_pattern:$($Source.id)"
    }

    $maxEntries = if ($Source.maxEntries) { [int]$Source.maxEntries } else { 8 }
    $baseUrl = if ($Source.urlPrefix) { [string]$Source.urlPrefix } else { [string]$Source.url }
    $links = New-Object System.Collections.Generic.List[string]
    foreach ($match in [Regex]::Matches($html, $pattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
        $rawLink = if ($match.Groups.Count -gt 1 -and $match.Groups[1].Value) { [string]$match.Groups[1].Value } else { [string]$match.Value }
        $link = Resolve-AbsoluteUrl -Url $rawLink -BaseUrl $baseUrl
        if (-not [string]::IsNullOrWhiteSpace($link) -and -not $links.Contains($link)) {
            $links.Add($link)
        }
        if ($links.Count -ge $maxEntries) { break }
    }

    $entries = New-Object System.Collections.Generic.List[object]
    foreach ($link in $links) {
        try {
            $articleResponse = Invoke-WebRequest -UseBasicParsing -Uri $link -TimeoutSec 30
            $meta = Get-ArticleMetaFromHtml -Html ([string]$articleResponse.Content) -Url $link
            if ([string]::IsNullOrWhiteSpace($meta.title) -or [string]::IsNullOrWhiteSpace($meta.imageUrl)) {
                continue
            }
            $entries.Add([pscustomobject]@{
                title = $meta.title
                link = $link
                summary = $meta.summary
                publishedAt = $meta.publishedAt
                imageUrl = $meta.imageUrl
            })
        } catch {
            continue
        }
    }

    return $entries
}

function Get-TrustScore {
    param([string]$TrustLevel)
    switch ($TrustLevel) {
        'high' { return 92 }
        'medium' { return 76 }
        'low' { return 55 }
        default { return 60 }
    }
}

function Get-FreshnessScore {
    param([string]$PublishedAt)
    if ([string]::IsNullOrWhiteSpace($PublishedAt)) { return 50 }
    try {
        $hours = ([datetimeoffset]::Now - [datetimeoffset]$PublishedAt).TotalHours
        if ($hours -le 12) { return 95 }
        if ($hours -le 24) { return 88 }
        if ($hours -le 48) { return 78 }
        if ($hours -le 72) { return 68 }
        return 52
    } catch {
        return 50
    }
}

function Get-RelevanceScore {
    param(
        [string[]]$Categories,
        [string]$Title,
        [string]$Summary
    )
    $haystack = ($Title + ' ' + $Summary).ToLowerInvariant()
    $score = 55
    foreach ($category in $Categories) {
        switch ($category) {
            'brand' { $score += 8 }
            'campaign' { $score += 8 }
            'consumer' { $score += 6 }
            'platform' { $score += 8 }
            'geo' { $score += 10 }
            'ai' { $score += 10 }
            'search' { $score += 9 }
            'short_video' { $score += 7 }
        }
    }
    foreach ($keyword in @('brand', 'marketing', 'search', 'video', 'ai', 'campaign', 'creator', 'commerce')) {
        if ($haystack -like "*$keyword*") {
            $score += 3
        }
    }
    return [Math]::Min($score, 98)
}

function Get-ActionabilityScore {
    param([string]$Summary)
    if ([string]::IsNullOrWhiteSpace($Summary)) { return 45 }
    $score = 48
    foreach ($keyword in @('launch', 'update', 'policy', 'feature', 'report', 'test', 'ads', 'search', 'creator')) {
        if ($Summary.ToLowerInvariant() -like "*$keyword*") {
            $score += 5
        }
    }
    return [Math]::Min($score, 92)
}

function Get-BrandExpertScore {
    param(
        [string[]]$Categories,
        [string]$Title,
        [string]$Summary,
        [string]$SourceName
    )
    $text = ($Title + ' ' + $Summary + ' ' + $SourceName).ToLowerInvariant()
    $score = 55
    foreach ($category in $Categories) {
        switch ($category) {
            'viral' { $score += 16 }
            'douyin' { $score += 14 }
            'xiaohongshu' { $score += 14 }
            'brand' { $score += 12 }
            'campaign' { $score += 12 }
            'short_video' { $score += 10 }
            'consumer' { $score += 8 }
            'platform' { $score += 8 }
        }
    }
    foreach ($keyword in @('douyin', 'xiaohongshu', 'viral', 'hot', 'trend', 'brand', 'marketing', 'growth', 'conversion', 'creator', 'commerce')) {
        if ($text -like "*$keyword*") { $score += 3 }
    }
    return [Math]::Min($score, 100)
}

function Get-BrandExpertReason {
    param(
        [string[]]$Categories,
        [string]$SourceName
    )
    if ($Categories -contains 'douyin') { return 'Brand growth expert: Douyin hot signal, prioritize hook, emotion, repeatable short-video format.' }
    if ($Categories -contains 'xiaohongshu') { return 'Brand growth expert: Xiaohongshu hot signal, prioritize seeding scene, lifestyle angle, note/post potential.' }
    if ($Categories -contains 'brand' -or $Categories -contains 'campaign') { return 'Brand growth expert: Brand/campaign signal, prioritize business value, growth action, communication asset.' }
    return "Brand growth expert: Platform trend lead from $SourceName."
}
function Get-SuggestedModules {
    param([string[]]$Categories)
    $modules = New-Object System.Collections.Generic.List[string]
    $modules.Add('03')
    if ($Categories -contains 'brand' -or $Categories -contains 'campaign') { $modules.Add('01') }
    if ($Categories -contains 'short_video' -or $Categories -contains 'platform') { $modules.Add('02') }
    return $modules | Select-Object -Unique
}

function Get-SuggestedAngles {
    param(
        [string]$Title,
        [string[]]$Categories
    )
    $angles = New-Object System.Collections.Generic.List[string]
    if ($Categories -contains 'geo' -or $Categories -contains 'search') { $angles.Add('geo_search_shift') }
    if ($Categories -contains 'ai') { $angles.Add('ai_behavior_shift') }
    if ($Categories -contains 'platform') { $angles.Add('platform_rule_or_traffic') }
    if ($Categories -contains 'brand' -or $Categories -contains 'campaign') { $angles.Add('brand_case_signal') }
    if ($angles.Count -eq 0) { $angles.Add('industry_growth_signal') }
    return $angles | Select-Object -Unique
}

function Get-RssEntries {
    param([string]$Url)

    $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 30
    $xml = [xml]$response.Content
    $entries = @()

    if ($xml.rss.channel.item) {
        foreach ($item in $xml.rss.channel.item) {
            $entries += [pscustomobject]@{
                title = Get-XmlText -Value $item.title
                link = Get-XmlText -Value $item.link
                summary = Get-XmlText -Value $item.description
                publishedAt = Get-XmlText -Value $item.pubDate
                imageUrl = Get-ImageUrlFromRssItem -Item $item
            }
        }
    } elseif ($xml.feed.entry) {
        foreach ($entry in $xml.feed.entry) {
            $link = ''
            if ($entry.link.href) { $link = [string]$entry.link.href }
            elseif ($entry.link) { $link = Get-XmlText -Value $entry.link }
            $summary = if ($entry.summary) { Get-XmlText -Value $entry.summary } elseif ($entry.content) { Get-XmlText -Value $entry.content } else { '' }
            $publishedAt = if ($entry.updated) { Get-XmlText -Value $entry.updated } elseif ($entry.published) { Get-XmlText -Value $entry.published } else { '' }
            $entries += [pscustomobject]@{
                title = Get-XmlText -Value $entry.title
                link = $link
                summary = $summary
                publishedAt = $publishedAt
                imageUrl = Get-ImageUrlFromHtml -Html $summary
            }
        }
    }

    return $entries
}

function Set-RunStatus {
    param(
        [string]$RunId,
        [string]$Status,
        [string]$CurrentStep,
        [string]$Message,
        [int]$TotalSources,
        [int]$SuccessfulSources,
        [int]$FailedSources,
        [int]$FetchedItems,
        [int]$UniqueItems,
        [int]$DuplicateItems,
        [string[]]$Errors
    )

    $state = [ordered]@{
        runId = $RunId
        status = $Status
        currentStep = $CurrentStep
        message = $Message
        totalSources = $TotalSources
        successfulSources = $SuccessfulSources
        failedSources = $FailedSources
        fetchedItems = $FetchedItems
        uniqueItems = $UniqueItems
        duplicateItems = $DuplicateItems
        errorSummary = $Errors
        updatedAt = (Get-Date).ToString('o')
    }

    Write-JsonFile -Path $statusPath -Data $state
}

Ensure-Directory -Path $dataRoot
Import-EnvFile -Path $envPath

$config = Get-Content -LiteralPath $configPath -Raw -Encoding UTF8 | ConvertFrom-Json
$sourceConfig = Get-Content -LiteralPath $sourceConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
$schedule = $config.fresh_content_schedule
$history = @((Read-JsonFile -Path $historyPath -Default @()))
$pool = @((Read-JsonFile -Path $poolPath -Default @()))
$health = @{}
$existingHealth = Read-JsonFile -Path $healthPath -Default @{}
if ($existingHealth) {
    foreach ($prop in $existingHealth.PSObject.Properties) {
        $health[$prop.Name] = $prop.Value
    }
}

$runId = 'fresh-' + (Get-Date -Format 'yyyyMMdd-HHmmss')
$startedAt = (Get-Date).ToString('o')
$lockData = [ordered]@{
    pid = $PID
    runId = $runId
    startedAt = $startedAt
}
Write-JsonFile -Path $lockPath -Data $lockData

$maxItemsPerRun = if ($schedule.maxItemsPerRun) { [int]$schedule.maxItemsPerRun } else { 100 }
$freshnessWindowHours = if ($schedule.freshnessWindowHours) { [int]$schedule.freshnessWindowHours } else { 72 }
$retryLimit = if ($schedule.retryLimit) { [int]$schedule.retryLimit } else { 2 }
$cutoff = [datetimeoffset]::Now.AddHours(-1 * $freshnessWindowHours)

$sources = @($sourceConfig.sources | Where-Object { $_.enabled -eq $true })
if ($RetryFailedOnly) {
    $sources = @($sources | Where-Object {
        $sourceHealth = $health[$_.id]
        $null -ne $sourceHealth -and $sourceHealth.failureCount -gt 0
    })
}

function Get-TopHubEntries {
    param($Source)

    $response = Invoke-WebRequest -UseBasicParsing -Uri ([string]$Source.url) -TimeoutSec 30
    $html = [string]$response.Content
    $pattern = [string]$Source.itemLinkPattern
    if ([string]::IsNullOrWhiteSpace($pattern)) {
        $pattern = 'https?://[^"''<>]+'
    }

    $entries = New-Object System.Collections.Generic.List[object]
    $seen = New-Object System.Collections.Generic.HashSet[string]
    $rank = 0
    $maxEntries = 20
    if ($Source.maxEntries) { $maxEntries = [int]$Source.maxEntries }

    $anchorPattern = '<a[^>]+href=["''](' + $pattern + ')["''][^>]*>(.*?)</a>'
    foreach ($match in [Regex]::Matches($html, $anchorPattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
        $href = [System.Net.WebUtility]::HtmlDecode([string]$match.Groups[1].Value).Trim()
        $title = Strip-Html -Text ([string]$match.Groups[2].Value)
        if ([string]::IsNullOrWhiteSpace($href) -or [string]::IsNullOrWhiteSpace($title)) { continue }
        if ($title.Length -lt 2 -or $title -match '^[\uE000-\uF8FF\s]+$') { continue }
        $key = (Normalize-Url -Url $href)
        if (-not $seen.Add($key)) { continue }

        $rank += 1
        $entries.Add([pscustomobject]@{
            title = $title
            link = $href
            summary = "来自 $($Source.name) 第 $rank 位热榜。优先用于拆解平台爆点、内容钩子、评论区情绪和短视频/图文选题角度。"
            publishedAt = (Get-Date).ToString('o')
            imageUrl = ''
        })
        if ($entries.Count -ge $maxEntries) { break }
    }

    return $entries
}

$totalSources = @($sources).Count
$successfulSources = 0
$failedSources = 0
$fetchedItems = 0
$uniqueItems = 0
$duplicateItems = 0
$errors = New-Object System.Collections.Generic.List[string]
$nextPool = New-Object System.Collections.Generic.List[object]

foreach ($item in $pool) {
    $nextPool.Add($item)
}

Set-RunStatus -RunId $runId -Status 'running' -CurrentStep 'loading_sources' -Message 'loading_sources' -TotalSources $totalSources -SuccessfulSources 0 -FailedSources 0 -FetchedItems 0 -UniqueItems 0 -DuplicateItems 0 -Errors @()

try {
    foreach ($source in $sources) {
        $sourceId = [string]$source.id
        $sourceName = [string]$source.name
        Set-RunStatus -RunId $runId -Status 'running' -CurrentStep 'fetching_source' -Message ("fetching:" + $sourceName) -TotalSources $totalSources -SuccessfulSources $successfulSources -FailedSources $failedSources -FetchedItems $fetchedItems -UniqueItems $uniqueItems -DuplicateItems $duplicateItems -Errors $errors.ToArray()

        try {
            if ($source.fetchMethod -eq 'rss') {
                $entries = @(Get-RssEntries -Url $source.url)
            } elseif ($source.fetchMethod -eq 'web') {
                $entries = @(Get-WebEntries -Source $source)
            } elseif ($source.fetchMethod -eq 'tophub') {
                $entries = @(Get-TopHubEntries -Source $source)
            } else {
                throw "unsupported_fetch_method:$($source.fetchMethod)"
            }
            $successfulSources += 1
            $fetchedItems += $entries.Count

            $health[$sourceId] = [ordered]@{
                lastFetchedAt = (Get-Date).ToString('o')
                lastSuccessAt = (Get-Date).ToString('o')
                failureCount = 0
                paused = $false
            }

            foreach ($entry in $entries) {
                if ($uniqueItems -ge $maxItemsPerRun) { break }

                $publishedAt = ''
                if (-not [string]::IsNullOrWhiteSpace($entry.publishedAt)) {
                    try {
                        $publishedAt = ([datetimeoffset]$entry.publishedAt).ToString('o')
                    } catch {
                        $publishedAt = ''
                    }
                }

                if ($publishedAt) {
                    try {
                        if ([datetimeoffset]$publishedAt -lt $cutoff) {
                            continue
                        }
                    } catch {
                    }
                }

                $title = ([string]$entry.title).Trim()
                if ([string]::IsNullOrWhiteSpace($title)) { continue }

                $summary = Sanitize-TextValue -Text (Strip-Html -Text ([string]$entry.summary))
                $originalTitle = $title
                $originalSummary = $summary
                $localized = ConvertTo-ChineseContent -Title $title -Summary $summary -SourceName $sourceName
                $title = [string]$localized.title
                $summary = [string]$localized.summary
                $normalizedUrl = Normalize-Url -Url ([string]$entry.link)
                $eventKey = New-EventKey -Title $title -PublishedAt $publishedAt
                $categories = @($source.categories)
                $expertScore = Get-BrandExpertScore -Categories $categories -Title $title -Summary $summary -SourceName $sourceName
                $expertReason = Get-BrandExpertReason -Categories $categories -SourceName $sourceName

                $duplicate = $nextPool | Where-Object {
                    (Normalize-Url -Url $_.sourceUrl) -eq $normalizedUrl -or (
                        $_.duplicateGroupId -eq $eventKey -and -not [string]::IsNullOrWhiteSpace($eventKey)
                    )
                } | Select-Object -First 1

                if ($duplicate) {
                    $duplicateItems += 1

                    $existingPublished = $null
                    $incomingPublished = $null
                    try { if ($duplicate.publishedAt) { $existingPublished = [datetimeoffset]$duplicate.publishedAt } } catch {}
                    try { if ($publishedAt) { $incomingPublished = [datetimeoffset]$publishedAt } } catch {}

                    $existingImage = [string]$duplicate.imageUrl
                    $incomingImage = Sanitize-TextValue -Text ([string]$entry.imageUrl)
                    $hasNewerDate = $incomingPublished -and $existingPublished -and $incomingPublished -gt $existingPublished
                    $hasChangedSummary = $summary -and $summary -ne [string]$duplicate.summary
                    $hasBetterImage = (Test-PreferredNewsImageUrl -Url $incomingImage) -and -not (Test-PreferredNewsImageUrl -Url $existingImage)

                    if ($hasNewerDate -or $hasChangedSummary -or $hasBetterImage) {
                        if ($summary) { $duplicate.summary = $summary }
                        if ($title) { $duplicate.title = $title }
                        if ($publishedAt) { $duplicate.publishedAt = $publishedAt }
                        if ($entry.link) { $duplicate.sourceUrl = [string]$entry.link }
                        if ($incomingImage) { $duplicate.imageUrl = $incomingImage }
                        if ($localized.translated) {
                            Set-ObjectProperty -InputObject $duplicate -Name 'originalTitle' -Value $originalTitle
                            Set-ObjectProperty -InputObject $duplicate -Name 'originalSummary' -Value $originalSummary
                            Set-ObjectProperty -InputObject $duplicate -Name 'language' -Value 'zh-CN'
                            Set-ObjectProperty -InputObject $duplicate -Name 'translationStatus' -Value 'translated'
                        }
                        $duplicate.expertRole = '品牌增长专家'
                        $duplicate.expertScore = $expertScore
                        $duplicate.expertReason = $expertReason
                        $duplicate.meaningfulUpdate = $true
                        $duplicate.updateSummary = if ($hasBetterImage -and -not ($hasNewerDate -or $hasChangedSummary)) { 'image_upgraded' } else { 'newer_coverage_or_changed_summary' }
                        $duplicate.updatedAt = (Get-Date).ToString('o')
                    }
                    continue
                }

                $reference = [ordered]@{
                    id = [Guid]::NewGuid().ToString('N')
                    title = $title
                    summary = $summary
                    originalTitle = if ($localized.translated) { $originalTitle } else { '' }
                    originalSummary = if ($localized.translated) { $originalSummary } else { '' }
                    sourceName = $sourceName
                    sourceUrl = [string]$entry.link
                    imageUrl = Sanitize-TextValue -Text ([string]$entry.imageUrl)
                    sourceType = [string]$source.sourceType
                    publishedAt = $publishedAt
                    fetchedAt = (Get-Date).ToString('o')
                    categories = $categories
                    brands = @()
                    platforms = @()
                    regions = @([string]$source.region)
                    language = 'zh-CN'
                    translationStatus = if ($localized.translated) { 'translated' } else { 'source_or_fallback' }
                    keywords = @()
                    freshnessScore = Get-FreshnessScore -PublishedAt $publishedAt
                    relevanceScore = Get-RelevanceScore -Categories @($source.categories) -Title $title -Summary $summary
                    trustScore = Get-TrustScore -TrustLevel ([string]$source.trustLevel)
                    noveltyScore = 72
                    actionabilityScore = Get-ActionabilityScore -Summary $summary
                    expertRole = '品牌增长专家'
                    expertScore = $expertScore
                    expertReason = $expertReason
                    duplicateGroupId = $eventKey
                    duplicateStatus = 'unique'
                    verificationStatus = if ($source.trustLevel -eq 'high') { 'source_verified' } else { 'unverified' }
                    contentStatus = 'reviewing'
                    suggestedModules = @(Get-SuggestedModules -Categories $categories)
                    suggestedAngles = @(Get-SuggestedAngles -Title $title -Categories $categories)
                    meaningfulUpdate = $false
                    updateSummary = ''
                    createdAt = (Get-Date).ToString('o')
                    updatedAt = (Get-Date).ToString('o')
                }

                $nextPool.Add([pscustomobject]$reference)
                $uniqueItems += 1
            }
        } catch {
            $failedSources += 1
            $errors.Add("${sourceId}: $($_.Exception.Message)")

            $sourceHealth = $health[$sourceId]
            $failureCount = if ($sourceHealth) { [int]$sourceHealth.failureCount + 1 } else { 1 }
            $health[$sourceId] = [ordered]@{
                lastFetchedAt = (Get-Date).ToString('o')
                lastSuccessAt = if ($sourceHealth) { $sourceHealth.lastSuccessAt } else { $null }
                failureCount = $failureCount
                paused = ($failureCount -ge $retryLimit)
            }
        }
    }

    Set-RunStatus -RunId $runId -Status 'running' -CurrentStep 'saving_pool' -Message 'saving_pool' -TotalSources $totalSources -SuccessfulSources $successfulSources -FailedSources $failedSources -FetchedItems $fetchedItems -UniqueItems $uniqueItems -DuplicateItems $duplicateItems -Errors $errors.ToArray()

    foreach ($item in $nextPool) {
        $itemText = ([string]$item.title + ' ' + [string]$item.summary)
        if ((Test-ContainsChinese -Text $itemText) -and $itemText -notmatch '[ÃÂäåçèéæïã�]') { continue }
        $sourceTitleForTranslation = if ($item.originalTitle) { [string]$item.originalTitle } else { [string]$item.title }
        $sourceSummaryForTranslation = if ($item.originalSummary) { [string]$item.originalSummary } else { [string]$item.summary }
        $localizedExisting = ConvertTo-ChineseContent -Title $sourceTitleForTranslation -Summary $sourceSummaryForTranslation -SourceName ([string]$item.sourceName)
        if (-not $localizedExisting.translated) { continue }
        Set-ObjectProperty -InputObject $item -Name 'originalTitle' -Value $sourceTitleForTranslation
        Set-ObjectProperty -InputObject $item -Name 'originalSummary' -Value $sourceSummaryForTranslation
        Set-ObjectProperty -InputObject $item -Name 'title' -Value ([string]$localizedExisting.title)
        Set-ObjectProperty -InputObject $item -Name 'summary' -Value ([string]$localizedExisting.summary)
        Set-ObjectProperty -InputObject $item -Name 'language' -Value 'zh-CN'
        Set-ObjectProperty -InputObject $item -Name 'translationStatus' -Value 'translated'
        Set-ObjectProperty -InputObject $item -Name 'updatedAt' -Value ((Get-Date).ToString('o'))
    }

    $nextPool = @($nextPool | Where-Object {
        $text = ([string]$_.title + ' ' + [string]$_.summary)
        (Test-ContainsChinese -Text $text) -and $text -notmatch '[ÃÂäåçèéæïã�]'
    })

    $orderedPool = @($nextPool | Sort-Object @{ Expression = { if ($_.fetchedAt) { [datetimeoffset]$_.fetchedAt } else { [datetimeoffset]::MinValue } } } -Descending)
    if ($orderedPool.Count -gt 300) {
        $orderedPool = $orderedPool[0..299]
    }

    Write-JsonFile -Path $poolPath -Data $orderedPool
    Write-JsonFile -Path $healthPath -Data $health

    $completedAt = (Get-Date).ToString('o')
    $runResult = [ordered]@{
        runId = $runId
        triggerType = $TriggerType
        startedAt = $startedAt
        completedAt = $completedAt
        status = if ($failedSources -gt 0 -and $successfulSources -gt 0) { 'partial' } elseif ($failedSources -gt 0) { 'failed' } else { 'success' }
        totalSources = $totalSources
        successfulSources = $successfulSources
        failedSources = $failedSources
        fetchedItems = $fetchedItems
        uniqueItems = $uniqueItems
        duplicateItems = $duplicateItems
        reviewPendingItems = @($orderedPool | Where-Object { $_.contentStatus -eq 'reviewing' }).Count
        errorSummary = $errors.ToArray()
        latestStep = 'completed'
    }

    $history = @($runResult) + @($history)
    if ($history.Count -gt 30) {
        $history = $history[0..29]
    }

    Write-JsonFile -Path $historyPath -Data $history
    Write-JsonFile -Path $summaryPath -Data $runResult
    Set-RunStatus -RunId $runId -Status $runResult.status -CurrentStep 'completed' -Message 'refresh_completed' -TotalSources $totalSources -SuccessfulSources $successfulSources -FailedSources $failedSources -FetchedItems $fetchedItems -UniqueItems $uniqueItems -DuplicateItems $duplicateItems -Errors $errors.ToArray()

    $runResult | ConvertTo-Json -Depth 20
} finally {
    if (Test-Path -LiteralPath $lockPath) {
        Remove-Item -LiteralPath $lockPath -Force -ErrorAction SilentlyContinue
    }
}

