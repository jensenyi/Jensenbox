# Jensenbox Shared Language

This file defines the words used across product copy, code, issues, tests, and AI-assisted development. Prefer these terms instead of inventing synonyms.

## Product

- **Jensenbox**: The open-source product and repository.
- **Dachuan Growth OS**: The operating method implemented by Jensenbox.
- **Content Factory**: The complete user workflow, not a separate marketing page or management dashboard.
- **Run**: One traceable content-production cycle from signal input to reusable asset. A run is not a status ceremony.

## Core Objects

- **Signal**: A public, source-linked fact, discussion, case, trend, or user question. A signal is not yet a publishable idea.
- **Opportunity**: A signal with a clear audience problem, business mechanism, and usable content angle.
- **Topic**: An approved opportunity with a title, viewpoint, platform, audience, and intended action.
- **Script**: Platform-ready content copy produced from an approved topic.
- **Creative**: A real generated image or video with a previewable asset URL or local path. Text advice is not a creative.
- **Distribution Item**: A reviewed creative and its platform copy waiting for human-approved publishing.
- **Asset**: A saved, reusable output with provenance, type, date, and intended reuse. Temporary output is not automatically an asset.
- **Growth Asset**: An asset that can improve future discovery, conversion, production speed, or decision quality.
- **GEO Asset**: A source-backed FAQ, entity description, case, method, or answer designed to be understandable and citable by AI search systems.
- **Review**: Evidence-based comparison between expected and observed performance, ending in one keep/change/stop decision.

## Product Areas

- **Intelligence and Topic Pool** (`/intelligence`): Turns public signals into ranked opportunities and topics.
- **Script Workshop** (`/production`): Produces and edits scripts, titles, hooks, platform versions, and risk checks.
- **Creative Workshop** (`/creative-workshop`): Generates real image/video outputs from text, platform settings, style, and up to three references.
- **Creative Community** (`/creative-community`): A read-first feed of automatically collected public Chinese brand and platform discussions. Users curate; they do not manually populate the feed.
- **Multi-platform Distribution** (`/distribution`): Prepares approved outputs for publishing. Publishing remains human-confirmed.
- **Content Asset Library** (`/assets`): Stores reusable scripts, creatives, cases, templates, and GEO assets.
- **Analytics** (`/analytics`): Records results and converts learning into the next decision.

## State Language

Use only states that change what the user can do:

- `draft`: editable and incomplete.
- `ready`: meets the minimum inputs for the next action.
- `generating`: a real generation job is running.
- `completed`: a usable output exists.
- `failed`: the action failed and exposes a reason plus retry path.
- `approved`: Dachuan explicitly allowed the next external action.
- `archived`: retained for history but removed from active work.

Avoid vague states such as `processing soon`, `AI ready`, `system healthy`, or decorative progress steps that do not control behavior.

## Non-negotiable Boundaries

- Public signals are leads, not verified facts; preserve source and capture time.
- No automatic social publishing, account login, private-cookie access, or private-platform scraping without explicit approval and a reviewed integration.
- No image or video is labeled completed unless a real file or playable/renderable URL exists.
- AI suggestions never replace source verification, risk review, or human publishing approval.
- Business value > growth value > brand asset value > technical novelty.

