import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import Handlebars from 'handlebars';
import * as fs from 'node:fs';
import * as path from 'node:path';
import QRCode from 'qrcode';

export interface RenderResult {
  html: string;
  /** Puppeteer PDFOptions extracted from <script type="application/pdf-options"> in the template. */
  pdfOptions: Record<string, unknown>;
}

@Injectable()
export class TemplateRendererService implements OnModuleInit {
  private readonly logger = new Logger(TemplateRendererService.name);
  private templates = new Map<string, HandlebarsTemplateDelegate>();
  private pdfBaseCss = '';
  private readonly templateDir: string;
  private readonly assetsDir: string;

  constructor() {
    this.templateDir = [
      path.join(process.cwd(), 'templates'),
      path.join(__dirname, '../../../templates'),
    ].find((p) => fs.existsSync(p)) ?? path.join(process.cwd(), 'templates');

    this.assetsDir = [
      path.join(process.cwd(), 'assets'),
      path.join(__dirname, '../../assets'),
    ].find((p) => fs.existsSync(p)) ?? '';
  }

  async onModuleInit() {
    this.registerHelpers();
    this.loadPdfBaseCss();
    this.compileTemplates();
    this.logger.log(`Loaded ${this.templates.size} templates from ${this.templateDir}`);
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /** Render a named template from the templates/ directory. */
  render(templateName: string, data: Record<string, unknown>): RenderResult {
    const template = this.templates.get(templateName);
    if (!template) {
      throw new Error(`Template "${templateName}" not found. Available: ${[...this.templates.keys()].join(', ')}`);
    }
    return this.compile(template, data);
  }

  /** Render an arbitrary HTML string (Handlebars + asset inlining). */
  renderHtml(html: string, data: Record<string, unknown>): RenderResult {
    const template = Handlebars.compile(html);
    return this.compile(template, data);
  }

  private compile(template: HandlebarsTemplateDelegate, data: Record<string, unknown>): RenderResult {
    let html = template(data);
    html = this.inlineStylesheets(html);
    html = this.inlineImages(html);
    return this.extractPdfOptions(html);
  }

  /**
   * Parses and removes a <script type="application/pdf-options"> block from the HTML.
   * The JSON inside may contain any Puppeteer PDFOptions fields.
   * Called AFTER Handlebars compilation so Handlebars variables in the JSON are already resolved.
   * Only matches script tags that are NOT inside HTML comments.
   */
  private extractPdfOptions(html: string): RenderResult {
    const regex = /<script\s+type="application\/pdf-options"[^>]*>([\s\S]*?)<\/script>/i;
    // Strip HTML comments first to avoid matching example code inside <!-- --> doc blocks
    const withoutComments = html.replace(/<!--[\s\S]*?-->/g, '');
    const match = withoutComments.match(regex);
    if (!match) return { html, pdfOptions: {} };

    try {
      const pdfOptions = JSON.parse(match[1].trim()) as Record<string, unknown>;
      // Auto-enable displayHeaderFooter when custom header/footer template is specified
      if (pdfOptions.headerTemplate || pdfOptions.footerTemplate) {
        pdfOptions.displayHeaderFooter = true;
      }
      return { html: html.replace(regex, ''), pdfOptions };
    } catch {
      this.logger.warn('Failed to parse <script type="application/pdf-options"> — ignoring');
      return { html, pdfOptions: {} };
    }
  }

  /** Returns all @font-face blocks from pdf-base.css — for injection into Puppeteer header/footer templates. */
  getPdfFontFaceCss(): string {
    return (this.pdfBaseCss.match(/@font-face\s*\{[^}]+\}/g) ?? []).join('\n');
  }

  async generateQrCodeDataUri(text: string): Promise<string> {
    return QRCode.toDataURL(text, {
      width: 100,
      margin: 1,
      errorCorrectionLevel: 'M',
    });
  }

  // ---------------------------------------------------------------------------
  // Init helpers
  // ---------------------------------------------------------------------------

