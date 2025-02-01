import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

@Injectable()
export class SwaggerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];
    return apiKey === process.env.SWAGGER_API_KEY;
  }
}
