# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

In-house PDF generation service for Mazuma Service Co., Ltd., replacing CraftMyPDF.
Generates Thai-language PDF documents via REST API.

**Stack:** NestJS 11 + TypeScript (nodenext) + Puppeteer + Handlebars

## Project Structure

```
templates/                        ← HTML templates (edit here)
  borrowing-slip.html             ← ใบยืมสินค้า/อะไหล่
  service-order.html              ← ใบสั่งงานบริการ (2 pages)

assets/
  pdf-base.css                    ← shared fonts + PDF conventions (auto-generated)
  images/mazuma-logo.png
  fonts/Bai Jamjuree/             ← used for pdf-base.css
  fonts/Sarabun Font/             ← available, not currently embedded

scripts/
  build-pdf-base-css.js           ← regenerate assets/pdf-base.css

src/modules/pdf/
  pdf.controller.ts               ← POST /pdf/render, GET /pdf/files/:fileName
  pdf.service.ts                  ← render() with QR auto-generation
  template-renderer.service.ts    ← Handlebars + asset inlining
  browser-pool.service.ts         ← Puppeteer (single instance, crash recovery)
  file-storage.service.ts         ← output/ dir, 24h auto-purge
  pdf.module.ts

test/fixtures/                    ← sample payloads for curl testing
```

## Commands

```bash
npm run start          # Start server (port 3000)
npm run start:dev      # Watch mode
npm run build          # Compile TypeScript
npm run lint           # ESLint + Prettier (auto-fix)

# Regenerate pdf-base.css (run when fonts change)
node scripts/build-pdf-base-css.js

# Docker
docker compose up -d --build   # Build and start
docker compose down             # Stop
docker compose logs -f          # Follow logs
```

## Deployment

- **Docker Compose:** `docker-compose.yml` at project root. Uses `HOST_PORT` (host) → `PORT` (container).
- **CI/CD:** `.github/workflows/deploy.yml` — push to `main` → SSH into VPS → `git pull` + `docker compose up -d --build`.
- **GitHub Secrets required:** `VPS_HOST`, `VPS_USER`, `VPS_PASSWORD`, `VPS_PORT`, `APP_DIR`.

## API

Single endpoint handles everything. Auth: `X-API-Key` header (set `PDF_API_KEY` env var; leave empty to disable in dev).

### `POST /pdf/render`

```jsonc
// Named template
{ "template": "borrowing-slip", "data": { "documentNo": "...", ... } }

// Raw HTML
{ "html": "<!DOCTYPE html>...", "data": { "name": "Test" } }
```

| Query | Behavior |
|---|---|
| (none) | Save PDF to `output/`, return `{ success, fileName, fileUrl, fileSize }` (201) |
| `?output=stream` | Return PDF binary (200) |

### `GET /pdf/files/:fileName`
Download a previously saved PDF (auto-purged after 24h).

### `GET /health`
Health check, no auth.

### curl examples

```bash
# Named template → save file
curl -X POST http://localhost:3000/pdf/render \
  -H "Content-Type: application/json" \
  -d "{\"template\":\"borrowing-slip\",\"data\":$(cat test/fixtures/borrowing-slip.fixture.json)}"

# Named template → stream PDF
curl -X POST "http://localhost:3000/pdf/render?output=stream" \
  -H "Content-Type: application/json" \
  -d "{\"template\":\"service-order\",\"data\":$(cat test/fixtures/service-order.fixture.json)}" \
  --output out.pdf

# Raw HTML
curl -X POST http://localhost:3000/pdf/render \
  -H "Content-Type: application/json" \
  -d @/tmp/my-template.json
```

## Template System

### Conventions

```html
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="/assets/pdf-base.css">  <!-- inlined server-side -->
  <style>
    body { margin-top: 30mm; }  /* must match .pdf-header height */
  </style>
</head>
<body>

  <!-- Header: position:fixed → repeats on every printed page -->
  <div class="pdf-header"> ... </div>

  <!-- Content: page 1 -->
  <p>{{variableName}}</p>
  {{#each items}}<tr>...</tr>{{/each}}

  <!-- Page break -->
  <div class="page-break"></div>

  <!-- Page 2: needs padding-top to clear fixed header -->
  <div style="padding-top: 30mm"> ... </div>

  <!-- Optional: override Puppeteer PDF options (Handlebars variables resolved before extraction) -->
  <script type="application/pdf-options">
  {
    "footerTemplate": "<div style='font-family:Bai Jamjuree,sans-serif;...'>{{documentNo}} <span class='pageNumber'></span>/<span class='totalPages'></span></div>",
    "margin": { "top": "0", "right": "0", "bottom": "12mm", "left": "0" }
  }
  </script>

</body>
</html>
```

