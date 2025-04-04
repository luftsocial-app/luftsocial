import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class RequestInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RequestInterceptor.name);
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    this.logger.log('Intercepted Request:', {
      user: request.user,
      body: request.body,
    });

    // You can manipulate the request here if necessary
    // For example, add custom headers or log specific data

    // Proceed to the next handler
    return next.handle().pipe(
      tap((data) => {
        // You can manipulate the response data if needed
        this.logger.log('Response:', data);
      }),
    );
  }
}
