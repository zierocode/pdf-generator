# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

In-house PDF generation service for Mazuma Service Co., Ltd., replacing CraftMyPDF.
Generates Thai-language PDF documents (ใบยืมสินค้า, ใบสั่งงานบริการ) via REST API.

**Stack:** NestJS 11 + TypeScript (nodenext) + Puppeteer + Handlebars

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

**Quick test with curl:**
```bash
curl -X POST http://localhost:3000/pdf/borrowing-slip \
  -H "Content-Type: application/json" \
  -d @test/fixtures/borrowing-slip.fixture.json

curl -X POST "http://localhost:3000/pdf/service-order?output=stream" \
  -H "Content-Type: application/json" \
  -d @test/fixtures/service-order.fixture.json -o test.pdf
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

## API Contract

| Method | Endpoint | Behavior |
|--------|----------|----------|
| POST | `/pdf/borrowing-slip` | Save file → JSON `{ success, fileName, fileUrl, fileSize }` (201) |
| POST | `/pdf/borrowing-slip?output=stream` | PDF binary stream (200) |
| POST | `/pdf/service-order` | Save file → JSON (201) |
| POST | `/pdf/service-order?output=stream` | PDF binary stream (200) |
| GET | `/pdf/files/:fileName` | Download saved PDF |

## Gotchas

- **ValidationPipe `whitelist: true`** strips undeclared fields — every template field must exist in the DTO or it silently disappears
- **`@IsOptional()` + `@IsNumber()`** on nullable fields (e.g., `free`, `returned`) — class-transformer preserves `null` from JSON correctly
- **Thai dates** use Buddhist era (พ.ศ.) = Gregorian year + 543
- **CSS `position: absolute`** for `.page-footer` (not `fixed`) — Puppeteer PDF treats `fixed` as appearing on ALL pages
- **`.page-break`** uses `page-break-before: always` (not `after`) for correct multi-page rendering
- **Teal brand color** `#1a9e96` for `.doc-title` — matches Mazuma brand identity
- **zsh glob expansion** — URLs with `?` in curl must be quoted: `"http://localhost:3000/pdf/service-order?output=stream"`