  private loadPdfBaseCss() {
    const candidates = [
      path.join(process.cwd(), 'assets/pdf-base.css'),
      path.join(__dirname, '../../assets/pdf-base.css'),
    ];
    const found = candidates.find((p) => fs.existsSync(p));
    if (found) {
      this.pdfBaseCss = fs.readFileSync(found, 'utf-8');
      this.logger.log(`pdf-base.css loaded (${(this.pdfBaseCss.length / 1024).toFixed(0)} KB)`);
    } else {
      this.logger.warn('pdf-base.css not found — run: node scripts/build-pdf-base-css.js');
    }
  }

  private compileTemplates() {
    if (!fs.existsSync(this.templateDir)) return;
    const files = fs.readdirSync(this.templateDir);
    for (const file of files) {
      if (file.endsWith('.html')) {
        const name = file.replace('.html', '');
        const content = fs.readFileSync(path.join(this.templateDir, file), 'utf-8');
        this.templates.set(name, Handlebars.compile(content));
      }
    }
  }

  private registerHelpers() {
    Handlebars.registerHelper('numberFormat', (value: number, decimals?: number | object) => {
      if (value == null) return '-';
      const dec = typeof decimals === 'number' ? decimals : 2;
      return value.toLocaleString('th-TH', {
        minimumFractionDigits: dec,
        maximumFractionDigits: dec,
      });
    });

    Handlebars.registerHelper('dateFormat', (value: string | Date) => {
      if (!value) return '-';
      const date = new Date(value);
      if (isNaN(date.getTime())) return String(value);
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const buddhistYear = date.getFullYear() + 543;
      return `${day}/${month}/${buddhistYear}`;
    });

    Handlebars.registerHelper('dateTimeFormat', (value: string | Date) => {
      if (!value) return '-';
      const date = new Date(value);
      if (isNaN(date.getTime())) return String(value);
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const buddhistYear = date.getFullYear() + 543;
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${day}/${month}/${buddhistYear} ${hours}:${minutes}`;
    });

    Handlebars.registerHelper('timeFormat', (value: string | Date) => {
      if (!value) return '-';
      const date = new Date(value);
      if (isNaN(date.getTime())) return String(value);
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    });

    Handlebars.registerHelper('valueOrDash', (value: unknown) => {
      if (value === null || value === undefined || value === '') return '-';
      const str = String(value);
      if (str === 'undefined' || str === 'null') return '-';
      return str;
    });

    Handlebars.registerHelper('checkMark', (value: boolean) => (value ? '✓' : ''));

    Handlebars.registerHelper('eq',  (a: unknown, b: unknown) => a === b);
    Handlebars.registerHelper('gt',  (a: number, b: number) => Number(a) > Number(b));
    Handlebars.registerHelper('inc', (value: number) => Number(value) + 1);
    Handlebars.registerHelper('or',  (a: unknown, b: unknown) => a || b);
  }

  // ---------------------------------------------------------------------------
  // Asset inlining
  // ---------------------------------------------------------------------------

  /**
   * Replace <link rel="stylesheet" href="/assets/pdf-base.css"> with inlined <style>.
   */
  private inlineStylesheets(html: string): string {
    return html.replace(
      /<link[^>]+href="\/assets\/pdf-base\.css"[^>]*\/?>/gi,
      `<style>\n${this.pdfBaseCss}\n</style>`,
    );
  }

  /**
   * Replace src="/assets/..." and href="/assets/..." with base64 data URIs.
   * Prevents Puppeteer from needing network/filesystem access for local assets.
   */
  private inlineImages(html: string): string {
    if (!this.assetsDir) return html;

    return html.replace(
      /(?:src|href)="\/assets\/([^"]+)"/g,
      (match, assetPath: string) => {
        const filePath = path.join(this.assetsDir, assetPath);
        // Path traversal guard — use separator suffix to prevent /assets-evil/ bypass
        if (!filePath.startsWith(this.assetsDir + path.sep) || !fs.existsSync(filePath)) {
          return match;
        }
        const ext = path.extname(filePath).slice(1).toLowerCase();
        const mime =
          ext === 'png'  ? 'image/png'  :
          ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
          ext === 'svg'  ? 'image/svg+xml' :
          ext === 'gif'  ? 'image/gif'  :
          `image/${ext}`;
        const base64 = fs.readFileSync(filePath).toString('base64');
        const attr = match.startsWith('src') ? 'src' : 'href';
        return `${attr}="data:${mime};base64,${base64}"`;
      },
    );
  }
}
