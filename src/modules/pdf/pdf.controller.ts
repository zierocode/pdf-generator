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
import * as fs from 'node:fs';
import * as path from 'node:path';
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
   *   ?output=html    → rendered HTML (200) — for browser preview
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

    const ip = res.req.ip ?? res.req.socket.remoteAddress ?? 'unknown';
    const mode = output === 'html' ? 'html' : output === 'stream' ? 'stream' : 'save';
    const source = body.template ? `template:${body.template}` : 'raw-html';
    this.logger.log(`Render request — ${source} mode:${mode} ip:${ip}`);

    try {
      if (output === 'html') {
        const renderedHtml = await this.pdfService.renderHtmlOnly({
          template: body.template,
          html: body.html,
          data: body.data ?? {},
        });
        res.set({ 'Content-Type': 'text/html; charset=utf-8' });
        return res.status(HttpStatus.OK).send(renderedHtml);
      }

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
   * Browser preview: renders template with its fixture file and returns HTML.
   * No auth required in dev; uses test/fixtures/:template.fixture.json as data.
   *
   * GET /pdf/preview/borrowing-slip
   */
  @Get('preview/:template')
  async preview(@Param('template') template: string, @Res() res: Response) {
    const fixturePath = path.join(process.cwd(), 'test/fixtures', `${template}.fixture.json`);
    let data: Record<string, unknown> = {};
    if (fs.existsSync(fixturePath)) {
      data = JSON.parse(fs.readFileSync(fixturePath, 'utf-8')) as Record<string, unknown>;
    }
    try {
      const html = await this.pdfService.renderHtmlOnly({ template, data });
      res.set({ 'Content-Type': 'text/html; charset=utf-8' });
      return res.status(HttpStatus.OK).send(html);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new HttpException(msg, HttpStatus.INTERNAL_SERVER_ERROR);
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
    const ip = res.req.ip ?? res.req.socket.remoteAddress ?? 'unknown';
    this.logger.log(`Download: ${fileName} ip:${ip}`);
    res.download(filePath, fileName);
  }
}
