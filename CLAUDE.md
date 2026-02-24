# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

In-house PDF generation service for Mazuma Service Co., Ltd., replacing CraftMyPDF.
Generates Thai-language PDF documents (ใบยืมสินค้า, ใบสั่งงานบริการ) via REST API.

**Stack:** NestJS 11 + TypeScript (nodenext) + Puppeteer + Handlebars + GrapesJS

## Commands

```bash
npm run build          # Compile TypeScript (nest build)
npm run start          # Start server (port 3000)
npm run start:dev      # Watch mode
npm run lint           # ESLint + Prettier (auto-fix)
npm run format         # Prettier only
npm test               # Jest unit tests (src/**/*.spec.ts)
npm run test:watch     # Jest watch mode
npm run test:e2e       # E2E tests (test/jest-e2e.json)
```

**Quick test with curl (production mode requires API key):**
```bash
# With API key
curl -X POST http://localhost:3000/api/templates \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_KEY" \
  -d '{"name":"Test","html":"<div>Hello</div>","css":"","projectData":{}}'

# Dev mode (no PDF_API_KEY set) — key not required
curl -X POST http://localhost:3000/pdf/borrowing-slip \
  -H "Content-Type: application/json" \
  -d @test/fixtures/borrowing-slip.fixture.json
```

## Architecture

```
Request → PdfController → PdfService → TemplateRendererService (Handlebars)
                ↓                ↓              ↓
         FileStorageService   BrowserPoolService (Puppeteer)
         (save/resolve/purge)  (single browser, crash recovery)
```

**Flow:** Controller receives DTO → PdfService loads fonts as base64, calls TemplateRenderer to produce HTML → BrowserPoolService renders HTML to PDF via headless Chrome → Controller either saves file (default) or streams binary (`?output=stream`).

All services live in a single module: `src/modules/pdf/pdf.module.ts`.

### Key Design Decisions

- **Font embedding:** Bai Jamjuree TTF fonts loaded as base64 data URIs into `@font-face` — no system font dependency in Puppeteer
- **Template path resolution:** `process.cwd()` first, fallback to `__dirname` — works in both dev (`src/`) and prod (`dist/`)
- **Browser lifecycle:** Single Puppeteer instance reused across requests; `ensureBrowser()` auto-reconnects on crash
- **PDF timeout:** 30s `Promise.race` in `BrowserPoolService` prevents hung Chrome pages
- **waitUntil:** Uses `domcontentloaded` (not `networkidle0`) since all assets are inline base64
- **Service order layout:** Entire page body is ONE `<table class="info-table">` with borders — matches CraftMyPDF original; uses `rowspan` for cost/technician alignment
- **File storage:** UUID + timestamp filenames in `output/`, auto-purge >24h files every hour, path traversal protection via `path.basename()`

## Security & Production

### Authentication

- **API Key Guard** (`src/common/guards/api-key.guard.ts`) — validates `X-API-Key` header on all `/pdf/*` and `/api/templates/*` endpoints. Set `PDF_API_KEY` env var; leave empty to disable (dev mode).
- **Designer Basic Auth** (`src/common/middleware/designer-auth.middleware.ts`) — HTTP Basic Auth on `/designer/*`. Set `DESIGNER_USER` + `DESIGNER_PASS` env vars; leave empty to disable (dev mode).
- **Graceful dev mode:** All auth is optional — when env vars are empty, auth is skipped for local development.

### Security Middleware

- **Helmet** — security headers (CSP configured for GrapesJS CDN resources)
- **Rate limiting** — `@nestjs/throttler` (default: 30 req/60s, configurable via `THROTTLE_TTL`/`THROTTLE_LIMIT`)
- **CORS** — configurable origins via `CORS_ORIGINS` env var (comma-separated); empty = allow all
- **Health check** — `GET /health` (no auth, skips throttle) for monitoring

### Environment Variables

See `.env.example` for all available configuration. Key vars:

| Variable | Required | Description |
|----------|----------|-------------|
| `PDF_API_KEY` | Prod | API key for all PDF/template endpoints |
| `DESIGNER_USER` | Prod | Basic auth username for designer UI |
| `DESIGNER_PASS` | Prod | Basic auth password for designer UI |
| `CORS_ORIGINS` | Prod | Allowed CORS origins (comma-separated) |
| `PORT` | No | Server port (default: 3000) |

## Template System

- Templates: `src/modules/pdf/templates/*.hbs` — copied to `dist/` via `nest-cli.json` assets config
- Partials: `templates/partials/` — `styles.hbs` (shared CSS + @font-face) and `header.hbs` (logo + company + title)
- Fixtures: `test/fixtures/*.fixture.json` — real-shaped test payloads

