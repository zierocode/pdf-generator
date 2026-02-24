# PDF Generator — Mazuma Service

In-house PDF generation service replacing CraftMyPDF for Mazuma Service Co., Ltd.

Built with NestJS + Puppeteer + Handlebars + GrapesJS.

## Features

- **Visual Template Editor** — Drag-and-drop editor at `/designer/` with undo/redo/discard (GrapesJS)
- **PDF Generation** — HTML → PDF via headless Chrome (Puppeteer)
- **Thai Text** — Bai Jamjuree font embedded as base64
- **Template Variables** — Handlebars `{{variable}}` substitution
- **Multi-page** — Automatic page breaks for long content
- **Security** — API key auth, Basic Auth for designer, rate limiting, Helmet

## Templates

| Template | Description | Pages |
|---|---|---|
| `borrowing-slip` | ใบยืมสินค้า/อะไหล่ | 1 |
| `service-order` | ใบสั่งงานบริการ | 2 |

## Tech Stack

- **NestJS 11** — API framework
- **Puppeteer** — Headless Chrome for HTML-to-PDF
- **Handlebars** — Template engine (.hbs + visual templates)
- **GrapesJS** — Drag-and-drop visual HTML/CSS editor
- **Bai Jamjuree** — Thai font (embedded as base64)
- **class-validator / class-transformer** — DTO validation
- **Helmet** — Security headers
- **@nestjs/throttler** — Rate limiting
- **@nestjs/config** — Environment variable management

## Quick Start

```bash
npm install
cp .env.example .env  # Edit with your settings
npm run start:dev
```

Server runs at `http://localhost:3000`.

### Dev Mode

Without `PDF_API_KEY` set, all auth is disabled for easy development.

### Production Mode

```bash
# Generate API key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Set in .env
PDF_API_KEY=<generated-key>
DESIGNER_USER=admin
DESIGNER_PASS=<strong-password>
CORS_ORIGINS=https://your-app.com

# Build and run
npm run build
npm start
```

## API Endpoints

All `/pdf/*` and `/api/templates/*` endpoints require `X-API-Key` header in production.

### Health Check

```
GET /health              → { status: "ok", uptime, timestamp }
```

### Visual Template Editor

```
GET /designer/           → Template editor UI (Basic Auth in production)
```

### Template CRUD

```
GET    /api/templates              → List all templates
GET    /api/templates/:id          → Get template by ID
POST   /api/templates              → Create template
PUT    /api/templates/:id          → Update template
DELETE /api/templates/:id          → Delete template
```

### Template PDF Generation

```
POST /api/templates/preview        → Render HTML+CSS to PDF (no save)
POST /api/templates/:id/render     → Render saved template with data to PDF
```

### Legacy HBS PDF Generation (Handlebars templates)

```
POST /pdf/borrowing-slip           → Save file → JSON { fileName, fileUrl }
POST /pdf/borrowing-slip?output=stream → PDF binary directly
POST /pdf/service-order            → Save file → JSON { fileName, fileUrl }
POST /pdf/service-order?output=stream  → PDF binary directly
GET  /pdf/files/:fileName          → Download saved PDF
```

> **Note:** Legacy endpoints use `.hbs` templates with `{{#each}}` loops for dynamic data (multi-page overflow). Visual templates (GrapesJS) use `/api/templates/:id/render`.

## File Storage

- Saved to `output/` directory with unique filenames (UUID + timestamp)
- Auto-purge: files older than 24 hours are deleted automatically
- Path traversal protection built-in

## Security

| Feature | Description |
|---|---|
| **API Key** | `X-API-Key` header on all `/pdf/*` + `/api/templates/*` endpoints |
| **Designer Auth** | HTTP Basic Auth on `/designer/*` |
| **Rate Limiting** | 30 req/60s default (configurable) |
| **Helmet** | Security headers + CSP for GrapesJS CDN |
| **CORS** | Configurable origins via `CORS_ORIGINS` env var |
| **Dev Mode** | All auth disabled when env vars empty |

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Server port |
| `PDF_API_KEY` | _(empty)_ | API key for all endpoints (required in prod) |
| `DESIGNER_USER` | _(empty)_ | Basic auth username for designer UI |
| `DESIGNER_PASS` | _(empty)_ | Basic auth password for designer UI |
| `CORS_ORIGINS` | _(empty)_ | Allowed CORS origins (comma-separated) |
| `THROTTLE_TTL` | `60` | Rate limit window in seconds |
| `THROTTLE_LIMIT` | `30` | Max requests per window |

## Project Structure

```
public/designer/
  index.html                       # GrapesJS visual template editor
src/
  common/
    guards/api-key.guard.ts        # API key authentication
    middleware/designer-auth.middleware.ts  # Basic auth for designer
  modules/pdf/
    pdf.module.ts
    pdf.controller.ts              # Legacy HBS PDF endpoints
    pdf.service.ts                 # PDF generation logic
    template.controller.ts         # Template CRUD + render API
    template-storage.service.ts    # JSON file template storage
    browser-pool.service.ts        # Puppeteer lifecycle + crash recovery
    template-renderer.service.ts   # Handlebars compilation + helpers
    file-storage.service.ts        # File save/purge/resolve
    dto/                           # Request validation
    interfaces/                    # TypeScript interfaces
    templates/
      borrowing-slip.hbs           # ใบยืมสินค้า (legacy)
      service-order.hbs            # ใบสั่งงานบริการ (legacy)
      partials/
        header.hbs                 # Shared header (logo + company + title)
        styles.hbs                 # Shared CSS + @font-face
data/templates/                    # Visual template storage (JSON)
assets/
  fonts/Bai Jamjuree/              # TTF fonts (Regular, SemiBold, Bold)
  images/mazuma-logo.png           # Company logo
docs/
  pdf-generator.postman_collection.json
  pdf-generator.postman_environment.json
test/fixtures/                     # Sample request payloads
```

## Handlebars Helpers

| Helper | Description | Example |
|---|---|---|
| `dateFormat` | ISO → DD/MM/Buddhist Year | `{{dateFormat openDate}}` → `18/11/2568` |
| `dateTimeFormat` | ISO → DD/MM/YYYY HH:mm | `{{dateTimeFormat openDate}}` |
| `timeFormat` | ISO → HH:mm | `{{timeFormat openDate}}` |
| `numberFormat` | Locale number formatting | `{{numberFormat price 2}}` → `1,000.00` |
| `valueOrDash` | Show `-` for null/empty | `{{valueOrDash field}}` |
| `checkMark` | Boolean → ✓ / empty | `{{checkMark checked}}` |
| `eq`, `gt`, `inc`, `or` | Comparison/logic helpers | `{{#if (eq status "open")}}` |

## Docker

```bash
docker build -t pdf-generator .
docker run -p 3000:3000 \
  -e PDF_API_KEY=your-key \
  -e DESIGNER_USER=admin \
  -e DESIGNER_PASS=your-pass \
  pdf-generator
```

## Postman

Import collection and environment from `docs/`:
- `pdf-generator.postman_collection.json`
- `pdf-generator.postman_environment.json`

Set the `apiKey` environment variable to your API key before running requests.
