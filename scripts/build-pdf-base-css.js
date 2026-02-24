#!/usr/bin/env node
/**
 * Generates public/assets/pdf-base.css with:
 *  - Bai Jamjuree fonts embedded as base64 @font-face
 *  - PDF layout conventions (.pdf-header, .pdf-footer, .page-break, @page)
 *
 * Run: node scripts/build-pdf-base-css.js
 * Re-run whenever fonts change.
 */

const fs = require('fs');
const path = require('path');

const fontDir = path.join(__dirname, '../assets/fonts/Bai Jamjuree');
const outFile = path.join(__dirname, '../assets/pdf-base.css');

if (!fs.existsSync(fontDir)) {
  console.error(`Font directory not found: ${fontDir}`);
  process.exit(1);
}

const toDataUri = (filename) => {
  const filePath = path.join(fontDir, filename);
  if (!fs.existsSync(filePath)) {
    console.warn(`  Warning: ${filename} not found, skipping`);
    return null;
  }
  const buf = fs.readFileSync(filePath);
  return `data:font/truetype;base64,${buf.toString('base64')}`;
};

const fonts = [
  { file: 'BaiJamjuree-Regular.ttf',   weight: 400 },
  { file: 'BaiJamjuree-Medium.ttf',    weight: 500 },
  { file: 'BaiJamjuree-SemiBold.ttf',  weight: 600 },
  { file: 'BaiJamjuree-Bold.ttf',      weight: 700 },
];

const fontFaces = fonts
  .map(({ file, weight }) => {
    const uri = toDataUri(file);
    if (!uri) return '';
    return `@font-face {
  font-family: 'Bai Jamjuree';
  src: url('${uri}') format('truetype');
  font-weight: ${weight};
  font-style: normal;
}`;
  })
  .filter(Boolean)
  .join('\n\n');

const css = `/* ==========================================================
 * pdf-base.css — Auto-generated. Do not edit manually.
 * Run: node scripts/build-pdf-base-css.js
 * ========================================================== */

/* ===== Bai Jamjuree fonts (embedded base64) ===== */

${fontFaces}

/* ===== PDF conventions ===== */

*, *::before, *::after { box-sizing: border-box; }
* { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }

@page { size: A4; margin: 0; }

body {
  font-family: 'Bai Jamjuree', 'Noto Sans Thai', sans-serif;
  font-size: 12px;
  line-height: 1.4;
  color: #333;
  margin: 0;
  padding: 0;
}

/*
 * .pdf-header
 * Fixed to top — repeats on every printed page.
 * Template must set: body { margin-top: <header-height>; }
 */
.pdf-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: #fff;
}

/*
 * .page-break
 * Forces a new page. Add padding-top on the next section to clear the fixed header.
 */
.page-break {
  page-break-before: always;
  break-before: page;
  display: block;
  height: 0;
}
`;

fs.writeFileSync(outFile, css, 'utf-8');
const sizeKb = (fs.statSync(outFile).size / 1024).toFixed(1);
console.log(`✓ Generated: ${outFile} (${sizeKb} KB)`);
