import { Injectable, Logger } from '@nestjs/common';
import { type PDFOptions } from 'puppeteer';
import { BrowserPoolService } from './browser-pool.service';
import { TemplateRendererService } from './template-renderer.service';

export interface RenderOptions {
  template?: string;
  html?: string;
  data?: Record<string, unknown>;
}

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  constructor(
    private readonly browserPool: BrowserPoolService,
    private readonly templateRenderer: TemplateRendererService,
  ) {}

  async render({ template, html, data = {} }: RenderOptions): Promise<Buffer> {
    // Auto-generate QR code data URI if caller supplies qrCodeContent
    const enrichedData = { ...data };
    if (enrichedData.qrCodeContent && typeof enrichedData.qrCodeContent === 'string') {
      enrichedData.qrCodeDataUri = await this.templateRenderer.generateQrCodeDataUri(
        enrichedData.qrCodeContent,
      );
    }

    let renderedHtml: string;
    let pdfOptions: PDFOptions;

    const label = template ?? 'raw-html';
    const t0 = Date.now();

    if (template) {
      this.logger.log(`Rendering template: ${template}`);
      ({ html: renderedHtml, pdfOptions } = this.templateRenderer.render(template, enrichedData) as { html: string; pdfOptions: PDFOptions });
    } else if (html) {
      this.logger.log('Rendering raw HTML');
      ({ html: renderedHtml, pdfOptions } = this.templateRenderer.renderHtml(html, enrichedData) as { html: string; pdfOptions: PDFOptions });
    } else {
      throw new Error('Either template or html must be provided');
    }

    // Inject Bai Jamjuree @font-face into custom header/footer templates (isolated Puppeteer context)
    const fontCss = this.templateRenderer.getPdfFontFaceCss();
    if (fontCss) {
      const styleTag = `<style>${fontCss}</style>`;
      if (pdfOptions.footerTemplate) pdfOptions.footerTemplate = styleTag + pdfOptions.footerTemplate;
      if (pdfOptions.headerTemplate) pdfOptions.headerTemplate = styleTag + pdfOptions.headerTemplate;
    }

    const pdfBuffer = await this.browserPool.generatePdf(renderedHtml, pdfOptions);
    const kb = (pdfBuffer.length / 1024).toFixed(1);
    this.logger.log(`Rendered ${label} in ${Date.now() - t0}ms (${kb} KB)`);
    return pdfBuffer;
  }
}
