import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

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
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}
