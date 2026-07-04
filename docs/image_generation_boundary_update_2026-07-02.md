# Image Generation Boundary Update - 2026-07-02

## Decision

Creative Workshop now uses local HTML-to-PNG rendering as the default no-key image generation path. Pollinations remains an optional experimental provider.

## Rules

1. Codex or ChatGPT image2 is an in-chat tool capability, not a stable local web API that Dachuan Growth OS can call with a key.
2. The Creative Workshop web app must not describe "Codex image2 direct API access" as an implemented backend.
3. Default no-key image generation uses `/api/creative/image`, backed by local Chrome HTML-to-PNG rendering.
4. Pollinations can be enabled only as an optional provider by setting `CREATIVE_IMAGE_PROVIDER=pollinations`.
5. Generated image files are saved under `outputs/creative-workshop/images`.
6. image2 can still be used as a high-quality semi-automatic Jarvis/CPA channel: Jarvis generates the asset in Codex, then writes the finished file back to the D drive asset library.
7. If a provider is unavailable, the UI must show a real failure state instead of pretending a prompt plan is a finished image.

## Current Verification

- Local server: `http://127.0.0.1:4175`
- Verified endpoint: `POST /api/creative/image`
- Default provider: `local-html-render`
- Optional provider: `pollinations`
- Verified output directory: `D:\CodexOutputs\Dachuan_Growth_OS\outputs\creative-workshop\images`
