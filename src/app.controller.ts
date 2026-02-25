import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import * as fs from 'node:fs';
import * as path from 'node:path';

const commit = (() => {
  try {
    return fs.readFileSync(path.join(process.cwd(), 'COMMIT'), 'utf8').trim();
  } catch {
    return 'unknown';
  }
})();

@Controller()
export class AppController {
  @Get()
  getHello() {
    return { service: 'pdf-generator', status: 'ok' };
  }

  @Get('health')
  @SkipThrottle()
  health() {
    return {
      status: 'ok',
      commit,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}
