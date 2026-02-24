import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Res,
  HttpStatus,
  Logger,
  HttpException,
  NotFoundException,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { PdfService } from './pdf.service';
import { FileStorageService } from './file-storage.service';
import { GenerateBorrowingSlipDto } from './dto/generate-borrowing-slip.dto';
import { GenerateServiceOrderDto } from './dto/generate-service-order.dto';
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
   * Generate borrowing slip PDF.
   *
   * Default: save to file, return JSON { fileName, fileUrl }
   * ?output=stream → return PDF binary directly
   */
  @Post('borrowing-slip')
  async generateBorrowingSlip(
    @Body() dto: GenerateBorrowingSlipDto,
    @Query('output') output: string,
    @Res() res: Response,
  ) {
    try {
      const pdfBuffer = await this.pdfService.generateBorrowingSlip(dto);
      const prefix = `borrowing-slip-${dto.documentNo}`;

      if (output === 'stream') {
        return this.sendPdfStream(res, pdfBuffer, prefix);
      }

      return this.sendFileResponse(res, pdfBuffer, prefix);
    } catch (error) {
      this.logger.error(`Failed to generate borrowing slip: ${error.message}`, error.stack);
      throw new HttpException('Failed to generate PDF', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Generate service order PDF.
   *
   * Default: save to file, return JSON { fileName, fileUrl }
   * ?output=stream → return PDF binary directly
   */
  @Post('service-order')
  async generateServiceOrder(
    @Body() dto: GenerateServiceOrderDto,
    @Query('output') output: string,
    @Res() res: Response,
  ) {
    try {
      const pdfBuffer = await this.pdfService.generateServiceOrder(dto);
      const prefix = `service-order-${dto.workOrderNo}`;

      if (output === 'stream') {
        return this.sendPdfStream(res, pdfBuffer, prefix);
      }

      return this.sendFileResponse(res, pdfBuffer, prefix);
    } catch (error) {
      this.logger.error(`Failed to generate service order: ${error.message}`, error.stack);
      throw new HttpException('Failed to generate PDF', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Download a previously generated PDF by filename.
   */
  @Get('files/:fileName')
  async downloadFile(
    @Param('fileName') fileName: string,
    @Res() res: Response,
  ) {
    const filePath = this.fileStorage.resolve(fileName);
    if (!filePath) {
      throw new NotFoundException(`File "${fileName}" not found or expired`);
    }

    res.download(filePath, fileName);
  }

  // --- Private helpers ---

  private sendFileResponse(res: Response, buffer: Buffer, prefix: string) {
    const { fileName } = this.fileStorage.save(buffer, prefix);
    const baseUrl = `${res.req.protocol}://${res.req.get('host')}`;
    const fileUrl = `${baseUrl}/pdf/files/${fileName}`;

    res.status(HttpStatus.CREATED).json({
      success: true,
      fileName,
      fileUrl,
      fileSize: buffer.length,
    });
  }

  private sendPdfStream(res: Response, buffer: Buffer, filename: string) {
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}.pdf"`,
      'Content-Length': buffer.length.toString(),
      'Access-Control-Expose-Headers': 'Content-Disposition',
    });
    res.status(HttpStatus.OK).send(buffer);
  }
}
