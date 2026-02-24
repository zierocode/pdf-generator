import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import puppeteer, { type Browser, type PDFOptions } from 'puppeteer';

const PDF_GENERATION_TIMEOUT_MS = 30_000;

/**
 * Max Chrome pages open simultaneously.
 * Each page consumes ~80-150 MB RAM (417 KB inlined CSS + Chrome subprocess).
 * Tune based on available server memory: 5 × ~120 MB ≈ 600 MB headroom.
 */
const MAX_CONCURRENT = 5;

/**
 * Max requests waiting in queue when all slots are busy.
 * Beyond this, callers receive 503 immediately instead of waiting forever.
 */
const MAX_QUEUE = 20;

/** How long a queued request will wait before giving up (ms). */
const QUEUE_TIMEOUT_MS = 60_000;

interface QueueEntry {
  resolve: () => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

@Injectable()
export class BrowserPoolService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BrowserPoolService.name);

  private browser: Browser | null = null;

  /**
   * FIX 1 — Race condition mutex.
   * Stores the in-flight launch promise so concurrent crash-recovery calls
   * all await the same promise instead of each spawning a new browser.
   */
  private launchPromise: Promise<void> | null = null;

  /** FIX 2 — Semaphore state. */
  private activePages = 0;
  private readonly queue: QueueEntry[] = [];

  // ---------------------------------------------------------------------------

  async onModuleInit() {
    await this.launchBrowser();
  }

  async onModuleDestroy() {
    for (const entry of this.queue) {
      clearTimeout(entry.timer);
      entry.reject(new Error('Server shutting down'));
    }
    this.queue.length = 0;
    await this.browser?.close();
    this.browser = null;
  }

  // ---------------------------------------------------------------------------

  async generatePdf(html: string, options?: PDFOptions): Promise<Buffer> {
    // Acquire a slot — waits in queue if MAX_CONCURRENT is reached.
    await this.acquireSlot();

    try {
      const browser = await this.ensureBrowser();
      const page = await browser.newPage();

      try {
        await page.setContent(html, { waitUntil: 'domcontentloaded' });

        const pdfBuffer = await Promise.race([
          page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '0', right: '0', bottom: '8mm', left: '0' },
            displayHeaderFooter: true,
            headerTemplate: '<span></span>',
            footerTemplate:
              '<div style="font-size:9px;color:#aaa;width:100%;text-align:right;' +
              'padding-right:8mm;font-family:sans-serif;box-sizing:border-box;">' +
              '<span class="pageNumber"></span> / <span class="totalPages"></span></div>',
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
        await page.close().catch((err: Error) => {
          this.logger.warn(`Failed to close page: ${err.message}`);
        });
      }
    } finally {
      // Always release slot — even if ensureBrowser() or newPage() threw.
      this.releaseSlot();
    }
  }

  /** Returns live concurrency stats (useful for health checks / monitoring). */
  getStats() {
    return { activePages: this.activePages, queued: this.queue.length, maxConcurrent: MAX_CONCURRENT };
  }

  // ---------------------------------------------------------------------------
  // Semaphore (FIX 2)
  // ---------------------------------------------------------------------------

  private async acquireSlot(): Promise<void> {
    if (this.activePages < MAX_CONCURRENT) {
      this.activePages++;
      this.logger.debug(`Slot acquired — active: ${this.activePages}/${MAX_CONCURRENT}`);
      return;
    }

    if (this.queue.length >= MAX_QUEUE) {
      throw new Error(
        `PDF queue full (${MAX_QUEUE} waiting) — server overloaded, try again later`,
      );
    }

    this.logger.warn(
      `All ${MAX_CONCURRENT} slots busy — queuing request (queue: ${this.queue.length + 1}/${MAX_QUEUE})`,
    );

    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.queue.indexOf(entry);
        if (idx !== -1) this.queue.splice(idx, 1);
        reject(new Error('PDF queue wait timed out — server busy'));
      }, QUEUE_TIMEOUT_MS);

      const entry: QueueEntry = { resolve, reject, timer };
      this.queue.push(entry);
    });
  }

  private releaseSlot(): void {
    const next = this.queue.shift();
    if (next) {
      clearTimeout(next.timer);
      next.resolve();
      this.logger.debug(`Slot passed to queued request — queue remaining: ${this.queue.length}`);
    } else {
      this.activePages--;
      this.logger.debug(`Slot released — active: ${this.activePages}/${MAX_CONCURRENT}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Browser lifecycle (FIX 1)
  // ---------------------------------------------------------------------------

  private async ensureBrowser(): Promise<Browser> {
    if (this.browser?.connected) return this.browser;

    // If a relaunch is already in progress, await it instead of starting another.
    if (!this.launchPromise) {
      this.logger.warn('Browser disconnected — relaunching...');
      this.launchPromise = this.launchBrowser().finally(() => {
        this.launchPromise = null;
      });
    }

    await this.launchPromise;
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
