import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';

const OUTPUT_DIR = path.join(process.cwd(), 'output');
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const PURGE_INTERVAL_MS = 60 * 60 * 1000; // every 1 hour

@Injectable()
export class FileStorageService implements OnModuleInit {
  private readonly logger = new Logger(FileStorageService.name);
  private purgeTimer: NodeJS.Timeout;

  onModuleInit() {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    this.purgeTimer = setInterval(() => this.purgeOldFiles(), PURGE_INTERVAL_MS);
    this.logger.log(`File storage ready at ${OUTPUT_DIR} (auto-purge: 24h)`);
  }

  /**
   * Save PDF buffer to disk with a unique filename.
   * Format: {prefix}-{shortId}-{timestamp}.pdf
   */
  save(buffer: Buffer, prefix: string): { fileName: string; filePath: string } {
    const shortId = randomUUID().slice(0, 8);
    const timestamp = Date.now();
    const fileName = `${prefix}-${shortId}-${timestamp}.pdf`;
    const filePath = path.join(OUTPUT_DIR, fileName);

    fs.writeFileSync(filePath, buffer);
    this.logger.log(`Saved ${fileName} (${buffer.length} bytes)`);

    return { fileName, filePath };
  }

  /**
   * Resolve absolute path for a given filename (within output dir only).
   * Returns null if file doesn't exist or path escapes output dir.
   */
  resolve(fileName: string): string | null {
    const filePath = path.join(OUTPUT_DIR, path.basename(fileName));

    if (!filePath.startsWith(OUTPUT_DIR)) return null;
    if (!fs.existsSync(filePath)) return null;

    return filePath;
  }

  /**
   * Delete files older than MAX_AGE_MS.
   */
  private purgeOldFiles() {
    if (!fs.existsSync(OUTPUT_DIR)) return;

    const now = Date.now();
    let purged = 0;

    for (const file of fs.readdirSync(OUTPUT_DIR)) {
      if (!file.endsWith('.pdf')) continue;

      const filePath = path.join(OUTPUT_DIR, file);
      const stat = fs.statSync(filePath);

      if (now - stat.mtimeMs > MAX_AGE_MS) {
        fs.unlinkSync(filePath);
        purged++;
      }
    }

    if (purged > 0) {
      this.logger.log(`Purged ${purged} expired PDF file(s)`);
    }
  }
}
