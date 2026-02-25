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
| `?output=html` | Return rendered HTML (200) — browser preview, looks identical to PDF |

### `GET /pdf/preview/:template`
Browser preview — renders template with `test/fixtures/<template>.fixture.json` as data and returns HTML. No auth required. Open directly in browser for fast layout iteration.

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

# HTML preview → open in browser (looks identical to PDF)
curl -X POST "http://localhost:3000/pdf/render?output=html" \
  -H "Content-Type: application/json" \
  -d "{\"template\":\"borrowing-slip\",\"data\":$(cat test/fixtures/borrowing-slip.fixture.json)}" \
  > preview.html && open preview.html

# Raw HTML
curl -X POST http://localhost:3000/pdf/render \
  -H "Content-Type: application/json" \
  -d @/tmp/my-template.json
```

## Template System

### Conventions

**Multi-page layout pattern** — outer `<table>` with `<thead>` repeating the document header natively on every page. No `position: fixed` tricks needed.

```html
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="/assets/pdf-base.css">  <!-- inlined server-side -->
  <style>
    /* ── Config block: edit knobs here ── */
    :root {
      --pg-h:      8mm;   /* left/right padding for header, content, footer */
      --pg-bottom: 20mm;  /* ⚠ SYNC with @page below AND pdf-options margin.bottom */
      --brand:     #1a9e96;
      /* font sizes, colors, column widths … */
    }

    /* Outer table: <thead> repeats the document header on every printed page */
    .page-layout  { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .page-header  { padding: 6mm var(--pg-h) 0 var(--pg-h); }
    .page-content { padding: 4mm var(--pg-h) 8mm var(--pg-h); vertical-align: top; }

    @media print {
      /* ⚠ SYNC: keep equal to --pg-bottom AND pdf-options margin.bottom */
      @page { margin-bottom: 20mm; }
      /* prevent data rows from splitting across pages */
      .items-table tbody tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>

  <table class="page-layout">
    <thead>
      <tr><td class="page-header">
        <!-- logo, company name, doc title, doc number — repeats on every page -->
      </td></tr>
    </thead>
    <tbody>
      <tr><td class="page-content">
        <!-- all document content: info table, section headings, data table -->
        <p>{{variableName}}</p>
        <table class="items-table">
          <thead><tr><!-- column headers — also repeat via nested thead --></tr></thead>
          <tbody>{{#each items}}<tr>...</tr>{{/each}}</tbody>
        </table>
      </td></tr>
    </tbody>
  </table>

  <!-- Optional: override Puppeteer PDF options (Handlebars variables resolved before extraction) -->
  <!-- ⚠ margin.bottom, footer font-size, padding-right must SYNC with :root CSS vars above -->
  <script type="application/pdf-options">
  {
    "margin": { "top": "0", "right": "0", "bottom": "20mm", "left": "0" },
    "footerTemplate": "<div style='font-family:\"Bai Jamjuree\",sans-serif;font-size:14px;width:100%;text-align:right;padding-right:8mm;box-sizing:border-box;'><span class='pageNumber'></span> / <span class='totalPages'></span></div>"
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
- CSS `var()` does **not** work inside `@page {}` rules or the pdf-options JSON block — hardcode those values and mark with `⚠ SYNC` comments

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
- **Outer `<table>` layout** — `<thead>` holds the document header (logo, company, doc number); browser repeats it natively on every printed page via `table-header-group`. No `position: fixed` needed. `<tbody>` holds all content in one `<td>`. Nested `<thead>` inside data tables also repeats column headers automatically. Page footer is handled by Puppeteer's `displayHeaderFooter` via `footerTemplate`.
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
- **Bottom margin must be set in TWO places** — `@page { margin-bottom: Xmm }` (CSS, tells Chrome layout engine) AND `"margin": { "bottom": "Xmm" }` in pdf-options JSON (tells Puppeteer footer area). If only one is set, content overflows into the footer. Mark both with `⚠ SYNC`.
- **CSS `var()` in `@page` doesn't work** — `@page { margin-bottom: var(--foo) }` is not supported in Chrome. Hardcode the value and rely on the `⚠ SYNC` comment pattern.
- **Thai dates** — Buddhist era = Gregorian + 543. Use `{{dateFormat}}` helper.
- **zsh glob** — quote URLs containing `?`: `"http://localhost:3000/pdf/render?output=stream"`
- **Template reload** — templates compile at server startup. Restart to pick up new/renamed files.
- **Teal brand** — `#1a9e96`
