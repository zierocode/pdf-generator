import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import * as path from 'node:path';
import { AppController } from './app.controller';
import { PdfModule } from './modules/pdf/pdf.module';
import { DesignerAuthMiddleware } from './common/middleware/designer-auth.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: (config.get<number>('THROTTLE_TTL') ?? 60) * 1000,
            limit: config.get<number>('THROTTLE_LIMIT') ?? 30,
          },
        ],
      }),
    }),
    ServeStaticModule.forRoot({
      rootPath: path.join(process.cwd(), 'public/designer'),
      serveRoot: '/designer',
      serveStaticOptions: { index: ['index.html'] },
    }),
    ServeStaticModule.forRoot({
      rootPath: path.join(process.cwd(), 'assets'),
      serveRoot: '/assets',
    }),
    PdfModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(DesignerAuthMiddleware).forRoutes('/designer');
  }
}
