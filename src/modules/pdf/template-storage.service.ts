import { Injectable, Logger, OnModuleInit, NotFoundException } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';

export interface StoredTemplate {
  id: string;
  name: string;
  projectData: Record<string, unknown>;
  html: string;
  css: string;
  createdAt: string;
  updatedAt: string;
}

const TEMPLATES_DIR = path.join(process.cwd(), 'data/templates');

@Injectable()
export class TemplateStorageService implements OnModuleInit {
  private readonly logger = new Logger(TemplateStorageService.name);

  onModuleInit() {
    fs.mkdirSync(TEMPLATES_DIR, { recursive: true });
    this.logger.log(`Template storage at ${TEMPLATES_DIR}`);
  }

  list(): Omit<StoredTemplate, 'projectData' | 'html' | 'css'>[] {
    if (!fs.existsSync(TEMPLATES_DIR)) return [];
    return fs
      .readdirSync(TEMPLATES_DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => {
        const tpl = this.readFile(f);
        return { id: tpl.id, name: tpl.name, createdAt: tpl.createdAt, updatedAt: tpl.updatedAt };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  get(id: string): StoredTemplate {
    const filePath = this.resolvePath(id);
    if (!filePath || !fs.existsSync(filePath)) {
      throw new NotFoundException(`Template "${id}" not found`);
    }
    return this.readFile(path.basename(filePath));
  }

  create(data: { name: string; projectData: Record<string, unknown>; html: string; css: string }): StoredTemplate {
    const id = randomUUID().slice(0, 8);
    const now = new Date().toISOString();
    const tpl: StoredTemplate = {
      id,
      name: data.name,
      projectData: data.projectData,
      html: data.html,
      css: data.css,
      createdAt: now,
      updatedAt: now,
    };
    this.writeFile(tpl);
    this.logger.log(`Created template: ${tpl.name} (${id})`);
    return tpl;
  }

  update(id: string, data: Partial<{ name: string; projectData: Record<string, unknown>; html: string; css: string }>): StoredTemplate {
    const existing = this.get(id);
    const updated: StoredTemplate = {
      ...existing,
      ...data,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };
    this.writeFile(updated);
    this.logger.log(`Updated template: ${updated.name} (${id})`);
    return updated;
  }

  delete(id: string): void {
    const filePath = this.resolvePath(id);
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      this.logger.log(`Deleted template: ${id}`);
    }
  }

  private resolvePath(id: string): string | null {
    const safe = id.replace(/[^a-zA-Z0-9-]/g, '');
    const filePath = path.join(TEMPLATES_DIR, `${safe}.json`);
    if (!filePath.startsWith(TEMPLATES_DIR)) return null;
    return filePath;
  }

  private readFile(filename: string): StoredTemplate {
    const content = fs.readFileSync(path.join(TEMPLATES_DIR, filename), 'utf-8');
    return JSON.parse(content) as StoredTemplate;
  }

  private writeFile(tpl: StoredTemplate): void {
    const filePath = path.join(TEMPLATES_DIR, `${tpl.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(tpl, null, 2));
  }
}
