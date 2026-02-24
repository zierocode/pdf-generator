import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Res,
  HttpStatus,
  Logger,
  HttpException,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { TemplateStorageService } from './template-storage.service';
import { BrowserPoolService } from './browser-pool.service';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import Handlebars from 'handlebars';
import * as fs from 'node:fs';
import * as path from 'node:path';

@Controller('api/templates')
@UseGuards(ApiKeyGuard)
export class TemplateController {
  private readonly logger = new Logger(TemplateController.name);
  private fontCssCache: string | null = null;

  constructor(
    private readonly templateStorage: TemplateStorageService,
    private readonly browserPool: BrowserPoolService,
  ) {}

  @Get()
  list() {
    return this.templateStorage.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.templateStorage.get(id);
  }

  @Post()
  create(@Body() body: { name: string; projectData: Record<string, unknown>; html: string; css: string }) {
    return this.templateStorage.create(body);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() body: Partial<{ name: string; projectData: Record<string, unknown>; html: string; css: string }>,
  ) {
    return this.templateStorage.update(id, body);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    this.templateStorage.delete(id);
    return { success: true };
  }

  /**
   * Preview: render HTML+CSS to PDF without saving.
   */
  @Post('preview')
  async preview(
    @Body() body: { html: string; css: string; data?: Record<string, unknown> },
    @Res() res: Response,
  ) {
    try {
      const pdfBuffer = await this.renderToPdf(body.html, body.css, body.data || {});
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="preview.pdf"',
        'Content-Length': pdfBuffer.length.toString(),
      });
      res.status(HttpStatus.OK).send(pdfBuffer);
    } catch (error) {
      this.logger.error(`Preview failed: ${error.message}`, error.stack);
      throw new HttpException('Preview generation failed', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Render a saved template with data to PDF.
   */
  @Post(':id/render')
  async render(
    @Param('id') id: string,
    @Body() body: { data?: Record<string, unknown> },
    @Res() res: Response,
  ) {
    try {
      const tpl = this.templateStorage.get(id);
      const pdfBuffer = await this.renderToPdf(tpl.html, tpl.css, body.data || {});

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="template-${id}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      });
      res.status(HttpStatus.OK).send(pdfBuffer);
    } catch (error) {
      this.logger.error(`Render failed: ${error.message}`, error.stack);
      throw new HttpException('PDF generation failed', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // --- Private ---

  private async renderToPdf(html: string, css: string, data: Record<string, unknown>): Promise<Buffer> {
    // Merge Handlebars variables
    let mergedHtml = html;
    try {
      const compiled = Handlebars.compile(html, { noEscape: true });
      mergedHtml = compiled(data);
    } catch {
      // If Handlebars fails (no variables), use raw HTML
    }

    // Inline /assets/ URLs as base64 data URIs for Puppeteer
    mergedHtml = this.inlineAssetUrls(mergedHtml);

    const fontCss = this.getFontCss();

    const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    ${fontCss}
    ${css}
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    @page { size: A4; margin: 0; }
  </style>
</head>
<body>${mergedHtml}</body>
</html>`;

    return this.browserPool.generatePdf(fullHtml, {
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      preferCSSPageSize: true,
    });
  }

  /**
   * Replace /assets/... URLs with inline base64 data URIs so Puppeteer can render them.
   */
  private inlineAssetUrls(html: string): string {
    const assetsDir = path.join(process.cwd(), 'assets');
    return html.replace(/(?:src|href)=["']\/assets\/([^"']+)["']/g, (match, assetPath: string) => {
      const filePath = path.join(assetsDir, assetPath);
      if (!filePath.startsWith(assetsDir) || !fs.existsSync(filePath)) return match;
      const ext = path.extname(filePath).slice(1).toLowerCase();
      const mime = ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'svg' ? 'image/svg+xml' : `image/${ext}`;
      const base64 = fs.readFileSync(filePath).toString('base64');
      const attr = match.startsWith('src') ? 'src' : 'href';
      return `${attr}="data:${mime};base64,${base64}"`;
    });
  }

  private getFontCss(): string {
    if (this.fontCssCache) return this.fontCssCache;

    const fontDir = [
      path.join(process.cwd(), 'assets/fonts/Bai Jamjuree'),
      path.join(__dirname, '../../assets/fonts/Bai Jamjuree'),
    ].find((p) => fs.existsSync(p));

    if (!fontDir) {
      this.logger.warn('Bai Jamjuree fonts not found');
      this.fontCssCache = '';
      return '';
    }

    const toBase64 = (file: string) => {
      const buf = fs.readFileSync(path.join(fontDir, file));
      return `data:font/truetype;base64,${buf.toString('base64')}`;
    };

    this.fontCssCache = `
      @font-face { font-family: 'Bai Jamjuree'; src: url('${toBase64('BaiJamjuree-Regular.ttf')}') format('truetype'); font-weight: 400; font-style: normal; }
      @font-face { font-family: 'Bai Jamjuree'; src: url('${toBase64('BaiJamjuree-SemiBold.ttf')}') format('truetype'); font-weight: 600; font-style: normal; }
      @font-face { font-family: 'Bai Jamjuree'; src: url('${toBase64('BaiJamjuree-Bold.ttf')}') format('truetype'); font-weight: 700; font-style: normal; }
    `;
    return this.fontCssCache;
  }
}
