# PDF Template Guide

ไฟล์นี้อธิบายวิธีสร้าง HTML template สำหรับระบบ PDF Generator ของ Mazuma ครบลูป
ตั้งแต่สร้าง template ใหม่ → ทดสอบ → generate จริงผ่าน API

---

## สารบัญ

1. [ภาพรวมระบบ](#1-ภาพรวมระบบ)
2. [โครงสร้าง Template](#2-โครงสร้าง-template)
3. [Layout Conventions](#3-layout-conventions)
4. [Handlebars — Variables & Helpers](#4-handlebars--variables--helpers)
5. [Puppeteer PDF Options](#5-puppeteer-pdf-options)
6. [Assets — Logo & Images](#6-assets--logo--images)
7. [QR Code อัตโนมัติ](#7-qr-code-อัตโนมัติ)
8. [ทดสอบ Template](#8-ทดสอบ-template)
9. [API Reference](#9-api-reference)
10. [Template ตัวอย่างสมบูรณ์](#10-template-ตัวอย่างสมบูรณ์)

---

## 1. ภาพรวมระบบ

```
HTML Template (templates/*.html)
    │
    ▼
Handlebars compile   ← merge {{variables}} จาก data payload
    │
    ▼
Asset inlining       ← /assets/*.css → <style>, /assets/images/* → base64
    │
    ▼
Extract pdf-options  ← <script type="application/pdf-options"> → Puppeteer config
    │
    ▼
Puppeteer (headless Chrome) → PDF Buffer
    │
    ▼
Response: stream (binary) หรือ save to disk (fileUrl)
```

**Stack:** NestJS + Handlebars (template engine) + Puppeteer (headless Chrome)

**Font:** Bai Jamjuree (400/500/600/700) — embed เป็น base64 ใน `assets/pdf-base.css` ไม่ต้องติดตั้ง font ในระบบ

---

## 2. โครงสร้าง Template

### ตำแหน่งไฟล์

```
templates/
├── borrowing-slip.html   → template: "borrowing-slip"
├── service-order.html    → template: "service-order"
└── my-new-doc.html       → template: "my-new-doc"   ← สร้างใหม่
```

ชื่อไฟล์ (ไม่มี `.html`) = ชื่อที่ใช้ใน API field `template`

### โครง HTML พื้นฐาน

```html
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="/assets/pdf-base.css">  <!-- บังคับ: font + conventions -->
  <style>
    body {
      margin-top: 30mm; /* ต้องตรงกับความสูงของ .pdf-header */
    }
    /* styles เพิ่มเติมของ template นี้ */
  </style>
</head>
<body>

  <!-- HEADER: position:fixed — ซ้ำทุกหน้าอัตโนมัติ -->
  <div class="pdf-header">
    <!-- logo, company name, doc title, doc number -->
  </div>

  <!-- CONTENT: scroll ตามเนื้อหา -->
  <div class="content">
    <!-- ข้อมูลทั้งหมด -->
  </div>

  <!-- PAGE 2 (ถ้ามี): ต้องมี padding-top เท่ากับ header height -->
  <div class="page-break"></div>
  <div style="padding-top: 30mm; padding: 0 8mm;">
    <!-- เนื้อหาหน้า 2 -->
  </div>

</body>
</html>
```

### กฎสำคัญ

| กฎ | รายละเอียด |
|----|-----------|
| `<link href="/assets/pdf-base.css">` | **บังคับ** — ถ้าไม่มี จะไม่มี font Bai Jamjuree |
| `body { margin-top: Xmm }` | ต้องตั้งค่าให้ตรงกับ height ของ `.pdf-header` จริง |
| Handlebars ใน comment | **ห้าม** ใช้ `{{...}}` ใน `<!-- -->` — ให้ใช้ `\{{` แทน |
| Page 2+ | ต้องใส่ `padding-top: Xmm` บนแต่ละหน้าเพื่อ clear fixed header |

---

## 3. Layout Conventions

### `.pdf-header` — Fixed Header (ซ้ำทุกหน้า)

```html
<div class="pdf-header">
  <!-- ทุก element ใน div นี้จะปรากฏที่ด้านบนของทุกหน้า -->
  <div style="display:flex; justify-content:space-between; padding: 6px 8mm 0;">
    <div><!-- logo + company --></div>
    <div><!-- doc title + number --></div>
  </div>
  <div style="height:2px; background:#1a9e96;"></div>  <!-- teal divider -->
</div>
```

> **สำคัญ:** `body { margin-top: Xmm }` ต้องตั้งค่าให้เนื้อหาไม่ทับกับ header
> วัด height จริงโดย inspect ที่ `http://localhost:3000`

### `.page-break` — บังคับขึ้นหน้าใหม่

```html
<!-- วางระหว่าง section ที่ต้องการขึ้นหน้าใหม่ -->
<div class="page-break"></div>

<!-- เนื้อหาหน้า 2 ต้องมี padding-top เพื่อ clear header -->
<div style="padding: 30mm 8mm 8mm;">
  ...
</div>
```

### Page Numbers — อัตโนมัติ (Puppeteer)

Page number แสดงที่มุมล่างขวาทุกหน้าโดยอัตโนมัติ รูปแบบ `1 / 3`
ไม่ต้องทำอะไรใน template — ระบบ inject ให้เอง

หากต้องการ custom → ดู [Section 5: Puppeteer PDF Options](#5-puppeteer-pdf-options)

---

## 4. Handlebars — Variables & Helpers

### Variable Substitution

```handlebars
{{variableName}}          ← escape HTML (ปลอดภัย, ใช้ทั่วไป)
{{{variableName}}}        ← raw output (ไม่ escape — ใช้กับ data URI เท่านั้น)
```

### Conditionals

```handlebars
{{#if value}}
  แสดงเมื่อ value เป็น truthy
{{else}}
  แสดงเมื่อ value เป็น falsy
{{/if}}
```

### Loops

```handlebars
{{#each items}}
  <tr>
    <td>{{this.fieldName}}</td>
    <td>{{@index}}</td>      ← index เริ่มจาก 0
    <td>{{inc @index}}</td>  ← index เริ่มจาก 1 (ใช้ helper inc)
  </tr>
{{/each}}
```

### Context scoping

```handlebars
{{#with objectField}}
  {{subField}}    ← เข้าถึง field ใน objectField โดยตรง
{{/with}}
```

---

### Helpers ที่ Register ไว้

#### `dateFormat` — วันที่ ISO → DD/MM/พ.ศ.

```handlebars
{{dateFormat openDate}}
```

| Input | Output |
|-------|--------|
| `"2025-11-10T04:57:19.896Z"` | `10/11/2568` |
| `""` หรือ null | `-` |
| string ที่ไม่ใช่ ISO date | คืนค่าเดิม |

#### `dateTimeFormat` — วันที่ + เวลา ISO → DD/MM/พ.ศ. HH:mm

```handlebars
{{dateTimeFormat updatedAt}}
```

| Input | Output |
|-------|--------|
| `"2025-11-10T13:30:00.000Z"` | `10/11/2568 13:30` |

#### `timeFormat` — เวลา ISO → HH:mm

```handlebars
{{timeFormat workStartTime}}
```

| Input | Output |
|-------|--------|
| `"2025-11-10T05:13:16.538Z"` | `05:13` |
| `""` หรือ null | `-` |

#### `numberFormat` — ตัวเลข → Thai locale

```handlebars
{{numberFormat amount}}        ← 2 ทศนิยม (default)
{{numberFormat amount 0}}      ← ไม่มีทศนิยม
{{numberFormat amount 2}}      ← 2 ทศนิยม (explicit)
```

| Input | Decimals | Output |
|-------|----------|--------|
| `2354` | 2 | `2,354.00` |
| `613.8` | 2 | `613.80` |
| `1000000` | 0 | `1,000,000` |
| null | any | `-` |

#### `valueOrDash` — แสดง `-` สำหรับค่าว่าง

```handlebars
{{valueOrDash fieldName}}
```

| Input | Output |
|-------|--------|
| `"some text"` | `some text` |
| `null` | `-` |
| `undefined` | `-` |
| `""` | `-` |
| `0` | `0` (ไม่ใช่ dash — 0 คือค่าจริง) |

> ถ้าต้องการให้ `0` แสดงเป็น `-` ให้ส่งค่าเป็น `null` จาก backend

#### `checkMark` — Boolean → ✓

```handlebars
{{checkMark item.checked}}
```

| Input | Output |
|-------|--------|
| `true` | `✓` |
| `false` | `` (string ว่าง) |

#### Logic Helpers

```handlebars
{{#if (eq status "active")}}...{{/if}}   ← เท่ากัน
{{#if (gt count 0)}}...{{/if}}           ← มากกว่า
{{inc @index}}                            ← บวก 1 (ใช้ใน loop)
{{#if (or fieldA fieldB)}}...{{/if}}     ← OR
```

---

### ตัวอย่าง Pattern ที่ใช้บ่อย

**ตาราง 4 คอลัมน์ label-value:**
```html
<table style="width:100%; border-collapse:collapse; font-size:12px;">
  <tr>
    <td style="background:#f0faf9; font-weight:600; width:130px; padding:4px 8px; border:1px solid #ddd;">ชื่อลูกค้า</td>
    <td style="padding:4px 8px; border:1px solid #ddd;">{{customerName}}</td>
    <td style="background:#f0faf9; font-weight:600; width:130px; padding:4px 8px; border:1px solid #ddd;">วันที่</td>
    <td style="padding:4px 8px; border:1px solid #ddd;">{{dateFormat openDate}}</td>
  </tr>
</table>
```

**ตารางรายการพร้อม loop:**
```html
<table style="width:100%; border-collapse:collapse; font-size:11.5px;">
  <thead>
    <tr>
      <th style="background:#1a9e96; color:#fff; padding:5px 8px; border:1px solid #138f88;">รายการ</th>
      <th style="background:#1a9e96; color:#fff; padding:5px 8px; border:1px solid #138f88; text-align:right;">จำนวน</th>
      <th style="background:#1a9e96; color:#fff; padding:5px 8px; border:1px solid #138f88; text-align:right;">ราคา</th>
    </tr>
  </thead>
  <tbody>
    {{#each items}}
    <tr>
      <td style="border:1px solid #ccc; padding:4px 8px;">{{this.name}}</td>
      <td style="border:1px solid #ccc; padding:4px 8px; text-align:right;">{{this.qty}}</td>
      <td style="border:1px solid #ccc; padding:4px 8px; text-align:right;">{{numberFormat this.price 2}}</td>
    </tr>
    {{/each}}
  </tbody>
</table>
```

**Signature box:**
```html
<table style="width:100%; border-collapse:collapse; margin-top:16px;">
  <tr>
    <td style="border:1px solid #bbb; padding:6px 8px; text-align:center; width:33%;">
      <div style="height:55px;">
        {{#if signatureUrl}}<img src="{{signatureUrl}}" style="max-height:50px;">{{/if}}
      </div>
      <div style="border-top:1px solid #bbb; padding-top:4px; font-weight:600; font-size:11.5px;">ลายเซ็นลูกค้า</div>
    </td>
    <td style="border:1px solid #bbb; padding:6px 8px; text-align:center; width:33%;">
      <div style="height:55px;"></div>
      <div style="border-top:1px solid #bbb; padding-top:4px; font-weight:600; font-size:11.5px;">ลายเซ็นช่าง</div>
    </td>
  </tr>
</table>
```

---

## 5. Puppeteer PDF Options

เพิ่ม block นี้ **ใน `<body>`** เพื่อ override ค่า default ของ Puppeteer:

```html
<script type="application/pdf-options">
{
  "footerTemplate": "...",
  "headerTemplate": "...",
  "margin": { "top": "0", "right": "0", "bottom": "12mm", "left": "0" },
  "landscape": false,
  "scale": 1,
  "format": "A4"
}
</script>
```

### กฎการทำงาน

- ระบบ parse JSON **หลัง** Handlebars compile → ตัวแปรใน JSON ถูก resolve แล้ว
- block นี้จะ**ถูกลบออก**จาก HTML ก่อนส่งให้ Puppeteer (ไม่ปรากฏใน PDF)
- ถ้าไม่มี block นี้ → ใช้ค่า default: page number อัตโนมัติ มุมล่างขวา, margin bottom 8mm
- options จาก block นี้ **override** ค่า default ของระบบ
- block นี้ใน `<!-- HTML comment -->` จะ**ถูกข้าม** ไม่ถูก parse

### `footerTemplate` และ `headerTemplate`

HTML string ที่ Puppeteer render ใน isolated context — **font Bai Jamjuree ถูก inject อัตโนมัติ**

```json
"footerTemplate": "<div style='font-family: Bai Jamjuree, sans-serif; font-size:9px; color:#555; width:100%; display:flex; justify-content:space-between; padding:0 8mm; box-sizing:border-box;'><span>{{workOrderNo}}</span><span><span class='pageNumber'></span> / <span class='totalPages'></span></span></div>"
```

**Puppeteer built-in classes** ใน footer/headerTemplate:

| Class | ค่าที่ inject |
|-------|-------------|
| `<span class="pageNumber">` | หมายเลขหน้าปัจจุบัน |
| `<span class="totalPages">` | จำนวนหน้าทั้งหมด |
| `<span class="date">` | วันที่ print |
| `<span class="title">` | document title |
| `<span class="url">` | URL |

> **หมายเหตุ:** เมื่อใช้ custom `footerTemplate` หรือ `headerTemplate` ต้องตั้ง `margin.bottom` / `margin.top` ให้มีพื้นที่พอ (แนะนำ ≥ 10mm)

### Options ที่ใช้บ่อย

| Option | Default | ตัวอย่าง |
|--------|---------|---------|
| `margin` | `{ bottom: "8mm" }` | `{ "top":"0", "right":"0", "bottom":"14mm", "left":"0" }` |
| `landscape` | `false` | `true` |
| `scale` | `1` | `0.9` (ย่อ 10%) |
| `format` | `"A4"` | `"A3"`, `"Letter"` |
| `footerTemplate` | auto page number | HTML string |
| `headerTemplate` | `""` (empty) | HTML string |

---

## 6. Assets — Logo & Images

### Logo Mazuma

```html
<img src="/assets/images/mazuma-logo.png" alt="Mazuma" style="height:38px;">
```

ระบบ inline base64 อัตโนมัติ — Puppeteer ไม่ต้องเข้าถึง network

### รูปภาพอื่น

วางไฟล์ใน `assets/images/` แล้วใช้ path:

```html
<img src="/assets/images/filename.png" style="height:40px;">
```

รองรับ: `.png`, `.jpg`, `.jpeg`, `.svg`, `.gif`

### Signature Image (จาก URL ใน data)

```handlebars
{{#if signatureUrl}}
<img src="{{signatureUrl}}" style="max-height:50px; max-width:100%;">
{{/if}}
```

> **หมายเหตุ:** URL จาก data ที่เป็น external URL จะไม่ถูก inline — Puppeteer ต้องเข้าถึง URL นั้นได้เอง (หรือส่งเป็น data URI)

---

## 7. QR Code อัตโนมัติ

ส่ง field `qrCodeContent` ใน data payload → ระบบ generate QR code data URI ให้อัตโนมัติ

**ใน data:**
```json
{ "qrCodeContent": "2511TS000051" }
```

**ใน template:**
```handlebars
{{#if qrCodeDataUri}}
<img src="{{{qrCodeDataUri}}}" style="width:65px; height:65px;">
{{else}}
<div style="width:65px; height:65px; border:1px solid #bbb;"></div>
{{/if}}
```

> ใช้ `{{{triple braces}}}` สำหรับ data URI เสมอ — double braces จะ escape `+`, `=`, `/` ใน base64

---

## 8. ทดสอบ Template

### Preview ใน Browser (ไม่มี variables)

เปิด browser แล้วไปที่:
```
http://localhost:3000/templates/my-new-doc.html
```

ServeStaticModule serve `assets/` ที่ `/assets/` — font และรูปภาพจะ load ถูกต้อง

> เปิด DevTools → Elements เพื่อวัด height ของ `.pdf-header` จริง แล้วนำไปตั้งค่า `body { margin-top: Xmm }`

### ทดสอบ Generate PDF ด้วย curl

**Generate → stream (แสดงใน browser/Postman):**
```bash
curl -s -X POST "http://localhost:3000/pdf/render?output=stream" \
  -H "Content-Type: application/json" \
  -d '{
    "template": "my-new-doc",
    "data": {
      "customerName": "ทดสอบ",
      "openDate": "2025-11-10T00:00:00.000Z"
    }
  }' -o output.pdf
```

**Generate → save to disk (ได้ fileUrl กลับมา):**
```bash
curl -s -X POST "http://localhost:3000/pdf/render" \
  -H "Content-Type: application/json" \
  -d '{"template": "my-new-doc", "data": {...}}'
# Response: { "success": true, "fileName": "...", "fileUrl": "http://...", "fileSize": ... }
```

**ใช้ fixture file:**
```bash
curl -s -X POST "http://localhost:3000/pdf/render?output=stream" \
  -H "Content-Type: application/json" \
  -d "{\"template\":\"my-new-doc\",\"data\":$(cat test/fixtures/my-new-doc.fixture.json)}" \
  -o output.pdf
```

**Test raw HTML (ไม่ต้องสร้าง template file):**
```bash
curl -s -X POST "http://localhost:3000/pdf/render?output=stream" \
  -H "Content-Type: application/json" \
  -d '{
    "html": "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><link rel=\"stylesheet\" href=\"/assets/pdf-base.css\"><style>body{padding:20mm;}</style></head><body><h1>{{title}}</h1><p>{{message}}</p></body></html>",
    "data": { "title": "Hello", "message": "สวัสดีครับ" }
  }' -o test.pdf
```

**Download saved PDF:**
```bash
curl -o file.pdf "http://localhost:3000/pdf/files/my-new-doc-abc123-1234567890.pdf"
```

### Postman

Import `docs/pdf-generator.postman_collection.json` — มี request ตัวอย่างครบสำหรับทั้ง borrowing-slip และ service-order

---

## 9. API Reference

**Base URL:** `http://localhost:3000`

**Auth:** ส่ง header `X-API-Key: <value>` ในโหมด production (ตั้ง env `PDF_API_KEY`)
ในโหมด dev (ไม่ set `PDF_API_KEY`) ไม่ต้องส่ง key

### `POST /pdf/render`

Render PDF จาก named template หรือ raw HTML

**Request Body:**
```json
{
  "template": "borrowing-slip",   // ชื่อ template (ใช้ template หรือ html อย่างใดอย่างหนึ่ง)
  "html": "<!DOCTYPE html>...",    // raw HTML string
  "data": { "key": "value" }       // variables สำหรับ Handlebars (optional)
}
```

**Query Parameters:**

| Parameter | ค่า | ผลลัพธ์ |
|-----------|-----|--------|
| `output=stream` | stream | PDF binary (200) — Content-Type: application/pdf |
| (ไม่ระบุ) | file | บันทึกลง disk → JSON (201) |

**Response เมื่อ save to file (201):**
```json
{
  "success": true,
  "fileName": "borrowing-slip-abc12345-1234567890123.pdf",
  "fileUrl": "http://localhost:3000/pdf/files/borrowing-slip-abc12345-1234567890123.pdf",
  "fileSize": 133308
}
```

### `GET /pdf/files/:fileName`

Download PDF ที่บันทึกไว้ (auto-purge หลัง 24 ชั่วโมง)

### `GET /health`

Health check — ไม่ต้อง auth

---

## 10. Template ตัวอย่างสมบูรณ์

Template นี้แสดง feature ทั้งหมดที่ใช้ได้:

```html
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="/assets/pdf-base.css">
  <style>
    body { margin-top: 28mm; }

    .pdf-header { padding: 6px 8mm 0; }
    .hdr-row    { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:4px; }
    .hdr-left   { display:flex; align-items:center; gap:10px; }
    .hdr-logo   { height:38px; }
    .company-th { font-weight:700; font-size:13px; }
    .company-en { font-weight:600; font-size:11px; color:#444; }
    .doc-title  { font-size:26px; font-weight:700; color:#1a9e96; }
    .doc-no     { font-size:15px; font-weight:700; text-align:right; }
    .hdr-addr   { font-size:10px; color:#555; padding-bottom:5px; }
    .hdr-line   { height:2px; background:#1a9e96; }

    .content    { padding: 6px 8mm 8mm; }
    .info-table { width:100%; border-collapse:collapse; font-size:12px; margin-bottom:10px; }
    .info-table td { border:1px solid #ddd; padding:4px 8px; }
    .lbl        { background:#f0faf9; font-weight:600; white-space:nowrap; width:130px; }
    .items-table { width:100%; border-collapse:collapse; font-size:11.5px; }
    .items-table th { background:#1a9e96; color:#fff; padding:5px 8px; border:1px solid #138f88; }
    .items-table td { border:1px solid #ccc; padding:4px 8px; }
  </style>
</head>
<body>

<!-- FIXED HEADER -->
<div class="pdf-header">
  <div class="hdr-row">
    <div class="hdr-left">
      <img src="/assets/images/mazuma-logo.png" class="hdr-logo" alt="Mazuma">
      <div>
        <div class="company-th">บริษัท มาซูม่า เซอร์วิส จำกัด</div>
        <div class="company-en">MAZUMA SERVICE CO., LTD.</div>
      </div>
    </div>
    <div>
      <div class="doc-title">ชื่อเอกสาร</div>
      <div class="doc-no">{{documentNo}}</div>
    </div>
  </div>
  <div class="hdr-addr">
    1296/9-10 ถนนกรุงเทพ-นนทบุรี แขวงบางซื่อ เขตบางซื่อ กรุงเทพฯ 10800
  </div>
  <div class="hdr-line"></div>
</div>

<!-- CONTENT -->
<div class="content">

  <!-- Info Table -->
  <table class="info-table">
    <tr>
      <td class="lbl">ชื่อลูกค้า</td>
      <td>{{customerName}}</td>
      <td class="lbl">วันที่</td>
      <td>{{dateFormat openDate}}</td>
    </tr>
    <tr>
      <td class="lbl">หมายเหตุ</td>
      <td colspan="3">{{valueOrDash remark}}</td>
    </tr>
  </table>

  <!-- Items loop -->
  <table class="items-table">
    <thead>
      <tr>
        <th>ที่</th>
        <th>รายการ</th>
        <th style="text-align:right;">จำนวน</th>
        <th style="text-align:right;">ราคา</th>
      </tr>
    </thead>
    <tbody>
      {{#each items}}
      <tr>
        <td style="text-align:center; width:30px;">{{inc @index}}</td>
        <td>{{this.name}}</td>
        <td style="text-align:right; width:60px;">{{this.qty}}</td>
        <td style="text-align:right; width:80px;">{{numberFormat this.price 2}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>

</div>

<!-- OPTIONAL: Custom footer with Handlebars variable resolved -->
<script type="application/pdf-options">
{
  "footerTemplate": "<div style='font-family:Bai Jamjuree,sans-serif;font-size:9px;color:#555;width:100%;display:flex;justify-content:space-between;padding:0 8mm;box-sizing:border-box;'><span>{{documentNo}}</span><span><span class='pageNumber'></span> / <span class='totalPages'></span></span></div>",
  "margin": { "top": "0", "right": "0", "bottom": "12mm", "left": "0" }
}
</script>

</body>
</html>
```

**Data payload ที่ตรงกัน:**
```json
{
  "template": "my-new-doc",
  "data": {
    "documentNo": "2025-TEST-001",
    "customerName": "สมชาย ใจดี",
    "openDate": "2025-11-10T00:00:00.000Z",
    "remark": null,
    "items": [
      { "name": "รายการ A", "qty": 2, "price": 500 },
      { "name": "รายการ B", "qty": 1, "price": 1200 }
    ]
  }
}
```

---

## Checklist ก่อน Deploy Template

- [ ] มี `<link rel="stylesheet" href="/assets/pdf-base.css">`
- [ ] `body { margin-top }` ตรงกับ height จริงของ `.pdf-header`
- [ ] ไม่มี `{{...}}` ใน HTML comment (`<!-- -->`) — ใช้ `\{{` แทน
- [ ] Page 2+ มี `padding-top` เพื่อ clear fixed header
- [ ] `{{{triple braces}}}` สำหรับ data URI (QR code, signature)
- [ ] ทดสอบกับข้อมูลจริงที่มี `null`/ค่าว่าง → ตรวจว่า `valueOrDash` ทำงานถูก
- [ ] ทดสอบกับ parts/items จำนวนมาก → header ซ้ำทุกหน้า, page number ถูกต้อง
- [ ] เพิ่ม fixture ใน `test/fixtures/my-new-doc.fixture.json`
- [ ] อัพเดท Postman collection ใน `docs/pdf-generator.postman_collection.json`
