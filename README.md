# Dachuan Growth OS

一个面向品牌增长与内容生产的本地工作台。它不是简单的 AI 内容生成器，而是一套把公开信号、选题判断、脚本生产、视觉生成、分发准备和资产沉淀串起来的 Growth OS。

## What It Does

- 汇总品牌、平台、AI 搜索和消费趋势信号
- 把热点转成可执行选题
- 生成短视频脚本、小红书图文、标题钩子和 GEO/FAQ 草稿
- 提供创意车间：文生图、文生视频、本地成品预览、加入分发、保存资产
- 提供创意社区：聚合公开中文信号，转入选题、脚本或创意生产
- 管理多平台分发准备和内容资产库
- 做基础数据复盘，沉淀可复用增长资产

## Core Workflow

```text
public signals
-> opportunity judgment
-> topic selection
-> script workshop
-> creative workshop
-> distribution queue
-> asset library
-> review
-> reusable growth assets
```

## Project Status

This is a local-first MVP.

Implemented:

- Static frontend dashboard
- Local PowerShell server
- Script workshop
- Creative workshop with local image/video output area
- Creative community signal board
- Distribution queue and asset views
- Basic review page

Not included:

- Automatic publishing to social platforms
- Account login, cookies, or private platform scraping
- Hosted backend or cloud database
- Production-grade authentication

## Quick Start

Requirements:

- Windows PowerShell
- Node.js, only for syntax checks and optional tooling
- Chrome or Chrome Headless Shell for local poster rendering
- Optional: HyperFrames and ffmpeg for video rendering

Start the local server:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tools\server.ps1
```

Then open:

```text
http://127.0.0.1:4175/
```

If you start the server from another directory:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File D:\CodexOutputs\Dachuan_Growth_OS\tools\server.ps1
```

## Environment

Copy `.env.example` to `.env.local` for local model settings.

```powershell
Copy-Item .env.example .env.local
```

Never commit `.env.local`.

Supported variables:

```text
OPENAI_API_KEY=
OPENAI_BASE_URL=
OPENAI_MODEL=
CREATIVE_IMAGE_PROVIDER=local
POLLINATIONS_IMAGE_MODEL=flux
POLLINATIONS_IMAGE_BASE_URL=https://image.pollinations.ai/prompt
```

By default, the creative workshop can use local HTML poster rendering without exposing an API key in the browser.

## Repository Structure

```text
app.js                 Frontend app logic
styles.css             UI styling
index.html             Static app shell
tools/server.ps1       Local server and creative generation endpoints
scripts/               Optional refresh and maintenance scripts
data/ui-state.js       Safe demo state for the frontend
prompts/               Agent prompt templates
schemas/               Structured data schemas
docs/                  Product and implementation notes
knowledge/             Selected role and workflow references
growth_assets/         Long-term growth asset examples
review/                Scorecard templates
```

Generated images, videos, run caches, `.env.local`, temporary files, and private local state are intentionally ignored by Git.

## Safety Boundaries

- Do not expose API keys in frontend code.
- Do not upload local `.env.local`.
- Do not commit generated media unless you intentionally want example assets in the repo.
- Treat public community signals as leads, not verified facts.
- Publishing always requires human review.

## Open Source Upload

See [GITHUB_UPLOAD.md](GITHUB_UPLOAD.md) for the exact upload steps.

## License

MIT. See [LICENSE](LICENSE).
