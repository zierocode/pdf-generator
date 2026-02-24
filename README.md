# PDF Generator — Mazuma Service

In-house PDF generation service for Mazuma Service Co., Ltd., replacing CraftMyPDF.
Generates Thai-language PDF documents (ใบยืมสินค้า, ใบสั่งงานบริการ) via REST API.

**Stack:** NestJS 11 · TypeScript · Puppeteer · Handlebars · Bai Jamjuree font (base64 embedded)

---

## Quick Start

```bash
git clone <repo-url>
cd pdf-generator
npm install
npm run start:dev
```

Server starts at `http://localhost:3000`. No `.env` needed for dev — all auth is disabled when env vars are unset.

**Verify:**
```bash
curl http://localhost:3000/health
# → { "status": "ok", "uptime": ..., "timestamp": "..." }
```

---

## Templates

| Template | Description | Pages |
|---|---|---|
| `borrowing-slip` | ใบยืมสินค้า/อะไหล่ | 1 |
| `service-order` | ใบสั่งงานบริการ | 2 |

Template files: `templates/*.html` — edit directly, restart server to reload.

---

## API

### `POST /pdf/render`

Render a named template or raw HTML to PDF.

**Headers:**
- `Content-Type: application/json`
- `X-API-Key: <key>` *(production only — omit in dev when `PDF_API_KEY` is unset)*

**Request body:**

```json
{ "template": "borrowing-slip", "data": { "documentNo": "2511BR000245", "..." } }
```

```json
{ "html": "<!DOCTYPE html>...", "data": { "title": "Test" } }
```

**Query parameters:**

| Parameter | Response |
|---|---|
| *(none)* | `201` — Save PDF to `output/`, return `{ success, fileName, fileUrl, fileSize }` |
| `?output=stream` | `200` — PDF binary (`application/pdf`) |

**Stream example:**
```bash
curl -X POST "http://localhost:3000/pdf/render?output=stream" \
  -H "Content-Type: application/json" \
  -d "{\"template\":\"borrowing-slip\",\"data\":$(cat test/fixtures/borrowing-slip.fixture.json)}" \
  --output borrowing-slip.pdf
```

**Save to file example:**
```bash
curl -X POST http://localhost:3000/pdf/render \
  -H "Content-Type: application/json" \
  -d "{\"template\":\"service-order\",\"data\":$(cat test/fixtures/service-order.fixture.json)}"
# → { "success": true, "fileName": "service-order-abc123-1234567890.pdf", "fileUrl": "http://...", "fileSize": 175000 }
```

---

### `GET /pdf/files/:fileName`

Download a previously saved PDF. Files are auto-purged after 24 hours.

```bash
curl -o result.pdf "http://localhost:3000/pdf/files/service-order-abc123-1234567890.pdf"
```

---

### `GET /health`

Health check — no auth required.

```bash
curl http://localhost:3000/health
```

---

## Creating a New Template

1. Create `templates/my-doc.html` — see `docs/TEMPLATE_GUIDE.md` for full syntax reference
2. Restart the server (templates compile at startup)
3. Test:
   ```bash
   curl -X POST "http://localhost:3000/pdf/render?output=stream" \
     -H "Content-Type: application/json" \
     -d '{"template":"my-doc","data":{"title":"Test"}}' \
     --output test.pdf
   ```
4. Import `docs/pdf-generator.postman_collection.json` into Postman for interactive testing

**Template structure (minimal):**
```html
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="/assets/pdf-base.css">
  <style>body { margin-top: 30mm; }</style>
</head>
<body>
  <div class="pdf-header"><!-- logo + doc title --></div>
  <div class="content">
    <p>{{customerName}}</p>
    <p>{{dateFormat openDate}}</p>
  </div>
</body>
</html>
```

See `docs/TEMPLATE_GUIDE.md` for the complete guide: Handlebars helpers, Puppeteer PDF options, multi-page layout, QR codes, and more.

---

## Handlebars Helpers

| Helper | Usage | Output |
|---|---|---|
| `dateFormat` | `{{dateFormat isoDate}}` | `18/11/2568` (Buddhist year) |
| `dateTimeFormat` | `{{dateTimeFormat isoDate}}` | `18/11/2568 14:30` |
| `timeFormat` | `{{timeFormat isoDate}}` | `14:30` |
| `numberFormat` | `{{numberFormat amount 2}}` | `1,000.00` (Thai locale) |
| `valueOrDash` | `{{valueOrDash field}}` | `-` if null/empty/undefined |
| `checkMark` | `{{checkMark bool}}` | `✓` or empty |
| `inc` | `{{inc @index}}` | 1-based loop counter |
| `eq`, `gt`, `or` | `{{#if (eq a b)}}` | comparison/logic |

