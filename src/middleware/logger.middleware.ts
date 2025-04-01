import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  constructor(private readonly logger: PinoLogger) {
    // Initialize the logger with your desired configuration
    this.logger.setContext('LoggerMiddleware');
  }
  use(req: Request, res: Response, next: NextFunction) {
    // Log request details
    this.logger.info('=============Request Start=============');
    this.logger.info('Request Method:', req.method);
    this.logger.info('Request URL:', req.originalUrl);
    this.logger.info('Request Headers:', req.headers);
    this.logger.info('Request Body:', req.body);
    this.logger.info('==============Request END==============');
    console.log({ loggePackage: this.logger });

    // Capture the original send method to log the response body
    const originalSend = res.send;

    res.send = (body) => {
      // Log response details
      this.logger.info('=============Response Start=============');
      this.logger.info('Response Status Code:', res.statusCode);
      this.logger.info('Response Headers:', res.getHeaders());
      this.logger.info('Response Body:', body);
      this.logger.info('==============Response END==============');

      // Call the original send method to send the response body
      return originalSend.call(res, body);
    };

    next();
  }
}
