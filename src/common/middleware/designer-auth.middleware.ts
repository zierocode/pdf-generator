import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response, NextFunction } from 'express';

@Injectable()
export class DesignerAuthMiddleware implements NestMiddleware {
  constructor(private readonly config: ConfigService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const user = this.config.get<string>('DESIGNER_USER');
    const pass = this.config.get<string>('DESIGNER_PASS');

    // No credentials configured → skip auth (dev mode)
    if (!user || !pass) {
      return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Basic ')) {
      return this.sendUnauthorized(res);
    }

    const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf-8');
    const [inputUser, inputPass] = decoded.split(':');

    if (inputUser !== user || inputPass !== pass) {
      return this.sendUnauthorized(res);
    }

    next();
  }

  private sendUnauthorized(res: Response) {
    res.set('WWW-Authenticate', 'Basic realm="PDF Template Designer"');
    res.status(401).send('Unauthorized');
  }
}
