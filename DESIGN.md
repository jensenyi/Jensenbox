# Jensenbox Design System

Jensenbox is an operating tool for a small brand-growth team. It should feel decisive, editorial, and work-focused: strong hierarchy, real outputs, few distractions.

## Design Principles

1. **Work first**: the first screen exposes the next useful action and current working material, not product marketing or system status.
2. **Real output over explanation**: image/video modules prioritize the generated asset; analysis and settings support it.
3. **Dense but calm**: optimize for scanning, comparison, editing, and repeated use.
4. **One surface per job**: do not put cards inside cards or repeat the same status in several panels.
5. **Visible causality**: every button produces a clear state change, result, error, or next step.

## Visual Language

### Core palette

| Token | Value | Use |
|---|---|---|
| `--ink` | `#0A0D10` | Primary dark surface and text on light backgrounds |
| `--paper` | `#F3F0E8` | Editorial light surface |
| `--surface` | `#121820` | Working panels on dark mode |
| `--line` | `#2B3440` | Dividers and control borders |
| `--text` | `#F7F8FA` | Primary text on dark surfaces |
| `--muted` | `#98A4B3` | Secondary text |
| `--signal-blue` | `#2F7DFF` | Primary action and selected state |
| `--success` | `#2EB67D` | Completed/safe state |
| `--warning` | `#F2B84B` | Needs review |
| `--danger` | `#E85D68` | Failure or destructive action |

Use blue as an action signal, not as the entire atmosphere. Warm paper surfaces may carry editorial reports and posters. Do not use purple-blue gradients, glow orbs, bokeh, or decorative glassmorphism.

### Typography

- UI: `HarmonyOS Sans SC`, `PingFang SC`, `Microsoft YaHei`, `Segoe UI`, sans-serif.
- Data/code: `Cascadia Code`, `SFMono-Regular`, Consolas, monospace.
- Page title: 32px/40px desktop, 26px/34px mobile.
- Section title: 20px/28px.
- Body: 15px/24px.
- Label/meta: 13px/20px.
- Letter spacing is `0`; never scale font size with viewport width.

### Shape and spacing

- Base spacing unit: 8px.
- Controls: 40px minimum height; icon buttons: 40x40px stable box.
- Cards and panels: maximum 8px radius.
- Inputs and buttons: 6px radius.
- Pills are reserved for tags, status, and segmented controls; ordinary commands are not pills.
- Shadows are subtle and functional. Prefer borders and spacing for hierarchy.

## Layout

- Desktop: stable left navigation, one primary workspace, optional right context panel only when it contains actionable context.
- Do not show a right panel containing decorative run IDs, fake health, or repeated workflow status.
- Creative Workshop: controls on the left; real image/video result on the right; result area stays visible and dimensionally stable while loading.
- Creative Community: feed/list first, source and capture time visible, filters above results, detail opens without losing list position.
- Mobile: one column, compact top navigation, sticky primary action only when it does not cover content.
- Every fixed-format preview declares an aspect ratio so loading and result states do not shift layout.

## Components

- Use icons for familiar tools: upload, remove, retry, download, save, distribute, filter, search.
- Use text or icon+text for clear commands such as Generate, Approve, Add to distribution.
- Use tabs for sibling views, segmented controls for image/video modes, toggles for binary settings, and selects/menus for option sets.
- Every icon-only control has an accessible label and tooltip.
- Empty states state what is missing and offer one relevant action.
- Loading states preserve layout and name the active operation.
- Error states show the cause when known and a retry or recovery path.

## Module Rules

### Script Workshop

- Editing surface is primary; generated suggestions remain editable.
- Show title, hook, body, platform adaptation, CTA, and risk notes as distinct editable sections.
- Do not present an 11-step process board as the main experience.

### Creative Workshop

- Support text input, style, target platform, aspect ratio, and up to three reference images.
- A completed result must render an actual image or playable video.
- Analysis is collapsible supporting context, never a substitute for generation.
- Completed assets expose Save to library and Add to distribution.

### Creative Community

- Clearly separate source text, system summary, inferred opportunity, and Dachuan's saved note.
- Show source platform, source link, author when public, capture time, and verification state.
- Never manufacture engagement metrics or present demo data as live data.

## Accessibility and Quality Gate

- Maintain WCAG AA contrast for text and controls.
- All workflows are keyboard reachable with visible focus.
- Text wraps without clipping at 320px width and common desktop widths.
- Hover must not resize controls or move surrounding layout.
- Before release, verify desktop and mobile screenshots, browser console, failed network requests, empty/loading/error states, and the complete user path being changed.

## Anti-patterns

- No nested cards, giant rounded containers, gradient hero panels, decorative status dashboards, or unexplained AI labels.
- No feature description inside the live product when the interface can make the action obvious.
- No fake completion state, placeholder output presented as a generated asset, or button that only changes its label.
- No direct imitation of a third-party brand's trademarked visual identity. External DESIGN.md references are inspiration, not templates to ship unchanged.

