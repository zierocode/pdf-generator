import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import puppeteer, { type Browser, type PDFOptions } from 'puppeteer';

const PDF_GENERATION_TIMEOUT_MS = 30_000;

@Injectable()
export class BrowserPoolService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BrowserPoolService.name);
  private browser: Browser | null = null;

  async onModuleInit() {
    await this.launchBrowser();
  }

  async onModuleDestroy() {
    await this.browser?.close();
    this.browser = null;
  }

  async generatePdf(html: string, options?: PDFOptions): Promise<Buffer> {
    const browser = await this.ensureBrowser();
    const page = await browser.newPage();

    try {
      await page.setContent(html, { waitUntil: 'domcontentloaded' });

      const pdfBuffer = await Promise.race([
        page.pdf({
          format: 'A4',
          printBackground: true,
          margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
          ...options,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('PDF generation timed out')),
            PDF_GENERATION_TIMEOUT_MS,
          ),
        ),
      ]);

      return Buffer.from(pdfBuffer);
    } finally {
      await page.close().catch((err) => {
        this.logger.warn(`Failed to close page: ${err.message}`);
      });
    }
  }

  private async ensureBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.connected) {
      this.logger.warn('Browser disconnected, relaunching...');
      await this.launchBrowser();
    }
    return this.browser!;
  }

  private async launchBrowser(): Promise<void> {
    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--font-render-hinting=none',
      ],
    });
    this.logger.log('Puppeteer browser launched');
  }
}
