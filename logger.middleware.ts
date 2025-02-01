import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Log request details
    console.log('=============Request Start=============');
    console.log('Request Method:', req.method);
    console.log('Request URL:', req.originalUrl);
    console.log('Request Headers:', req.headers);
    console.log('Request Body:', req.body);
    console.log('==============Request END==============');

    // Capture the original send method to log the response body
    const originalSend = res.send;

    res.send = function (body) {
      // Log response details
      console.log('=============Response Start=============');
      console.log('Response Status Code:', res.statusCode);
      console.log('Response Headers:', res.getHeaders());
      console.log('Response Body:', body);
      console.log('==============Response END==============');

      // Call the original send method to send the response body
      return originalSend.call(this, body);
    };

    next();
  }
}
