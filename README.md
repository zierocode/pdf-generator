# PDF Generator — Mazuma Service

In-house PDF generation service replacing CraftMyPDF for Mazuma Service Co., Ltd.

Built with NestJS + Puppeteer + Handlebars.

## Templates

| Template | Description | Pages |
|---|---|---|
| `borrowing-slip` | ใบยืมสินค้า/อะไหล่ | 1 |
| `service-order` | ใบสั่งงานบริการ | 2 |

## Tech Stack

- **NestJS 11** — API framework
- **Puppeteer** — Headless Chrome for HTML-to-PDF
- **Handlebars** — Template engine (.hbs)
- **Bai Jamjuree** — Thai font (embedded as base64)
- **class-validator / class-transformer** — DTO validation

## Quick Start

```bash
npm install
npm run start:dev
```

Server runs at `http://localhost:3000`.

## API Endpoints

### Generate PDF (save to file — default)

```
POST /pdf/borrowing-slip
POST /pdf/service-order
```

Returns JSON:
```json
{
  "success": true,
  "fileName": "borrowing-slip-2511BR000245-a1b2c3d4-1700000000000.pdf",
  "fileUrl": "http://localhost:3000/pdf/files/borrowing-slip-...",
  "fileSize": 148200
}
```

### Generate PDF (stream)

```
POST /pdf/borrowing-slip?output=stream
POST /pdf/service-order?output=stream
```

Returns PDF binary directly (`Content-Type: application/pdf`).

### Download saved PDF

```
GET /pdf/files/:fileName
```

## File Storage

- Saved to `output/` directory with unique filenames (UUID + timestamp)
- Auto-purge: files older than 24 hours are deleted automatically
- Path traversal protection built-in

## Project Structure

```
src/
  modules/pdf/
    pdf.module.ts
    pdf.controller.ts          # API endpoints
    pdf.service.ts             # PDF generation logic
    browser-pool.service.ts    # Puppeteer lifecycle + crash recovery
    template-renderer.service.ts  # Handlebars compilation + helpers
    file-storage.service.ts    # File save/purge/resolve
    dto/                       # Request validation
    interfaces/                # TypeScript interfaces
    templates/
      borrowing-slip.hbs       # ใบยืมสินค้า
      service-order.hbs        # ใบสั่งงานบริการ
      partials/
        header.hbs             # Shared header (logo + company + title)
        styles.hbs             # Shared CSS + @font-face
assets/
  fonts/Bai Jamjuree/          # TTF fonts (Regular, SemiBold, Bold)
  images/mazuma-logo.png       # Company logo
docs/
  pdf-generator.postman_collection.json
  pdf-generator.postman_environment.json
test/fixtures/                 # Sample request payloads
```

## Handlebars Helpers

| Helper | Description | Example |
|---|---|---|
| `dateFormat` | ISO → DD/MM/Buddhist Year | `{{dateFormat openDate}}` → `18/11/2568` |
| `dateTimeFormat` | ISO → DD/MM/YYYY HH:mm | `{{dateTimeFormat openDate}}` |
| `numberFormat` | Locale number formatting | `{{numberFormat price 2}}` → `1,000.00` |
| `valueOrDash` | Show `-` for null/empty | `{{valueOrDash field}}` |
| `or` | Logical OR | `{{or fieldA fieldB}}` |

## Docker

```bash
docker build -t pdf-generator .
docker run -p 3000:3000 pdf-generator
```

## Postman

Import collection and environment from `docs/`:
- `pdf-generator.postman_collection.json`
- `pdf-generator.postman_environment.json`

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Server port |