**Handlebars helpers** (registered in `template-renderer.service.ts`):
- `dateFormat` — ISO → DD/MM/Buddhist year (year + 543). Pass-through for already-formatted strings.
- `dateTimeFormat` — ISO → DD/MM/YYYY HH:mm (Buddhist year)
- `timeFormat` — ISO → HH:mm
- `numberFormat` — Thai locale formatting with configurable decimals
- `valueOrDash` — Returns `-` for null/undefined/empty (explicit checks + string fallback)
- `checkMark` — Boolean → `✓` or empty
- `eq`, `gt`, `inc`, `or` — comparison/logic helpers

## Visual Template Editor (GrapesJS)

- **Designer UI:** `public/designer/index.html` — served at `/designer/` (protected by Basic Auth in prod)
- **Template storage:** `data/templates/*.json` — CRUD via `TemplateStorageService`
- **Template controller:** `src/modules/pdf/template.controller.ts` — REST API + PDF render
- **Seed templates:** `borrowing-slip` and `service-order` — pre-created in `data/templates/`
- **MVP scope:** Designer is locked to the 2 seed templates (no create/delete from UI)

**Editor features:** Undo/Redo (GrapesJS UndoManager), Discard (reload from server), Save (PUT only), Preview PDF, Generate PDF. Toast notifications for user feedback.

**Editor flow:** GrapesJS (drag-and-drop) → Save HTML+CSS+projectData → Load/edit → Preview/Generate PDF

**Render pipeline:** Template HTML → Handlebars compile (merge `{{variables}}`) → Inline `/assets/` URLs as base64 → Inject Bai Jamjuree fonts → Puppeteer PDF

**Key detail:** `projectData` check uses `Object.keys().length > 0` (empty `{}` is truthy) — falls through to HTML/CSS loading when no GrapesJS project data exists.

## API Contract

All `/pdf/*` and `/api/templates/*` endpoints require `X-API-Key` header in production.

| Method | Endpoint | Auth | Behavior |
|--------|----------|------|----------|
| GET | `/health` | None | Health check (skip throttle) |
| POST | `/pdf/borrowing-slip` | API Key | Save file → JSON `{ success, fileName, fileUrl, fileSize }` (201) |
| POST | `/pdf/borrowing-slip?output=stream` | API Key | PDF binary stream (200) |
| POST | `/pdf/service-order` | API Key | Save file → JSON (201) |
| POST | `/pdf/service-order?output=stream` | API Key | PDF binary stream (200) |
| GET | `/pdf/files/:fileName` | API Key | Download saved PDF |
| GET | `/api/templates` | API Key | List all templates (id, name, dates) |
| GET | `/api/templates/:id` | API Key | Get full template (with HTML/CSS/projectData) |
| POST | `/api/templates` | API Key | Create template |
| PUT | `/api/templates/:id` | API Key | Update template |
| DELETE | `/api/templates/:id` | API Key | Delete template |
| POST | `/api/templates/preview` | API Key | Render HTML+CSS to PDF (inline, no save) |
| POST | `/api/templates/:id/render` | API Key | Render saved template with data to PDF |
| GET | `/designer/` | Basic Auth | Visual template editor UI |

## Gotchas

- **Helmet CSP `script-src-attr: 'none'`** — blocks inline event handlers (`onclick`, `onchange` in HTML). Use `addEventListener` in `<script>` blocks instead.
- **CSP `fontSrc`** must include `https://cdnjs.cloudflare.com` for Font Awesome icons in designer UI
- **ValidationPipe `whitelist: true`** strips undeclared fields — every template field must exist in the DTO or it silently disappears
- **`@IsOptional()` + `@IsNumber()`** on nullable fields (e.g., `free`, `returned`) — class-transformer preserves `null` from JSON correctly
- **Thai dates** use Buddhist era (พ.ศ.) = Gregorian year + 543
- **CSS `position: absolute`** for `.page-footer` (not `fixed`) — Puppeteer PDF treats `fixed` as appearing on ALL pages
- **`.page-break`** uses `page-break-before: always` (not `after`) for correct multi-page rendering
- **Two template systems** — Legacy HBS (`.hbs` files, `/pdf/*` endpoints, supports `{{#each}}` loops) vs Visual GrapesJS (JSON in `data/templates/`, `/api/templates/*` endpoints, static HTML). Only legacy supports dynamic multi-row data.
- **Teal brand color** `#1a9e96` for `.doc-title` — matches Mazuma brand identity
- **zsh glob expansion** — URLs with `?` in curl must be quoted: `"http://localhost:3000/pdf/service-order?output=stream"`
- **Dev vs Prod auth** — Leave `PDF_API_KEY`/`DESIGNER_USER`/`DESIGNER_PASS` empty for no-auth dev mode
