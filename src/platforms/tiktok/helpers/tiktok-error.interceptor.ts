import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { TikTokApiException } from './tiktok-api.exception';

@Injectable()
export class TikTokErrorInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      catchError((error) => {
        if (error instanceof TikTokApiException) {
          switch (error.code) {
            case 'access_token_expired':
              return throwError(
                () =>
                  new HttpException(
                    'TikTok session expired',
                    HttpStatus.UNAUTHORIZED,
                  ),
              );

            case 'invalid_access_token':
              return throwError(
                () =>
                  new HttpException(
                    'Invalid TikTok credentials',
                    HttpStatus.UNAUTHORIZED,
                  ),
              );

            case 'rate_limit_exceeded':
              return throwError(
                () =>
                  new HttpException(
                    'Rate limit exceeded',
                    HttpStatus.TOO_MANY_REQUESTS,
                  ),
              );

            case 'invalid_parameters':
              return throwError(
                () => new HttpException(error.message, HttpStatus.BAD_REQUEST),
              );

            case 'resource_not_found':
              return throwError(
                () =>
                  new HttpException('Resource not found', HttpStatus.NOT_FOUND),
              );

            default:
              return throwError(
                () =>
                  new HttpException(
                    'TikTok API error',
                    HttpStatus.INTERNAL_SERVER_ERROR,
                  ),
              );
          }
        }
        return throwError(() => error);
      }),
    );
  }
}
