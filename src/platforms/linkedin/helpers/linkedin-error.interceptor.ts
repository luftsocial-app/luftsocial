import {
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NestInterceptor,
  UnauthorizedException,
} from '@nestjs/common';
import { catchError, Observable, throwError } from 'rxjs';

@Injectable()
export class LinkedInErrorInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      catchError((error) => {
        if (error.response?.status === 401) {
          return throwError(
            () => new UnauthorizedException('LinkedIn session expired'),
          );
        }
        if (error.response?.status === 403) {
          return throwError(
            () => new ForbiddenException('Insufficient permissions'),
          );
        }
        return throwError(
          () => new HttpException('LinkedIn API error', HttpStatus.BAD_REQUEST),
        );
      }),
    );
  }
}