**Special:** Pass `qrCodeContent` in `data` → server auto-generates `qrCodeDataUri` for use in template:
```handlebars
{{#if qrCodeDataUri}}<img src="{{{qrCodeDataUri}}}" width="65" height="65">{{/if}}
```

---

## Puppeteer PDF Options

Templates can control all Puppeteer PDF settings by embedding a JSON block in `<body>`:

```html
<script type="application/pdf-options">
{
  "footerTemplate": "<div style='font-family:Bai Jamjuree,sans-serif;font-size:9px;color:#555;width:100%;display:flex;justify-content:space-between;padding:0 8mm;box-sizing:border-box;'><span>{{documentNo}}</span><span><span class='pageNumber'></span> / <span class='totalPages'></span></span></div>",
  "margin": { "top": "0", "right": "0", "bottom": "12mm", "left": "0" }
}
</script>
```

This block is extracted and passed directly to Puppeteer, then stripped from the HTML before rendering. Handlebars variables inside the JSON are resolved before extraction. Bai Jamjuree font is auto-injected into header/footer templates server-side.

**Default (when no block present):** page number `N / M` at bottom-right, `margin.bottom: 8mm`.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Server port |
| `PDF_API_KEY` | *(empty)* | API key for all endpoints — leave empty for dev (no auth) |
| `CORS_ORIGINS` | *(empty)* | Allowed CORS origins (comma-separated) — empty = allow all |
| `THROTTLE_TTL` | `60` | Rate limit window (seconds) |
| `THROTTLE_LIMIT` | `30` | Max requests per window |
| `PDF_MAX_CONCURRENT` | `5` | Max Chrome pages open simultaneously (see sizing guide in `.env.example`) |
| `PDF_MAX_QUEUE` | `20` | Max requests queued while all slots are busy (returns 503 when full) |
| `PDF_QUEUE_TIMEOUT_MS` | `60000` | How long a queued request waits before timing out (ms) |

```bash
cp .env.example .env
```

---

## Production Setup

```bash
# Generate a secure API key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# .env
PDF_API_KEY=<generated-key>
CORS_ORIGINS=https://your-app.com

# Build and start
npm run build
npm start
```

All requests to `POST /pdf/render` and `GET /pdf/files/:fileName` now require `X-API-Key: <key>` header.

---

## Docker

```bash
docker build -t pdf-generator .

docker run -p 3000:3000 \
  -e PDF_API_KEY=your-key \
  -e CORS_ORIGINS=https://your-app.com \
  pdf-generator
```

---

## Project Structure

```
templates/                         ← HTML templates (edit here)
  borrowing-slip.html              ← ใบยืมสินค้า/อะไหล่
  service-order.html               ← ใบสั่งงานบริการ (2 pages)

assets/
  pdf-base.css                     ← shared fonts + CSS (generated — do not edit)
  images/mazuma-logo.png
  fonts/Bai Jamjuree/              ← source TTF files

scripts/
  build-pdf-base-css.js            ← regenerate assets/pdf-base.css (run when fonts change)

src/modules/pdf/
  pdf.controller.ts                ← POST /pdf/render, GET /pdf/files/:fileName
  pdf.service.ts                   ← render() — QR generation + font injection
  template-renderer.service.ts     ← Handlebars compile + asset inlining + pdf-options extraction
  browser-pool.service.ts          ← Puppeteer (single instance, 30s timeout, auto-reconnect)
  file-storage.service.ts          ← output/ dir, UUID + timestamp filenames, 24h auto-purge
  pdf.module.ts

test/fixtures/                     ← sample JSON payloads for curl testing
  borrowing-slip.fixture.json
  service-order.fixture.json

docs/
  TEMPLATE_GUIDE.md                ← full guide: create → test → production
  pdf-generator.postman_collection.json

output/                            ← generated PDFs (auto-purged after 24h, gitignored)
```

---

## Commands

```bash
npm run start:dev      # Dev server (watch mode)
npm run start          # Production server
npm run build          # Compile TypeScript (nest build)
npm run lint           # ESLint + Prettier (auto-fix)
npm test               # Jest unit tests

node scripts/build-pdf-base-css.js   # Regenerate pdf-base.css (after font changes)
```