**Rules:**
- Never write `{{...}}` or `{{#...}}` inside HTML comments — Handlebars parses them; use `\{{` in comments
- `{{{triplebraces}}}` = unescaped (use for base64 data URIs like `qrCodeDataUri`)
- `<img src="/assets/images/...">` → auto-inlined as base64 before Puppeteer
- `<script type="application/pdf-options">` block is extracted after Handlebars compile and stripped from HTML; Bai Jamjuree font is auto-injected into footer/headerTemplate server-side
- Default page number footer (N / M, bottom-right) is provided automatically when no pdf-options block is present

### Handlebars helpers

| Helper | Usage | Output |
|---|---|---|
| `dateFormat` | `{{dateFormat isoDate}}` | DD/MM/พ.ศ. |
| `dateTimeFormat` | `{{dateTimeFormat isoDate}}` | DD/MM/พ.ศ. HH:mm |
| `timeFormat` | `{{timeFormat isoDate}}` | HH:mm |
| `numberFormat` | `{{numberFormat amount 2}}` | Thai locale, 2 decimals |
| `valueOrDash` | `{{valueOrDash field}}` | `-` if null/empty |
| `checkMark` | `{{checkMark bool}}` | `✓` or `` |
| `inc` | `{{inc @index}}` | index + 1 (1-based loop counter) |
| `eq`, `gt`, `or` | `{{#if (eq a b)}}` | comparison/logic |

### Special variable: `qrCodeDataUri`
If `data.qrCodeContent` is provided, the server auto-generates a QR code and injects `qrCodeDataUri` into the template data. Use as:
```html
{{#if qrCodeDataUri}}
<img src="{{{qrCodeDataUri}}}" width="65" height="65">
{{/if}}
```

### Adding a new template
1. Create `templates/my-template.html`
2. Test: `POST /pdf/render` with `{ "template": "my-template", "data": {...} }`
3. No server restart needed (templates are compiled at startup — restart to pick up new files)

## Render Pipeline

```
POST /pdf/render { template, data }
  → PdfService.render()
      → generate qrCodeDataUri if qrCodeContent in data
      → TemplateRendererService.render(templateName, data)
          → Handlebars compile (merge variables)
          → inlineStylesheets() — <link pdf-base.css> → <style> with embedded fonts
          → inlineImages()      — /assets/images/*.png → base64 data URI
          → extractPdfOptions() — parse <script type="application/pdf-options">, strip from HTML
      → inject @font-face CSS into pdfOptions.footerTemplate / headerTemplate (if present)
      → BrowserPoolService.generatePdf(html, pdfOptions)   — Puppeteer headless Chrome
  → FileStorageService.save() or stream
```

## Key Design Decisions

- **`pdf-base.css`** — Bai Jamjuree fonts embedded as base64 `@font-face`. Served at `/assets/pdf-base.css` for browser preview; inlined as `<style>` tag before Puppeteer (no network needed at render time).
- **`position: fixed`** for `.pdf-header` — Puppeteer repeats it on every printed page. Page footer is handled by Puppeteer's `displayHeaderFooter` (not a CSS `.pdf-footer` element).
- **QR code auto-generation** — `PdfService` checks for `qrCodeContent` in data and generates `qrCodeDataUri` via `qrcode` package before template rendering.
- **Single Puppeteer instance** — reused across requests, auto-reconnects on crash, 30s timeout.
- **`waitUntil: domcontentloaded`** — all assets are inline base64, no network needed.

## Security

- `X-API-Key` header → `PDF_API_KEY` env var. Empty = dev mode (no auth).
- Helmet, rate limiting (30 req/60s), CORS configurable via env vars.
- **Path traversal** — `inlineImages()` uses `startsWith(assetsDir + path.sep)` to prevent `/assets-evil/` bypass; `FileStorageService.resolve()` uses `path.basename()`.
- **Header injection** — `Content-Disposition` label is sanitised (`[^a-zA-Z0-9\-_]` → `_`) before use in HTTP headers.
- **`purgeOldFiles()`** — fully async (`fs.promises`) with per-file try/catch; never crashes the interval on TOCTOU races.

## Gotchas

- **`{{...}}` in HTML comments** — Handlebars parses them even inside `<!-- -->`. Use `\{{` escape in comment docs.
- **`pdf-base.css` must be committed** — it's a generated artifact. Re-run `node scripts/build-pdf-base-css.js` when fonts change.
- **Page 2 content** needs `padding-top: <header-height>` after `.page-break` to clear fixed header.
- **Thai dates** — Buddhist era = Gregorian + 543. Use `{{dateFormat}}` helper.
- **zsh glob** — quote URLs containing `?`: `"http://localhost:3000/pdf/render?output=stream"`
- **Template reload** — templates are compiled at server startup. Restart to pick up new/renamed files.
- **Teal brand** — `#1a9e96`
