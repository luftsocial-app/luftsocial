import { All, Controller, Get, NotFoundException, Req } from '@nestjs/common';
import { AppService } from './app.service';
import { Request } from 'express';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}

@Controller('*')
export class NotFoundController {
  @All()
  notFound(@Req() req: Request) {
    throw new NotFoundException(
      'This route does not exist',
      `${req.originalUrl}`,
    );
  }
}
