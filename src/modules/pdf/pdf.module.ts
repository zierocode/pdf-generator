import { Module } from '@nestjs/common';
import { PdfController } from './pdf.controller';
import { TemplateController } from './template.controller';
import { PdfService } from './pdf.service';
import { BrowserPoolService } from './browser-pool.service';
import { TemplateRendererService } from './template-renderer.service';
import { FileStorageService } from './file-storage.service';
import { TemplateStorageService } from './template-storage.service';

@Module({
  controllers: [PdfController, TemplateController],
  providers: [
    PdfService,
    BrowserPoolService,
    TemplateRendererService,
    FileStorageService,
    TemplateStorageService,
  ],
  exports: [PdfService],
})
export class PdfModule {}
