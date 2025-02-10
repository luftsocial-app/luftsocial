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
import { InstagramApiException } from '../helpers/instagram-api.exception';

@Injectable()
export class InstagramErrorInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      catchError((error) => {
        if (error instanceof InstagramApiException) {
          switch (error.errorCode) {
            case '190': // Invalid access token
            case '463': // Token expired
              return throwError(
                () =>
                  new HttpException(
                    'Instagram session expired',
                    HttpStatus.UNAUTHORIZED,
                  ),
              );

            case '10': // Permission error
            case '200':
              return throwError(
                () =>
                  new HttpException(
                    'Insufficient permissions',
                    HttpStatus.FORBIDDEN,
                  ),
              );

            case '24': // Rate limit error
              return throwError(
                () =>
                  new HttpException(
                    'Rate limit exceeded',
                    HttpStatus.TOO_MANY_REQUESTS,
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
                    'Instagram API error',
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
