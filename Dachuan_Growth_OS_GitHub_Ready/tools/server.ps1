param(
    [int]$Port = 4175,
    [string]$Root = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'
$rootPath = [IO.Path]::GetFullPath($Root).TrimEnd('\') + '\'
$creativeOutputRoot = Join-Path $rootPath 'outputs\creative-workshop'
$mime = @{
    '.html' = 'text/html; charset=utf-8'; '.css' = 'text/css; charset=utf-8'; '.js' = 'application/javascript; charset=utf-8';
    '.json' = 'application/json; charset=utf-8'; '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg';
    '.svg' = 'image/svg+xml'; '.mp4' = 'video/mp4'; '.webm' = 'video/webm'
}

function Ensure-Directory([string]$Path) { if (-not (Test-Path -LiteralPath $Path)) { New-Item -ItemType Directory -Force -Path $Path | Out-Null } }
function ConvertTo-JsonBytes($Object) { [Text.Encoding]::UTF8.GetBytes(($Object | ConvertTo-Json -Depth 18)) }
function Read-TextFile([string]$Path) { if (Test-Path -LiteralPath $Path -PathType Leaf) { return [IO.File]::ReadAllText($Path, [Text.Encoding]::UTF8) }; return $null }
function Write-JsonFile([string]$Path, $Data) { Ensure-Directory (Split-Path -Parent $Path); [IO.File]::WriteAllText($Path, ($Data | ConvertTo-Json -Depth 18), [Text.UTF8Encoding]::new($false)) }

function Get-SettingValue([string]$Name) {
    $envValue = [Environment]::GetEnvironmentVariable($Name, 'Process')
    if (-not [string]::IsNullOrWhiteSpace($envValue)) { return $envValue }
    $envValue = [Environment]::GetEnvironmentVariable($Name, 'User')
    if (-not [string]::IsNullOrWhiteSpace($envValue)) { return $envValue }
    $envFile = Join-Path $rootPath '.env.local'
    if (Test-Path -LiteralPath $envFile -PathType Leaf) {
        foreach ($line in [IO.File]::ReadAllLines($envFile)) {
            if ($line -match '^\s*#') { continue }
            if ($line -match '^\s*([^=]+)\s*=\s*(.*)\s*$') {
                if ($Matches[1].Trim() -eq $Name) { return $Matches[2].Trim().Trim('"').Trim("'") }
            }
        }
    }
    return $null
}
function New-CreativeId([string]$Prefix) { return ($Prefix + '_' + (Get-Date).ToString('yyyyMMdd_HHmmss') + '_' + [Guid]::NewGuid().ToString('N').Substring(0,8)) }
function SafeText([string]$Text, [int]$Max = 700) { if ([string]::IsNullOrWhiteSpace($Text)) { return '' }; $t = ($Text -replace '[\x00-\x08\x0B\x0C\x0E-\x1F]', ' ').Trim(); if ($t.Length -gt $Max) { return $t.Substring(0,$Max).Trim() }; return $t }
function HtmlText([string]$Text) { return [Net.WebUtility]::HtmlEncode((SafeText $Text 500)) }
function RelativeUrl([string]$Path) { $full = [IO.Path]::GetFullPath($Path); if (-not $full.StartsWith($rootPath, [StringComparison]::OrdinalIgnoreCase)) { throw 'output_path_outside_root' }; return '/' + $full.Substring($rootPath.Length).Replace('\','/') }
function CreativePaths { $img=Join-Path $creativeOutputRoot 'images'; $vid=Join-Path $creativeOutputRoot 'videos'; $hf=Join-Path $creativeOutputRoot 'hyperframes'; Ensure-Directory $img; Ensure-Directory $vid; Ensure-Directory $hf; return @{ Images=$img; Videos=$vid; Hyperframes=$hf } }

function BuildImagePrompt($Payload) {
    $inputText = SafeText ([string]$Payload.input) 900
    $style = SafeText ([string]$Payload.style) 80
    $platform = SafeText ([string]$Payload.platform) 80
    $usage = SafeText ([string]$Payload.use) 80
    $refs = @($Payload.references) | Where-Object { $_ } | Select-Object -First 3
    $refLine = if ($refs.Count -gt 0) { "Reference context: user selected $($refs.Count) local reference images for composition/color/subject guidance; do not copy protected images." } else { 'No reference images.' }
    $theme = 'brand growth strategy expressed as abstract market signals, product podiums, arrows, data lights, and editorial still life'
    if ($inputText -match 'AI|GEO|搜索|引用|answer|engine') { $theme = 'AI search visibility expressed as abstract glowing knowledge nodes, citation paths, search beams, and brand authority signals' }
    elseif ($inputText -match '品牌|消费|营销|增长') { $theme = 'brand growth expressed as abstract consumer trend signals, product podium shapes, retail momentum, and campaign energy' }
    elseif ($inputText -match '小红书|抖音|内容|爆款|选题') { $theme = 'social content operations expressed as abstract trend sparks, camera-light shapes, and editorial planning energy' }
    $styleLine = 'premium wordless editorial background, cinematic commercial still life, sharp composition, clean negative space'
    if ($style -match '极简|科技') { $styleLine = 'minimal futuristic commercial still life, dark charcoal background, glass prisms, blue and silver light, precise shadows, clean negative space' }
    elseif ($style -match '强视觉|海报|潮流') { $styleLine = 'bold wordless abstract 3D scene, dramatic lighting, layered geometric objects, cobalt blue and warm red accents, strong visual impact, blank title area' }
    elseif ($style -match '商业|质感|品牌') { $styleLine = 'premium brand campaign still life, sophisticated materials, elegant contrast, restrained colors, product-launch energy' }
@"
Create one polished image background only.
Theme: $theme
Use case: $usage
Target platform: $platform
Visual style: $styleLine
$refLine
Hard requirements: no text, no letters, no Chinese characters, no numbers, no fake words, no typography, no captions, no labels, no logo, no website, no dashboard, no app interface, no document, no paper, no white card, no poster layout, no packaging, no label stickers, no people, no faces, no animals, no public figures, no protected characters. Leave a clean upper-left blank area for later headline overlay. Make it useful as a Xiaohongshu or Douyin cover background: premium, practical, modern, commercial, not generic AI art, not purple-dominated, not childish, not a cheap template.
"@
}

function Get-CreativeImageSize($Payload) {
    $platform = SafeText ([string]$Payload.platform) 80
    $usage = SafeText ([string]$Payload.use) 80
    if ($platform -match '小红书|抖音|视频号' -or $usage -match '封面|长图') { return @{ Width=1024; Height=1536 } }
    return @{ Width=1024; Height=1024 }
}

function Get-ChromePath {
    $candidates = @(
        (Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe'),
        (Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'),
        (Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe'),
        (Join-Path $env:USERPROFILE '.cache\hyperframes\chrome\chrome-headless-shell\win64-131.0.6778.85\chrome-headless-shell-win64\chrome-headless-shell.exe')
    )
    foreach ($candidate in $candidates) { if (Test-Path -LiteralPath $candidate -PathType Leaf) { return $candidate } }
    throw 'missing_chrome_for_local_image_render'
}

function New-PosterTitle([string]$Text) {
    $clean = SafeText $Text 42
    if ([string]::IsNullOrWhiteSpace($clean)) { return 'AI品牌增长行动板' }
    return $clean
}

function New-LocalPosterHtml($Payload, [string]$HtmlPath) {
    $title = HtmlText (New-PosterTitle ([string]$Payload.input))
    $style = HtmlText ([string]$Payload.style)
    $platform = HtmlText ([string]$Payload.platform)
    $usage = HtmlText ([string]$Payload.use)
    $date = (Get-Date).ToString('MM/dd')
    $html = @"
<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box}body{margin:0;background:#0b0d10;font-family:Arial,'Microsoft YaHei','PingFang SC',sans-serif;color:#111}.poster{width:1024px;height:1536px;position:relative;overflow:hidden;background:#0b0d10;padding:52px 44px}.poster:before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 82% 8%,rgba(29,78,216,.55),transparent 24%),linear-gradient(135deg,#0b0d10 0%,#171717 55%,#0b0d10 100%);opacity:.95}.grain{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:18px 18px;opacity:.25}.tape{position:absolute;right:48px;top:44px;transform:rotate(-7deg);background:#e9d7b0;color:#111;padding:15px 30px;font-weight:900;font-size:34px;letter-spacing:1px;box-shadow:0 8px 0 rgba(0,0,0,.25)}.head{position:relative;color:#f8f1df}.kicker{font-size:26px;color:#d8ae65;font-weight:900;margin-top:88px}.brand{font-size:86px;line-height:.96;font-weight:950;letter-spacing:0;margin-top:4px}.date{font-size:24px;color:#9ca3af;margin-top:14px}.statement{position:relative;background:#f4ead3;margin-top:34px;padding:32px 34px;border:4px solid #111;box-shadow:10px 10px 0 #000;transform:rotate(-1deg);font-size:40px;line-height:1.28;font-weight:950}.grid{position:relative;display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:28px}.card{background:#f6eddc;border:4px solid #111;border-radius:10px;min-height:262px;padding:22px 20px 18px;box-shadow:8px 8px 0 #000}.num{font-size:58px;line-height:1;font-weight:950;font-family:Georgia,serif;float:left;margin-right:14px}.tag{display:inline-block;background:#0f4c9a;color:white;font-size:24px;font-weight:900;padding:7px 14px;border-radius:4px;margin-top:3px}.row{clear:both;display:grid;grid-template-columns:86px 1fr;gap:10px;border-top:1px solid #c8bea9;padding-top:10px;margin-top:13px;font-size:20px;line-height:1.28}.row b{color:#0f4c9a}.icon{position:absolute;right:18px;top:18px;width:54px;height:54px;border:4px solid #111;border-radius:50%;display:grid;place-items:center;font-weight:950;color:#0f4c9a;background:#fff}.bottom{position:relative;margin-top:24px;border:2px solid #f4ead3;border-radius:8px;color:#f8f1df;padding:22px 26px;background:rgba(0,0,0,.48)}.summary{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;border-bottom:1px dashed #6b7280;padding-bottom:18px}.summary div{font-size:23px;font-weight:900}.summary span{display:block;color:#60a5fa;font-size:19px;margin-bottom:4px}.note{display:grid;grid-template-columns:120px 1fr;gap:10px;margin-top:14px;font-size:24px;line-height:1.35}.note b{color:#d8ae65}.mark{position:absolute;color:#f4ead3;font-size:78px;font-weight:100;right:74px;top:210px;transform:rotate(12deg);opacity:.75}.blue-tape{position:absolute;width:82px;height:22px;background:#2157b8;opacity:.85;right:-18px;top:410px;transform:rotate(32deg)}.orange{color:#f97316}.green{color:#22c55e}.purple{color:#8b5cf6}
</style></head><body><main class="poster"><div class="grain"></div><div class="tape">ACTION</div><div class="mark">☆</div><div class="blue-tape"></div><section class="head"><div class="kicker">$date · Creative Workshop</div><div class="brand">创意车间</div><div class="date">$platform / $usage / $style</div></section><section class="statement">$title</section><section class="grid">
<article class="card"><div class="icon">AI</div><div class="num">1</div><div class="tag">核心观点</div><div class="row"><b>判断</b><span>先把趋势翻译成一个能被用户立刻理解的商业判断。</span></div><div class="row"><b>画面</b><span>强主体、少装饰，给标题留下干净空间。</span></div><div class="row"><b>动作</b><span>生成后进入分发与资产库。</span></div></article>
<article class="card"><div class="icon">G</div><div class="num">2</div><div class="tag">增长资产</div><div class="row"><b>用途</b><span>适合做封面、选题图、行动板或案例拆解图。</span></div><div class="row"><b>平台</b><span>小红书、抖音、视频号优先。</span></div><div class="row"><b>标准</b><span>观点清楚，不做空泛科技感。</span></div></article>
<article class="card"><div class="icon">B</div><div class="num">3</div><div class="tag">品牌表达</div><div class="row"><b>风格</b><span>黑白底、纸张质感、蓝色重点、执行板结构。</span></div><div class="row"><b>避免</b><span>假大空、伪文字、乱品牌、模板感。</span></div><div class="row"><b>沉淀</b><span>作为可复用视觉资产。</span></div></article>
<article class="card"><div class="icon">→</div><div class="num">4</div><div class="tag">下一步</div><div class="row"><b>分发</b><span>加入多平台发布队列。</span></div><div class="row"><b>复盘</b><span>记录点击、收藏、评论反馈。</span></div><div class="row"><b>复用</b><span>进入案例库、FAQ、GEO资产。</span></div></article>
</section><section class="bottom"><div class="summary"><div><span class="green">今日先做</span>封面成品</div><div><span>本周重点</span>选题转资产</div><div><span class="purple">长期建议</span>建立视觉库</div></div><div class="note"><b>关键词</b><span>品牌增长 / AI搜索 / 内容工厂 / 可复用资产</span></div><div class="note"><b>风险</b><span>只生成好看图片，不进入分发和复盘，就不能形成增长飞轮。</span></div></section></main></body></html>
"@
    [IO.File]::WriteAllText($HtmlPath, $html, [Text.UTF8Encoding]::new($false))
}

function Invoke-LocalPosterImage($Payload, [string]$OutPath) {
    $htmlPath = [IO.Path]::ChangeExtension($OutPath, '.html')
    New-LocalPosterHtml $Payload $htmlPath
    $chrome = Get-ChromePath
    $fileUrl = (New-Object Uri($htmlPath)).AbsoluteUri
    $args = @('--headless=new','--disable-gpu','--hide-scrollbars','--no-first-run','--no-default-browser-check','--window-size=1024,1536',"--screenshot=$OutPath",$fileUrl)
    $process = Start-Process -FilePath $chrome -ArgumentList $args -NoNewWindow -PassThru -Wait
    if ($process.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $OutPath) -or (Get-Item -LiteralPath $OutPath).Length -lt 1000) { throw 'local_image_render_failed' }
    return $htmlPath
}

function Invoke-CreativeImage($Payload) {
    $paths = CreativePaths; $id = New-CreativeId 'image'; $out = Join-Path $paths.Images "$id.png"
    $provider = Get-SettingValue 'CREATIVE_IMAGE_PROVIDER'; if ([string]::IsNullOrWhiteSpace($provider)) { $provider = 'local' }
    if ($provider -eq 'local') {
        $htmlPath = Invoke-LocalPosterImage $Payload $out
        return @{ ok=$true; type='image'; id=$id; url=(RelativeUrl $out); path=$out; provider='local-html-render'; sourceHtml=$htmlPath; createdAt=(Get-Date).ToString('o') }
    }
    $model = Get-SettingValue 'POLLINATIONS_IMAGE_MODEL'; if ([string]::IsNullOrWhiteSpace($model)) { $model = 'flux' }
    $base = Get-SettingValue 'POLLINATIONS_IMAGE_BASE_URL'; if ([string]::IsNullOrWhiteSpace($base)) { $base = 'https://image.pollinations.ai/prompt' }
    Add-Type -AssemblyName System.Net.Http
    $prompt = [Uri]::EscapeDataString((BuildImagePrompt $Payload))
    $size = Get-CreativeImageSize $Payload
    $url = $base.TrimEnd('/') + '/' + $prompt + '?width=' + $size.Width + '&height=' + $size.Height + '&model=' + [Uri]::EscapeDataString($model) + '&enhance=false'
    $client = [System.Net.Http.HttpClient]::new(); $client.Timeout = [TimeSpan]::FromSeconds(180)
    try {
        $resp = $client.GetAsync($url).GetAwaiter().GetResult()
        $bytes = $resp.Content.ReadAsByteArrayAsync().GetAwaiter().GetResult()
        if (-not $resp.IsSuccessStatusCode) { throw [Exception]::new([Text.Encoding]::UTF8.GetString($bytes)) }
        $contentType = $resp.Content.Headers.ContentType.MediaType
        if ($bytes.Length -lt 1000 -or -not ($contentType -like 'image/*')) { throw "image_response_invalid_content_type:$contentType" }
        [IO.File]::WriteAllBytes($out, $bytes)
        return @{ ok=$true; type='image'; id=$id; url=(RelativeUrl $out); path=$out; model=$model; provider='pollinations'; sourceUrl=$url; createdAt=(Get-Date).ToString('o') }
    } finally { $client.Dispose() }
}

function New-HyperFramesComposition($Payload, [string]$ProjectDir) {
    Ensure-Directory $ProjectDir
    $headline = HtmlText ([string]$Payload.input); if ([string]::IsNullOrWhiteSpace($headline)) { $headline = 'Brand growth content' }; if ($headline.Length -gt 72) { $headline = $headline.Substring(0,72) + '...' }
    $style = HtmlText ([string]$Payload.style); $platform = HtmlText ([string]$Payload.platform); $usage = HtmlText ([string]$Payload.use)
    $html = @"
<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dachuan Creative Video</title><style>
*{box-sizing:border-box}body{margin:0;background:#07111f;color:#f7fbff;font-family:Inter,Arial,sans-serif}[data-composition-id="dachuan-creative"]{width:1080px;height:1920px;overflow:hidden;position:relative;background:radial-gradient(circle at 20% 12%,#0ea5e955 0,transparent 34%),#07111f}.scene{position:absolute;inset:0;padding:132px 92px;display:flex;flex-direction:column;justify-content:center;gap:44px}.scene-2,.scene-3{opacity:0}.tag{width:fit-content;border:2px solid #38bdf8;color:#67e8f9;border-radius:999px;padding:18px 28px;font-size:34px;font-weight:800}.title{font-size:92px;line-height:1.06;font-weight:950;max-width:900px}.copy{font-size:42px;line-height:1.45;color:#d6e7f5;max-width:860px}.panel{border:2px solid #1e3a56;border-radius:34px;padding:38px;background:rgba(8,21,38,.82);box-shadow:0 24px 80px #0008}.metric{font-size:48px;font-weight:900;color:#facc15}.footer{position:absolute;left:92px;right:92px;bottom:96px;display:flex;justify-content:space-between;color:#93a4b8;font-size:30px}</style></head><body>
<div data-composition-id="dachuan-creative" data-width="1080" data-height="1920" data-start="0" data-duration="9" data-track-index="0"><section class="scene scene-1"><div class="tag">$platform - $usage</div><div class="title">$headline</div><div class="copy">Turn a trend into a publishable growth asset with a clear operator point of view.</div></section><section class="scene scene-2"><div class="tag">$style</div><div class="panel"><div class="metric">3-second hook</div><div class="copy">Lead with the conclusion, add one case signal, then end with one action.</div></div></section><section class="scene scene-3"><div class="tag">Dachuan Growth OS</div><div class="title">Ready for distribution and asset library</div><div class="copy">This MP4 was rendered locally by HyperFrames.</div></section><div class="footer"><span>Creative Workshop</span><span>Brand Growth</span></div></div>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script><script>window.__timelines=window.__timelines||{};const tl=gsap.timeline({paused:true});tl.from('.scene-1 .tag',{y:40,opacity:0,duration:.6,ease:'power3.out'},.2);tl.from('.scene-1 .title',{y:70,opacity:0,duration:.7,ease:'expo.out'},.45);tl.from('.scene-1 .copy',{y:40,opacity:0,duration:.5,ease:'power2.out'},.8);tl.to('.scene-1',{opacity:0,duration:.25,ease:'power1.inOut'},3);tl.to('.scene-2',{opacity:1,duration:.01},3.2);tl.from('.scene-2 .tag',{x:-50,opacity:0,duration:.55,ease:'back.out(1.4)'},3.25);tl.from('.scene-2 .panel',{y:80,opacity:0,scale:.96,duration:.65,ease:'power3.out'},3.45);tl.to('.scene-2',{opacity:0,duration:.25,ease:'power1.inOut'},6);tl.to('.scene-3',{opacity:1,duration:.01},6.2);tl.from('.scene-3 .tag',{y:36,opacity:0,duration:.5,ease:'power2.out'},6.25);tl.from('.scene-3 .title',{y:72,opacity:0,duration:.7,ease:'expo.out'},6.45);tl.from('.scene-3 .copy',{y:44,opacity:0,duration:.5,ease:'power2.out'},6.8);tl.from('.footer',{opacity:0,duration:.5,ease:'power1.out'},7.3);window.__timelines['dachuan-creative']=tl;</script></body></html>
"@
    [IO.File]::WriteAllText((Join-Path $ProjectDir 'index.html'), $html, [Text.UTF8Encoding]::new($false))
}

function Invoke-CreativeVideo($Payload) {
    $paths = CreativePaths; $id = New-CreativeId 'video'; $project = Join-Path $paths.Hyperframes $id; $out = Join-Path $paths.Videos "$id.mp4"; New-HyperFramesComposition $Payload $project
    $ffmpegDir = Join-Path $rootPath '.tools\ffmpeg-npm\node_modules\@ffmpeg-installer\win32-x64'; $ffprobeDir = Join-Path $rootPath '.tools\ffmpeg-npm\node_modules\@ffprobe-installer\win32-x64'
    if (-not (Test-Path (Join-Path $ffmpegDir 'ffmpeg.exe'))) { throw 'missing_local_ffmpeg' }; if (-not (Test-Path (Join-Path $ffprobeDir 'ffprobe.exe'))) { throw 'missing_local_ffprobe' }
    $old = $env:Path; $env:Path = "$ffmpegDir;$ffprobeDir;$old"; Push-Location $project
    try { $oldPreference = $ErrorActionPreference; $ErrorActionPreference = 'Continue'; $output = & npx hyperframes render --quality draft --workers 1 --output $out 2>&1; $ErrorActionPreference = $oldPreference; for ($i = 0; $i -lt 16 -and (-not (Test-Path $out) -or (Get-Item $out).Length -le 0); $i++) { Start-Sleep -Milliseconds 500 }; if (-not (Test-Path $out) -or (Get-Item $out).Length -le 0) { throw [Exception]::new(($output -join "`n")) } }
    finally { Pop-Location; $env:Path = $old }
    return @{ ok=$true; type='video'; id=$id; url=(RelativeUrl $out); path=$out; projectPath=$project; createdAt=(Get-Date).ToString('o') }
}

function Resolve-ContentPath([string]$Target) { $requested=$Target.Split('?')[0]; $rel=[Uri]::UnescapeDataString($requested.TrimStart('/')).Replace('/','\'); if([string]::IsNullOrWhiteSpace($rel)){ $rel='index.html' }; $full=[IO.Path]::GetFullPath((Join-Path $rootPath $rel)); if(-not $full.StartsWith($rootPath,[StringComparison]::OrdinalIgnoreCase)){ return $null }; return $full }
function Send($Ctx,[int]$Code,[byte[]]$Body,[string]$Type) { $Ctx.Response.StatusCode=$Code; $Ctx.Response.ContentType=$Type; $Ctx.Response.Headers['Cache-Control']='no-cache'; $Ctx.Response.ContentLength64=$Body.Length; if($Body.Length -gt 0){ $Ctx.Response.OutputStream.Write($Body,0,$Body.Length) }; $Ctx.Response.Close() }

$listener = [Net.HttpListener]::new(); $listener.Prefixes.Add("http://127.0.0.1:$Port/"); $listener.Start()
try {
    while ($listener.IsListening) {
        $ctx = $listener.GetContext(); $path = $ctx.Request.Url.AbsolutePath; $method = $ctx.Request.HttpMethod.ToUpperInvariant()
        try {
            if ($method -eq 'POST' -and $path -eq '/api/creative/image') { $reader=[IO.StreamReader]::new($ctx.Request.InputStream,[Text.Encoding]::UTF8); $payload=$reader.ReadToEnd() | ConvertFrom-Json; Send $ctx 200 (ConvertTo-JsonBytes (Invoke-CreativeImage $payload)) 'application/json; charset=utf-8'; continue }
            if ($method -eq 'POST' -and $path -eq '/api/creative/video') { $reader=[IO.StreamReader]::new($ctx.Request.InputStream,[Text.Encoding]::UTF8); $payload=$reader.ReadToEnd() | ConvertFrom-Json; Send $ctx 200 (ConvertTo-JsonBytes (Invoke-CreativeVideo $payload)) 'application/json; charset=utf-8'; continue }
            $file = Resolve-ContentPath $ctx.Request.RawUrl; if ($null -eq $file -or -not (Test-Path -LiteralPath $file -PathType Leaf)) { if ([string]::IsNullOrWhiteSpace([IO.Path]::GetExtension($path))) { $file=Join-Path $rootPath 'index.html' } else { Send $ctx 404 ([Text.Encoding]::UTF8.GetBytes('Not found')) 'text/plain; charset=utf-8'; continue } }
            $ext=[IO.Path]::GetExtension($file).ToLowerInvariant(); $type=if($mime.ContainsKey($ext)){$mime[$ext]}else{'application/octet-stream'}; Send $ctx 200 ([IO.File]::ReadAllBytes($file)) $type
        } catch { Send $ctx 500 (ConvertTo-JsonBytes @{ ok=$false; error='server_error'; detail=$_.Exception.Message }) 'application/json; charset=utf-8' }
    }
} finally { $listener.Stop() }
