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
import { FacebookApiException } from './facebook-api.exception';

@Injectable()
export class FacebookErrorInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      catchError((error) => {
        if (error instanceof FacebookApiException) {
          // Map Facebook error codes to HTTP status codes
          switch (error.code) {
            case '190': // Invalid access token
            case '463': // Token expired
              return throwError(
                () =>
                  new HttpException(
                    'Facebook session expired',
                    HttpStatus.UNAUTHORIZED,
                  ),
              );
            case '200': // Permission error
              return throwError(
                () =>
                  new HttpException(
                    'Insufficient permissions',
                    HttpStatus.FORBIDDEN,
                  ),
              );
            case '100': // Invalid parameter
              return throwError(
                () => new HttpException(error.message, HttpStatus.BAD_REQUEST),
              );
            default:
              return throwError(
                () =>
                  new HttpException(
                    'Facebook API error',
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
