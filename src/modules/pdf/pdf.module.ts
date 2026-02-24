import { Module } from '@nestjs/common';
import { PdfController } from './pdf.controller';
import { PdfService } from './pdf.service';
import { BrowserPoolService } from './browser-pool.service';
import { TemplateRendererService } from './template-renderer.service';
import { FileStorageService } from './file-storage.service';

@Module({
  controllers: [PdfController],
  providers: [
    PdfService,
    BrowserPoolService,
    TemplateRendererService,
    FileStorageService,
  ],
  exports: [PdfService],
})
export class PdfModule {}
