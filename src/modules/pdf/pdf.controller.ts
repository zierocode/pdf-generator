import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Res,
  HttpStatus,
  HttpException,
  BadRequestException,
  NotFoundException,
  Logger,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { PdfService } from './pdf.service';
import { FileStorageService } from './file-storage.service';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';

@Controller('pdf')
@UseGuards(ApiKeyGuard)
export class PdfController {
  private readonly logger = new Logger(PdfController.name);

  constructor(
    private readonly pdfService: PdfService,
    private readonly fileStorage: FileStorageService,
  ) {}

  /**
   * Render a PDF from a named template or raw HTML.
   *
   * Body:
   *   { template: "borrowing-slip", data: { ... } }   ← load from templates/
   *   { html: "<!DOCTYPE html>...", data: { ... } }    ← raw HTML
   *
   * Query:
   *   ?output=stream  → PDF binary (200)
   *   (default)       → save file, return JSON { success, fileName, fileUrl, fileSize } (201)
   */
  @Post('render')
  async render(
    @Body() body: { template?: string; html?: string; data?: Record<string, unknown> },
    @Query('output') output: string,
    @Res() res: Response,
  ) {
    if (!body.template && !body.html) {
      throw new BadRequestException('Either "template" or "html" must be provided');
    }

    try {
      const pdfBuffer = await this.pdfService.render({
        template: body.template,
        html: body.html,
        data: body.data ?? {},
      });

      // Sanitise label — strip characters unsafe in HTTP header values and filenames
      const label = (body.template ?? 'document').replace(/[^a-zA-Z0-9\-_]/g, '_');

      if (output === 'stream') {
        res.set({
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${label}.pdf"`,
          'Content-Length': pdfBuffer.length.toString(),
          'Access-Control-Expose-Headers': 'Content-Disposition',
        });
        return res.status(HttpStatus.OK).send(pdfBuffer);
      }

      const { fileName } = this.fileStorage.save(pdfBuffer, label);
      const baseUrl = `${res.req.protocol}://${res.req.get('host')}`;
      const fileUrl = `${baseUrl}/pdf/files/${fileName}`;

      return res.status(HttpStatus.CREATED).json({
        success: true,
        fileName,
        fileUrl,
        fileSize: pdfBuffer.length,
      });
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) throw error;
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Render failed: ${msg}`, error instanceof Error ? error.stack : undefined);
      throw new HttpException(msg || 'PDF generation failed', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Download a previously saved PDF by filename.
   */
  @Get('files/:fileName')
  downloadFile(@Param('fileName') fileName: string, @Res() res: Response) {
    const filePath = this.fileStorage.resolve(fileName);
    if (!filePath) {
      throw new NotFoundException(`File "${fileName}" not found or expired`);
    }
    res.download(filePath, fileName);
  }
}
