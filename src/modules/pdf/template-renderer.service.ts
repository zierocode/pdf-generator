import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import Handlebars from 'handlebars';
import * as fs from 'node:fs';
import * as path from 'node:path';
import QRCode from 'qrcode';

@Injectable()
export class TemplateRendererService implements OnModuleInit {
  private readonly logger = new Logger(TemplateRendererService.name);
  private templates = new Map<string, HandlebarsTemplateDelegate>();
  private readonly templateDir: string;

  constructor() {
    // Resolve from project root so it works in both dev (src/) and prod (dist/)
    this.templateDir = path.join(process.cwd(), 'src/modules/pdf/templates');
    if (!fs.existsSync(this.templateDir)) {
      // Fallback for compiled dist/ — assets copied by nest-cli
      this.templateDir = path.join(__dirname, 'templates');
    }
  }

  async onModuleInit() {
    this.registerHelpers();
    this.registerPartials();
    this.compileTemplates();
    this.logger.log(
      `Loaded ${this.templates.size} templates from ${this.templateDir}`,
    );
  }

  private registerHelpers() {
    Handlebars.registerHelper(
      'numberFormat',
      (value: number, decimals?: number | object) => {
        if (value == null) return '-';
        const dec = typeof decimals === 'number' ? decimals : 2;
        return value.toLocaleString('th-TH', {
          minimumFractionDigits: dec,
          maximumFractionDigits: dec,
        });
      },
    );

    Handlebars.registerHelper('dateFormat', (value: string | Date) => {
      if (!value) return '-';
      const date = new Date(value);
      if (isNaN(date.getTime())) return String(value); // already formatted — pass through
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const buddhistYear = date.getFullYear() + 543;
      return `${day}/${month}/${buddhistYear}`;
    });

    Handlebars.registerHelper('dateTimeFormat', (value: string | Date) => {
      if (!value) return '-';
      const date = new Date(value);
      if (isNaN(date.getTime())) return String(value);
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const buddhistYear = date.getFullYear() + 543;
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${day}/${month}/${buddhistYear} ${hours}:${minutes}`;
    });

    Handlebars.registerHelper('timeFormat', (value: string | Date) => {
      if (!value) return '-';
      const date = new Date(value);
      if (isNaN(date.getTime())) return String(value);
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    });

    Handlebars.registerHelper('valueOrDash', (value: unknown) => {
      if (value === null || value === undefined || value === '') return '-';
      // Handle 0 as a valid display value
      const str = String(value);
      if (str === 'undefined' || str === 'null') return '-';
      return str;
    });

    Handlebars.registerHelper('checkMark', (value: boolean) => {
      return value ? '✓' : '';
    });

    Handlebars.registerHelper('eq', (a: unknown, b: unknown) => a === b);
    Handlebars.registerHelper(
      'gt',
      (a: number, b: number) => Number(a) > Number(b),
    );
    Handlebars.registerHelper('inc', (value: number) => Number(value) + 1);
    Handlebars.registerHelper('or', (a: unknown, b: unknown) => a || b);
  }

  private registerPartials() {
    const partialsDir = path.join(this.templateDir, 'partials');
    if (!fs.existsSync(partialsDir)) return;
    const files = fs.readdirSync(partialsDir);
    for (const file of files) {
      if (file.endsWith('.hbs')) {
        const name = file.replace('.hbs', '');
        const content = fs.readFileSync(
          path.join(partialsDir, file),
          'utf-8',
        );
        Handlebars.registerPartial(name, content);
      }
    }
  }

  private compileTemplates() {
    const files = fs.readdirSync(this.templateDir);
    for (const file of files) {
      if (file.endsWith('.hbs')) {
        const name = file.replace('.hbs', '');
        const content = fs.readFileSync(
          path.join(this.templateDir, file),
          'utf-8',
        );
        this.templates.set(name, Handlebars.compile(content));
      }
    }
  }

  render(templateName: string, data: Record<string, unknown>): string {
    const template = this.templates.get(templateName);
    if (!template) {
      throw new Error(`Template "${templateName}" not found`);
    }
    return template(data);
  }

  async generateQrCodeDataUri(text: string): Promise<string> {
    return QRCode.toDataURL(text, {
      width: 100,
      margin: 1,
      errorCorrectionLevel: 'M',
    });
  }
}
