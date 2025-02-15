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
import { LinkedInApiException } from 'src/platforms/linkedin/helpers/linkedin-api.exception';

@Injectable()
export class LinkedInErrorInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      catchError((error) => {
        if (error instanceof LinkedInApiException) {
          if (error.originalError?.response?.status === 401) {
            return throwError(
              () =>
                new HttpException(
                  'LinkedIn session expired',
                  HttpStatus.UNAUTHORIZED,
                ),
            );
          }
          if (error.originalError?.response?.status === 403) {
            return throwError(
              () =>
                new HttpException(
                  'Insufficient permissions',
                  HttpStatus.FORBIDDEN,
                ),
            );
          }
          if (error.originalError?.response?.status === 400) {
            return throwError(
              () => new HttpException(error.message, HttpStatus.BAD_REQUEST),
            );
          }
        }
        return throwError(() => error);
      }),
    );
  }
}
