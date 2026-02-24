import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { BrowserPoolService } from './browser-pool.service';
import { TemplateRendererService } from './template-renderer.service';
import type { BorrowingSlipData } from './interfaces/borrowing-slip.interface';
import type { ServiceOrderData } from './interfaces/service-order.interface';

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);
  private logoBase64: string | null = null;
  private fontAssets: { regular: string; bold: string; semibold: string } | null = null;

  constructor(
    private readonly browserPool: BrowserPoolService,
    private readonly templateRenderer: TemplateRendererService,
  ) {}

  async generateBorrowingSlip(data: BorrowingSlipData): Promise<Buffer> {
    this.logger.log(`Generating borrowing slip: ${data.documentNo}`);

    const fonts = this.getFontAssets();
    const html = this.templateRenderer.render('borrowing-slip', {
      ...data,
      logoBase64: this.getLogoBase64(),
      fontRegular: fonts.regular,
      fontBold: fonts.bold,
      fontSemiBold: fonts.semibold,
    });

    return this.browserPool.generatePdf(html, {
      format: 'A4',
      margin: { top: '8mm', right: '8mm', bottom: '8mm', left: '8mm' },
    });
  }

  async generateServiceOrder(data: ServiceOrderData): Promise<Buffer> {
    this.logger.log(`Generating service order: ${data.workOrderNo}`);

    let qrCodeDataUri: string | undefined;
    if (data.qrCodeContent) {
      qrCodeDataUri =
        await this.templateRenderer.generateQrCodeDataUri(data.qrCodeContent);
    }

    const fonts = this.getFontAssets();
    const html = this.templateRenderer.render('service-order', {
      ...data,
      qrCodeDataUri,
      logoBase64: this.getLogoBase64(),
      fontRegular: fonts.regular,
      fontBold: fonts.bold,
      fontSemiBold: fonts.semibold,
    });

    return this.browserPool.generatePdf(html, {
      format: 'A4',
      margin: { top: '8mm', right: '10mm', bottom: '8mm', left: '10mm' },
    });
  }

  private getLogoBase64(): string {
    if (this.logoBase64) return this.logoBase64;

    const possiblePaths = [
      path.join(process.cwd(), 'assets/images/mazuma-logo.png'),
      path.join(__dirname, '../../assets/images/mazuma-logo.png'),
    ];

    for (const logoPath of possiblePaths) {
      if (fs.existsSync(logoPath)) {
        const logoBuffer = fs.readFileSync(logoPath);
        this.logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
        return this.logoBase64;
      }
    }

    // Placeholder — replace with actual Mazuma logo
    this.logger.warn(
      'Mazuma logo not found, using placeholder. Place logo at assets/images/mazuma-logo.png',
    );
    this.logoBase64 = '';
    return this.logoBase64;
  }

  private getFontAssets(): { regular: string; bold: string; semibold: string } {
    if (this.fontAssets) return this.fontAssets;

    const fontDir = [
      path.join(process.cwd(), 'assets/fonts/Bai Jamjuree'),
      path.join(__dirname, '../../assets/fonts/Bai Jamjuree'),
    ].find((p) => fs.existsSync(p));

    if (!fontDir) {
      this.logger.warn('Bai Jamjuree fonts not found — using system fallback');
      this.fontAssets = { regular: '', bold: '', semibold: '' };
      return this.fontAssets;
    }

    const toDataUri = (file: string) => {
      const buf = fs.readFileSync(path.join(fontDir, file));
      return `data:font/truetype;base64,${buf.toString('base64')}`;
    };

    this.fontAssets = {
      regular: toDataUri('BaiJamjuree-Regular.ttf'),
      bold: toDataUri('BaiJamjuree-Bold.ttf'),
      semibold: toDataUri('BaiJamjuree-SemiBold.ttf'),
    };
    this.logger.log('Bai Jamjuree fonts loaded');
    return this.fontAssets;
  }
}
