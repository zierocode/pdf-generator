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
    const totalSeconds = Math.floor(process.uptime());
    const d = Math.floor(totalSeconds / 86400);
    const h = Math.floor((totalSeconds % 86400) / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const uptime = [
      d > 0 ? `${d}d` : '',
      h > 0 ? `${h}h` : '',
      m > 0 ? `${m}m` : '',
      `${s}s`,
    ].filter(Boolean).join(' ');

    return {
      status: 'ok',
      commit,
      uptime,
      timestamp: new Date().toISOString(),
    };
  }
}
