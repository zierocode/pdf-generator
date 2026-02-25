# PDF Template Guide — Mazuma Service

คู่มือฉบับสมบูรณ์สำหรับสร้างและปรับแต่ง HTML template ในระบบ PDF Generator
อ่านจบแล้วสามารถทำได้ทุกอย่างโดยไม่ต้องเดา

---

## สารบัญ

1. [Pipeline & Stack](#1-pipeline--stack)
2. [โครงสร้างไฟล์ & Quick Start](#2-โครงสร้างไฟล์--quick-start)
3. [Layout Pattern — Outer Table](#3-layout-pattern--outer-table)
4. [CSS Config Block](#4-css-config-block)
5. [The ⚠ SYNC Pattern](#5-the--sync-pattern)
6. [Handlebars — Variables & Helpers](#6-handlebars--variables--helpers)
7. [Puppeteer PDF Options](#7-puppeteer-pdf-options)
8. [Assets — Logo & Images](#8-assets--logo--images)
9. [QR Code อัตโนมัติ](#9-qr-code-อัตโนมัติ)
10. [ทดสอบ Template](#10-ทดสอบ-template)
11. [API Reference](#11-api-reference)
12. [Complete Template Example](#12-complete-template-example)
13. [Checklist ก่อน Deploy](#13-checklist-ก่อน-deploy)

---

## 1. Pipeline & Stack

```
POST /pdf/render  { template: "my-doc", data: { ... } }
  │
  ▼
PdfService
  ├─ generate qrCodeDataUri  ← ถ้า data มี qrCodeContent
  └─ TemplateRendererService.render(templateName, data)
       ├─ Handlebars compile      ← แทน {{variables}} ด้วยข้อมูลจริง
       ├─ inlineStylesheets()     ← <link /assets/pdf-base.css> → <style> (base64 fonts)
       ├─ inlineImages()          ← <img src="/assets/images/*.png"> → base64 data URI
       └─ extractPdfOptions()     ← parse + ลบ <script type="application/pdf-options">
  │
  ▼
inject Bai Jamjuree @font-face → footerTemplate / headerTemplate (isolated context)
  │
  ▼
BrowserPoolService.generatePdf(html, pdfOptions)  ← Puppeteer headless Chrome
  │
  ▼
stream binary หรือ save to disk → fileUrl
```

**Stack:** NestJS 11 · TypeScript · Puppeteer · Handlebars · Bai Jamjuree (base64 embedded)

**Font:** Bai Jamjuree 400/500/600/700 — embed ใน `assets/pdf-base.css` → ไม่ต้องติดตั้ง font ในระบบ
**Page size:** A4 (210 × 297mm) portrait เป็น default

---

## 2. โครงสร้างไฟล์ & Quick Start

```
templates/
├── borrowing-slip.html    → template: "borrowing-slip"
├── service-order.html     → template: "service-order"
└── my-new-doc.html        → template: "my-new-doc"   ← สร้างใหม่

test/fixtures/
├── borrowing-slip.fixture.json   ← ข้อมูลสำหรับ preview/test
├── service-order.fixture.json
└── my-new-doc.fixture.json       ← สร้างใหม่

assets/
├── pdf-base.css           ← shared fonts (auto-generated — ห้าม edit)
└── images/
    └── mazuma-logo.png
```

**ชื่อไฟล์ (ไม่มี `.html`) = ชื่อที่ใช้ใน API field `template`**

### สร้าง template ใหม่

1. สร้าง `templates/my-new-doc.html` (copy โครงสร้างจาก Section 12)
2. สร้าง `test/fixtures/my-new-doc.fixture.json` ด้วยข้อมูลตัวอย่าง
3. Restart server: `lsof -ti :3000 | xargs kill -9 && node dist/main &`
   *(templates compile ที่ startup — ต้อง restart ทุกครั้งที่สร้างหรือ rename ไฟล์)*
4. Preview: เปิด `http://localhost:3000/pdf/preview/my-new-doc` ใน browser
5. Generate: `curl -X POST "http://localhost:3000/pdf/render?output=stream" ...`

> **Template แก้ไขแล้วต้อง restart server** — ไม่มี hot-reload ที่เชื่อถือได้บน macOS

---

## 3. Layout Pattern — Outer Table

**นี่คือ pattern เดียวที่ถูกต้องสำหรับเอกสารหลายหน้า**

### ทำไมต้อง outer table?

Puppeteer PDF + `position: fixed` มีปัญหาพื้นฐาน: fixed element ถูก shift ด้วย Puppeteer page margin ทำให้การคำนวณ position บนหน้า 2+ ผิดเสมอ

**Solution:** ใช้ CSS table `<thead>` ซึ่งเป็น `display: table-header-group` — browser repeat thead บนทุกหน้าโดย native mechanism ไม่มีการ shift ใดๆ

### โครงสร้าง HTML

```html
<table class="page-layout">
  <thead>
    <tr><td class="page-header">
      <!-- Document header: logo, company, doc title, doc number -->
      <!-- ส่วนนี้จะซ้ำที่ด้านบนของทุกหน้าอัตโนมัติ -->
    </td></tr>
  </thead>
  <tbody>
    <tr><td class="page-content">
      <!-- ข้อมูลทั้งหมด: info table, section headings, data table -->
      <!-- เนื้อหาไหลต่อเนื่องผ่านหลายหน้าโดยอัตโนมัติ -->
    </td></tr>
  </tbody>
</table>
```

### โครงสร้าง CSS ขั้นต่ำ

```css
.page-layout  { width: 100%; border-collapse: collapse; table-layout: fixed; }
.page-header  { padding: 6mm var(--pg-h) 0 var(--pg-h); }
.page-content { padding: 4mm var(--pg-h) 8mm var(--pg-h); vertical-align: top; }
```

### Data table ภายใน

Data table (ตารางรายการ) ที่มี `<thead>` ของตัวเอง จะมี column headers ซ้ำด้วยเช่นกัน:

```html
<table class="items-table">
  <thead>
    <tr><!-- column headers — repeat on every page --></tr>
  </thead>
  <tbody>
    {{#each items}}<tr>...</tr>{{/each}}
  </tbody>
</table>
```

```css
/* ป้องกัน data row ถูกตัดข้ามหน้า */
@media print {
  .items-table tbody tr { page-break-inside: avoid; }
}
```

---

## 4. CSS Config Block

ทุก template ต้องมี config block นี้ที่ด้านบนสุดของ `<style>` เพื่อรวม "knob" ทั้งหมดไว้ในที่เดียว

```css
/* ════════════════════════════════════════════════════════════════
   ░░  TEMPLATE CONFIGURATION — edit this section to tune layout  ░░
   ════════════════════════════════════════════════════════════════
   CSS variables work in all regular rules below.
   Two exceptions where var() is NOT supported:
     • @page rules        → hardcoded, marked ⚠ SYNC
     • pdf-options JSON   → hardcoded, marked ⚠ SYNC
   ════════════════════════════════════════════════════════════════ */
:root {
  /* ── Page geometry ──────────────────────────────────────────── */
  --pg-h:       8mm;   /* left/right padding: header, content, and footer padding-right */
  --pg-top:     6mm;   /* top padding inside page header */
  --pg-bottom:  20mm;  /* ⚠ SYNC → @page { margin-bottom } (below)
                                  → pdf-options "margin.bottom" (JSON block) */

  /* ── Brand ──────────────────────────────────────────────────── */
  --brand:      #1a9e96;  /* teal: header border line, table header tint */
  --th-bg:      #b8dcdb;  /* data table header background */
  --th-border:  #9ccbca;  /* data table header border */
  --row-alt-bg: #f2f7f7;  /* alternating (odd) row background — zebra stripe */

  /* ── Typography ─────────────────────────────────────────────── */
  --font-company:   16px;  /* company name in header */
  --font-doc-title: 28px;  /* document title (large) */
  --font-doc-no:    20px;  /* document number */
  --font-doc-type:  14px;  /* document type label */
  --font-address:   14px;  /* address lines in header */
  --font-body:      14px;  /* info table + data table cells */
  --font-section:   18px;  /* section headings */
  --font-footer:    14px;  /* ⚠ SYNC → pdf-options footerTemplate font-size */
}
```

### วิธีใช้ใน CSS rules

```css
.hdr-border  { background: var(--brand); }
.company-th  { font-size: var(--font-company); }
.parts-table tbody tr:nth-child(odd)  td { background: var(--row-alt-bg); }
.parts-table tbody tr:nth-child(even) td { background: #fff; }
.page-header { padding: var(--pg-top) var(--pg-h) 0 var(--pg-h); }
```

---

## 5. The ⚠ SYNC Pattern

**นี่คือ gotcha สำคัญที่สุดในระบบนี้**

CSS `var()` ไม่ทำงานใน `@page {}` rules และ pdf-options JSON
ดังนั้นค่า 3 ชุดนี้ต้องเขียน hardcode และต้องตรงกันเสมอ:

| ค่า | ที่ 1: `:root` | ที่ 2: `@page` CSS | ที่ 3: `pdf-options` JSON |
|---|---|---|---|
| bottom margin | `--pg-bottom: 20mm` | `@page { margin-bottom: 20mm }` ⚠ | `"margin": { "bottom": "20mm" }` ⚠ |
| h padding | `--pg-h: 8mm` | — | `padding-right:8mm` ใน footerTemplate ⚠ |
| footer font | `--font-footer: 14px` | — | `font-size:14px` ใน footerTemplate ⚠ |

### ทำไมต้องมีทั้ง @page และ pdf-options margin?

```
@page { margin-bottom: 20mm }
    → บอก Chrome layout engine ว่า content area สิ้นสุดที่ 20mm จากขอบล่าง
    → ใช้สำหรับการคำนวณ page break ใน outer table
    → ถ้าไม่มี → table row สุดท้ายของแต่ละหน้าจะทับ page number

pdf-options "margin.bottom": "20mm"
    → สร้าง physical space ใน PDF สำหรับ footerTemplate
    → ถ้าไม่มี → footerTemplate จะทับ content

ต้องมีทั้งสองค่าและต้องเท่ากัน
```

### ตัวอย่างใน template

```css
/* CSS (ใน <style>) */
@media print {
  @page { margin-bottom: 20mm; }  /* ⚠ SYNC with --pg-bottom AND pdf-options */
}
```

```html
<!-- comment บอก sync ก่อน script block -->
<!--
  pdf-options: values below must stay in sync with :root variables
    margin.bottom  ⚠ SYNC with --pg-bottom and @page { margin-bottom }
    padding-right  ⚠ SYNC with --pg-h
    font-size      ⚠ SYNC with --font-footer
-->
<script type="application/pdf-options">
{
  "margin": { "top": "0", "right": "0", "bottom": "20mm", "left": "0" },
  "footerTemplate": "<div style='font-family:\"Bai Jamjuree\",sans-serif;font-size:14px;width:100%;text-align:right;padding-right:8mm;box-sizing:border-box;'><span class='pageNumber'></span> / <span class='totalPages'></span></div>"
}
</script>
```

---

## 6. Handlebars — Variables & Helpers

### Variable Substitution

```handlebars
{{variableName}}      ← escape HTML — ใช้ทั่วไป (ปลอดภัย)
{{{variableName}}}    ← raw output ไม่ escape — ใช้เฉพาะ base64 data URI
```

### Conditionals

```handlebars
{{#if value}}แสดงเมื่อ truthy{{/if}}
{{#if value}}...{{else}}...{{/if}}
{{#if (eq status "active")}}...{{/if}}
{{#if (gt count 0)}}...{{/if}}
{{#if (or fieldA fieldB)}}...{{/if}}
```

### Loops

```handlebars
{{#each items}}
  <tr>
    <td>{{inc @index}}</td>    ← 1-based (1, 2, 3…)
    <td>{{@index}}</td>        ← 0-based (0, 1, 2…)
    <td>{{this.name}}</td>
    <td>{{this.price}}</td>
  </tr>
{{/each}}
```

### Object scope

```handlebars
{{#with address}}
  {{street}}, {{city}}   ← เข้าถึง field ใน address object โดยตรง
{{/with}}
```

### ⚠ Handlebars ใน HTML comments

**ห้าม** ใช้ `{{...}}` ใน `<!-- -->` — Handlebars parse ข้าง comment ด้วย
ใช้ `\{{` แทน เพื่อ escape ใน doc comment

---

### Helpers ทั้งหมด

#### `dateFormat` → DD/MM/พ.ศ.

```handlebars
{{dateFormat openDate}}
```

| Input | Output |
|-------|--------|
| `"2025-11-10T04:57:19.896Z"` | `10/11/2568` |
| `""` หรือ `null` | `-` |
| string ที่ไม่ใช่ ISO | คืนค่าเดิม |

#### `dateTimeFormat` → DD/MM/พ.ศ. HH:mm

```handlebars
{{dateTimeFormat updatedAt}}
```

| Input | Output |
|-------|--------|
| `"2025-11-10T13:30:00.000Z"` | `10/11/2568 13:30` |
| `""` หรือ `null` | `-` |

#### `timeFormat` → HH:mm

```handlebars
{{timeFormat workStartTime}}
```

| Input | Output |
|-------|--------|
| `"2025-11-10T05:13:16.538Z"` | `05:13` |
| `""` หรือ `null` | `-` |

#### `numberFormat` → Thai locale

```handlebars
{{numberFormat amount}}      ← 2 decimal (default)
{{numberFormat amount 0}}    ← ไม่มี decimal
{{numberFormat amount 2}}    ← explicit 2 decimal
```

| Input | Decimals | Output |
|-------|----------|--------|
| `2354` | 2 | `2,354.00` |
| `613.8` | 2 | `613.80` |
| `99999` | 2 | `99,999.00` |
| `1000000` | 0 | `1,000,000` |
| `null` | any | `-` |

#### `valueOrDash` → `-` สำหรับค่าว่าง

```handlebars
{{valueOrDash fieldName}}
```

| Input | Output |
|-------|--------|
| `"some text"` | `some text` |
| `null` / `undefined` / `""` | `-` |
| `0` | `0` (ศูนย์คือค่าจริง ไม่ใช่ dash) |

> ถ้าต้องการให้ `0` → `-` ให้ส่งค่าเป็น `null` จาก backend

#### `checkMark` → ✓

```handlebars
{{checkMark item.isCompleted}}
```

| Input | Output |
|-------|--------|
| `true` | `✓` |
| `false` | `` (string ว่าง) |

#### Logic helpers

```handlebars
{{#if (eq a b)}}       ← equal
{{#if (gt a b)}}       ← greater than
{{#if (or a b)}}       ← OR
{{inc @index}}         ← index + 1 (ใช้ใน loop)
```

---

### Patterns ที่ใช้บ่อย

**Info table (label-value 4 คอลัมน์):**
```html
<table class="info-table">
  <tr>
    <td class="lbl">ชื่อลูกค้า</td>
    <td class="val">{{customerName}}</td>
    <td class="lbl">วันที่</td>
    <td class="val">{{dateFormat openDate}}</td>
  </tr>
  <tr>
    <td class="lbl">หมายเหตุ</td>
    <td class="val" colspan="3">{{valueOrDash remark}}</td>
  </tr>
</table>
```

**Data table พร้อม zebra + page-break-inside:**
```html
<table class="items-table">
  <thead>
    <tr>
      <th>ที่</th>
      <th>รายการ</th>
      <th>จำนวน</th>
      <th>ราคา</th>
    </tr>
  </thead>
  <tbody>
    {{#each items}}
    <tr>
      <td>{{inc @index}}</td>
      <td>{{this.name}}</td>
      <td>{{valueOrDash this.qty}}</td>
      <td>{{numberFormat this.price 2}}</td>
    </tr>
    {{/each}}
  </tbody>
</table>
```

```css
.items-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
.items-table th { background: var(--th-bg); border: 1px solid var(--th-border); padding: 5px 4px; font-size: var(--font-body); }
.items-table td { border: 1px solid #ccc; padding: 4px; font-size: var(--font-body); overflow-wrap: break-word; }
.items-table tbody tr:nth-child(odd)  td { background: var(--row-alt-bg); }
.items-table tbody tr:nth-child(even) td { background: #fff; }
@media print { .items-table tbody tr { page-break-inside: avoid; } }
```

**Signature box:**
```html
<table style="width:100%; border-collapse:collapse; margin-top:16px;">
  <tr>
    <td style="border:1px solid #bbb; padding:6px 8px; text-align:center; width:33%;">
      <div style="height:55px;">
        {{#if signatureUrl}}<img src="{{signatureUrl}}" style="max-height:50px;">{{/if}}
      </div>
      <div style="border-top:1px solid #bbb; padding-top:4px; font-size:12px; font-weight:600;">ลายเซ็นลูกค้า</div>
    </td>
    <td style="border:1px solid #bbb; padding:6px 8px; text-align:center; width:33%;">
      <div style="height:55px;"></div>
      <div style="border-top:1px solid #bbb; padding-top:4px; font-size:12px; font-weight:600;">ลายเซ็นช่าง</div>
    </td>
  </tr>
</table>
```

---

## 7. Puppeteer PDF Options

เพิ่ม block นี้ **ใน `<body>`** (ก่อนปิด `</body>`) เพื่อ override ค่า default:

```html
<script type="application/pdf-options">
{
  "margin":          { "top": "0", "right": "0", "bottom": "20mm", "left": "0" },
  "footerTemplate":  "...",
  "headerTemplate":  "...",
  "landscape":       false,
  "scale":           1,
  "format":          "A4"
}
</script>
```

### กฎการทำงาน

- ระบบ parse JSON **หลัง** Handlebars compile → Handlebars variables ใน JSON ถูก resolve แล้ว (`{{documentNo}}` ใช้ได้)
- block ถูก **ลบออก** จาก HTML ก่อนส่งให้ Puppeteer (ไม่ปรากฏใน PDF)
- ถ้าไม่มี block → default: page number `N / M` มุมล่างขวา, `margin.bottom: 8mm`
- block ใน `<!-- HTML comment -->` จะถูกข้าม

### `footerTemplate`

HTML string render ใน isolated Puppeteer context — **Bai Jamjuree font auto-inject แล้ว**

```json
"footerTemplate": "<div style='font-family:\"Bai Jamjuree\",sans-serif;font-size:14px;width:100%;text-align:right;padding-right:8mm;box-sizing:border-box;'><span class='pageNumber'></span> / <span class='totalPages'></span></div>"
```

**Puppeteer built-in classes:**

| Class | ค่า |
|-------|-----|
| `<span class="pageNumber">` | หน้าปัจจุบัน |
| `<span class="totalPages">` | จำนวนหน้าทั้งหมด |
| `<span class="date">` | วันที่ print |
| `<span class="title">` | document title |
| `<span class="url">` | URL |

**Footer ซ้ายและขวา (doc number + page):**
```json
"footerTemplate": "<div style='font-family:\"Bai Jamjuree\",sans-serif;font-size:12px;color:#555;width:100%;display:flex;justify-content:space-between;padding:0 8mm;box-sizing:border-box;'><span>{{documentNo}}</span><span><span class='pageNumber'></span> / <span class='totalPages'></span></span></div>"
```

### Options ที่ใช้บ่อย

| Option | Default | หมายเหตุ |
|--------|---------|----------|
| `margin.top` | `"0"` | ใช้ `"0"` เสมอเมื่อใช้ outer table layout |
| `margin.bottom` | `"8mm"` | ⚠ SYNC กับ `@page { margin-bottom }` และ `--pg-bottom` |
| `margin.left` | `"0"` | padding จัดการใน CSS แทน |
| `margin.right` | `"0"` | padding จัดการใน CSS แทน |
| `landscape` | `false` | `true` สำหรับ A4 แนวนอน |
| `scale` | `1` | `0.85` เพื่อย่อทุกอย่างลง 15% |
| `format` | `"A4"` | `"A3"`, `"Letter"` |

---

## 8. Assets — Logo & Images

### Logo Mazuma (auto-inline)

```html
<img src="/assets/images/mazuma-logo.png" alt="Mazuma" class="hdr-logo">
```

ระบบ `inlineImages()` แปลง path `/assets/images/...` เป็น base64 data URI อัตโนมัติ — Puppeteer ไม่ต้องเข้าถึง network

### Images อื่น

วางไฟล์ใน `assets/images/` แล้วใช้ path `/assets/images/filename.png`

รองรับ: `.png`, `.jpg`, `.jpeg`, `.svg`, `.gif`

### ⚠ Path traversal protection

`inlineImages()` ตรวจสอบว่า path อยู่ใน `assets/` เท่านั้น — path เช่น `/assets-evil/` จะถูกปฏิเสธ

### External URL (signature, dynamic images)

```handlebars
{{#if signatureUrl}}
<img src="{{signatureUrl}}" style="max-height:50px;">
{{/if}}
```

External URL ไม่ถูก inline — Puppeteer ต้องเข้าถึง URL นั้นได้เอง หรือส่งเป็น data URI

---

## 9. QR Code อัตโนมัติ

ส่ง field `qrCodeContent` ใน data → ระบบ generate QR code data URI ให้อัตโนมัติ ก่อน Handlebars render

**ใน data payload:**
```json
{ "qrCodeContent": "2511TS000051" }
```

**ใน template:**
```handlebars
{{#if qrCodeDataUri}}
<img src="{{{qrCodeDataUri}}}" style="width:65px; height:65px;">
{{else}}
<div style="width:65px; height:65px; border:1px dashed #bbb;"></div>
{{/if}}
```

> **สำคัญ:** ใช้ `{{{triple braces}}}` เสมอสำหรับ data URI — double braces จะ escape ตัวอักษร `+`, `=`, `/` ใน base64 ทำให้รูปเสีย

---

## 10. ทดสอบ Template

### 1. Browser Preview (เร็วที่สุด)

ระบบมี endpoint พิเศษที่ render template + ข้อมูลจาก fixture file แล้วคืน HTML:

```
GET http://localhost:3000/pdf/preview/my-new-doc
```

- โหลด `test/fixtures/my-new-doc.fixture.json` อัตโนมัติ
- เปิดใน browser → เห็น layout จริง font จริง
- ไม่ต้อง generate PDF — ใช้สำหรับ iterate layout

> สร้าง fixture file ก่อน: `test/fixtures/my-new-doc.fixture.json`
> ถ้าไม่มี fixture → render ด้วย data ว่าง ({{variables}} จะว่าง)

### 2. Generate PDF ด้วย curl

**Stream (แสดงใน Preview.app / Postman):**
```bash
curl -X POST "http://localhost:3000/pdf/render?output=stream" \
  -H "Content-Type: application/json" \
  -d '{"template":"my-new-doc","data":{"customerName":"ทดสอบ"}}' \
  -o output.pdf && open output.pdf
```

**ใช้ fixture file:**
```bash
curl -X POST "http://localhost:3000/pdf/render?output=stream" \
  -H "Content-Type: application/json" \
  -d "{\"template\":\"my-new-doc\",\"data\":$(cat test/fixtures/my-new-doc.fixture.json)}" \
  -o output.pdf && open output.pdf
```

**Save to disk (ได้ fileUrl กลับมา):**
```bash
curl -X POST "http://localhost:3000/pdf/render" \
  -H "Content-Type: application/json" \
  -d '{"template":"my-new-doc","data":{...}}'
# → { "success": true, "fileName": "...", "fileUrl": "http://...", "fileSize": ... }
```

**Rendered HTML (debug layout):**
```bash
curl -X POST "http://localhost:3000/pdf/render?output=html" \
  -H "Content-Type: application/json" \
  -d '{"template":"my-new-doc","data":{...}}' > debug.html && open debug.html
```

> **zsh:** quote URLs ที่มี `?` เสมอ: `"http://localhost:3000/pdf/render?output=stream"`

### 3. Postman

Import `docs/pdf-generator.postman_collection.json` — มี request ตัวอย่างสำหรับ borrowing-slip และ service-order

### Workflow แนะนำ

```
1. แก้ template.html
2. Restart: lsof -ti :3000 | xargs kill -9 && node dist/main &
3. Browser: http://localhost:3000/pdf/preview/my-new-doc
4. ถ้า layout โอเค → generate PDF ด้วย curl
5. Repeat
```

---

## 11. API Reference

**Base URL:** `http://localhost:3000`
**Auth:** `X-API-Key: <value>` header (production เท่านั้น — dev ไม่ต้องส่งเมื่อ `PDF_API_KEY` ไม่ได้ set)

### `POST /pdf/render`

```json
{
  "template": "borrowing-slip",
  "data": { "documentNo": "2511BR000245", "customerName": "..." }
}
```

หรือ raw HTML:
```json
{
  "html": "<!DOCTYPE html>...",
  "data": { "title": "Test" }
}
```

**Query parameters:**

| `?output=` | Status | Response |
|------------|--------|----------|
| (ไม่ระบุ) | `201` | `{ success, fileName, fileUrl, fileSize }` — บันทึกลง `output/` |
| `stream` | `200` | PDF binary — `Content-Type: application/pdf` |
| `html` | `200` | HTML string — ใช้สำหรับ debug layout |

### `GET /pdf/preview/:template`

Preview template ด้วย fixture file (no auth required):
- โหลด `test/fixtures/<template>.fixture.json` เป็น data อัตโนมัติ
- คืน HTML ที่ render แล้ว (font + images ใช้ได้ใน browser)

```bash
open http://localhost:3000/pdf/preview/borrowing-slip
```

### `GET /pdf/files/:fileName`

Download PDF ที่บันทึกไว้ — auto-purge หลัง 24 ชั่วโมง

### `GET /health`

Health check — ไม่ต้อง auth

```bash
curl http://localhost:3000/health
# → { "status": "ok", "uptime": "2h 15m 30s", "timestamp": "..." }
```

---

## 12. Complete Template Example

Template สมบูรณ์แสดง feature ทั้งหมด — copy แล้วแก้ได้เลย:

```html
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <!--
    PDF Template: ชื่อเอกสาร
    ─────────────────────────
    Handlebars (backslash-escaped ใน comment เพื่อไม่ให้ parse):
      \{{var}}          variable
      \{{{var}}}        raw/no-escape (data URI เท่านั้น)
      \{{#each items}}  loop
      \{{dateFormat x}} \{{numberFormat x 2}} \{{valueOrDash x}} \{{checkMark x}}

    Preview: http://localhost:3000/pdf/preview/my-new-doc
  -->
  <link rel="stylesheet" href="/assets/pdf-base.css">
  <style>
    /* ════════════════════════════════════════════════════════════════
       ░░  TEMPLATE CONFIGURATION — edit this section to tune layout  ░░
       ════════════════════════════════════════════════════════════════ */
    :root {
      --pg-h:       8mm;
      --pg-top:     6mm;
      --pg-bottom:  20mm;  /* ⚠ SYNC → @page margin-bottom + pdf-options margin.bottom */

      --brand:      #1a9e96;
      --th-bg:      #b8dcdb;
      --th-border:  #9ccbca;
      --row-alt-bg: #f2f7f7;

      --font-company:   16px;
      --font-doc-title: 28px;
      --font-doc-no:    20px;
      --font-doc-type:  14px;
      --font-address:   13px;
      --font-body:      13px;
      --font-section:   16px;
      --font-footer:    12px;  /* ⚠ SYNC → pdf-options footerTemplate font-size */
    }

    /* ── Page layout ── */
    .page-layout  { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .page-header  { padding: var(--pg-top) var(--pg-h) 0 var(--pg-h); }
    .page-content { padding: 4mm var(--pg-h) 8mm var(--pg-h); vertical-align: top; }

    @media screen {
      html { background: #c0c0c0; padding: 24px 0 40px; }
      body { width: 210mm; margin: 0 auto; background: white; box-shadow: 0 2px 20px rgba(0,0,0,0.3); }
    }
    @media print {
      @page { margin-bottom: 20mm; }  /* ⚠ SYNC with --pg-bottom AND pdf-options margin.bottom */
      .items-table tbody tr { page-break-inside: avoid; }
    }

    /* ── Header internals ── */
    .hdr-top     { display: flex; align-items: center; justify-content: space-between; margin-bottom: 2px; }
    .hdr-bottom  { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 4px; }
    .hdr-left    { display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0; }
    .hdr-right   { flex-shrink: 0; text-align: right; }
    .hdr-logo    { width: auto; max-width: 240px; }
    .company-th  { font-weight: 700; font-size: var(--font-company); color: #000; white-space: nowrap; }
    .company-en  { font-weight: 600; font-size: var(--font-company); color: #000; white-space: nowrap; }
    .doc-title   { font-size: var(--font-doc-title); font-weight: 700; color: #000; white-space: nowrap; }
    .doc-number  { font-size: var(--font-doc-no); font-weight: 700; color: #000; }
    .doc-type    { font-size: var(--font-doc-type); color: #000; }
    .hdr-address { font-size: var(--font-address); color: #000; line-height: 1.35; }
    .hdr-border  { height: 2px; background: var(--brand); margin-top: 4px; }

    /* ── Info table ── */
    .info-table { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: var(--font-body); margin-bottom: 6mm; }
    .info-table td { padding: 4px 12px; border: none; vertical-align: top; }
    .info-table td:first-child, .info-table td:nth-child(3) { padding-left: 0; }
    .info-table .lbl { font-weight: 700; white-space: nowrap; width: 18%; }

    /* ── Section title ── */
    .section-title { font-weight: 700; font-size: var(--font-section); margin: 0 0 8px 0; }

    /* ── Items table ── */
    .items-table { width: 100%; table-layout: fixed; border-collapse: collapse; }
    .items-table th {
      background: var(--th-bg); color: #000; font-weight: 700;
      padding: 5px 4px; text-align: center; font-size: var(--font-body);
      border: 1px solid var(--th-border); line-height: 1.3;
    }
    .items-table td { border: 1px solid #ccc; padding: 4px; font-size: var(--font-body); overflow-wrap: break-word; }
    .items-table tbody tr:nth-child(odd)  td { background: var(--row-alt-bg); }
    .items-table tbody tr:nth-child(even) td { background: #fff; }
    .td-center { text-align: center; }
    .td-right  { text-align: right; }

    /* ── Column widths (adjust to content) ── */
    .col-no    { width: 6%; }
    .col-name  { /* remainder */ }
    .col-qty   { width: 8%; }
    .col-price { width: 13%; }  /* 13% ≈ 25mm — fits 5-digit price (99,999.00) */
  </style>
</head>
<body>

<table class="page-layout">
  <thead>
    <tr><td class="page-header">
      <div class="hdr-top">
        <div class="hdr-left">
          <img src="/assets/images/mazuma-logo.png" alt="Mazuma" class="hdr-logo">
          <div>
            <div class="company-th">บริษัท มาซูม่า เซอร์วิส จำกัด</div>
            <div class="company-en">MAZUMA SERVICE CO., LTD.</div>
          </div>
        </div>
        <div class="hdr-right">
          <div class="doc-title">ชื่อเอกสาร</div>
        </div>
      </div>
      <div class="hdr-bottom">
        <div class="hdr-address">
          1296/9-10 ถนนกรุงเทพ-นนทบุรี แขวงบางซื่อ เขตบางซื่อ กรุงเทพฯ 10800<br>
          1296/9-10 Bangkok-Nonthaburi Rd., Bangsue, Bangsue, Bangkok 10800
        </div>
        <div style="text-align:right;">
          <div class="doc-number">{{documentNo}}</div>
          <div class="doc-type">{{documentType}}</div>
        </div>
      </div>
      <div class="hdr-border"></div>
    </td></tr>
  </thead>
  <tbody>
    <tr><td class="page-content">

      <!-- Info table -->
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

      <!-- Section heading -->
      <div class="section-title">รายการ</div>

      <!-- Data table -->
      <table class="items-table">
        <thead>
          <tr>
            <th class="col-no">ที่</th>
            <th class="col-name">รายการ</th>
            <th class="col-qty">จำนวน</th>
            <th class="col-price">ราคา/หน่วย</th>
            <th class="col-price">รวม</th>
          </tr>
        </thead>
        <tbody>
          {{#each items}}
          <tr>
            <td class="td-center">{{inc @index}}</td>
            <td>{{this.name}}</td>
            <td class="td-center">{{valueOrDash this.qty}}</td>
            <td class="td-right">{{numberFormat this.unitPrice 2}}</td>
            <td class="td-right">{{numberFormat this.total 2}}</td>
          </tr>
          {{/each}}
        </tbody>
      </table>

    </td></tr>
  </tbody>
</table>

<!--
  pdf-options: values below must stay in sync with :root variables
    margin.bottom  ⚠ SYNC with --pg-bottom and @page { margin-bottom }
    padding-right  ⚠ SYNC with --pg-h
    font-size      ⚠ SYNC with --font-footer
-->
<script type="application/pdf-options">
{
  "margin": { "top": "0", "right": "0", "bottom": "20mm", "left": "0" },
  "footerTemplate": "<div style='font-family:\"Bai Jamjuree\",sans-serif;font-size:12px;width:100%;text-align:right;padding-right:8mm;box-sizing:border-box;'><span class='pageNumber'></span> / <span class='totalPages'></span></div>"
}
</script>

</body>
</html>
```

**Fixture file (`test/fixtures/my-new-doc.fixture.json`):**
```json
{
  "documentNo": "2025-TEST-001",
  "documentType": "เอกสารทดสอบ",
  "customerName": "สมชาย ใจดี",
  "openDate": "2025-11-10T00:00:00.000Z",
  "remark": null,
  "items": [
    { "name": "สินค้า A", "qty": 2, "unitPrice": 500, "total": 1000 },
    { "name": "สินค้า B", "qty": 1, "unitPrice": 1200, "total": 1200 },
    { "name": "สินค้า C ที่มีชื่อยาวมากเพื่อทดสอบการ wrap ข้อความ", "qty": 5, "unitPrice": 99999, "total": 499995 }
  ]
}
```

---

## 13. Checklist ก่อน Deploy

**โครงสร้าง:**
- [ ] มี `<link rel="stylesheet" href="/assets/pdf-base.css">`
- [ ] ใช้ outer `<table class="page-layout"><thead><tbody>` layout
- [ ] ไม่มี `position: fixed` หรือ `body { margin-top }` print rules
- [ ] ไม่มี `{{...}}` ใน `<!-- HTML comment -->` — ใช้ `\{{` แทน

**⚠ SYNC values (ต้องตรงกันทั้ง 3 จุด):**
- [ ] `--pg-bottom` = `@page { margin-bottom }` = `pdf-options "margin.bottom"`
- [ ] `--pg-h` = `padding-right` ใน footerTemplate
- [ ] `--font-footer` = `font-size` ใน footerTemplate

**Content:**
- [ ] `{{{triple braces}}}` สำหรับทุก data URI (QR code, signature)
- [ ] `page-break-inside: avoid` บน data table tbody tr
- [ ] ทดสอบกับ `null`/ค่าว่าง → `valueOrDash` ทำงานถูก
- [ ] ทดสอบกับ items จำนวนมาก → header/column ซ้ำทุกหน้า, page number ถูกต้อง, ไม่มี row ทับ footer

**Workflow:**
- [ ] สร้าง `test/fixtures/my-new-doc.fixture.json`
- [ ] Preview ที่ `http://localhost:3000/pdf/preview/my-new-doc`
- [ ] Generate PDF จริงด้วย curl และเปิดตรวจ
- [ ] อัพเดท Postman collection ใน `docs/pdf-generator.postman_collection.json`
