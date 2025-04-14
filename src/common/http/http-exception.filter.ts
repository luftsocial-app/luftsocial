import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { HttpErrorType } from './http-error-type';
import { ErrorType } from '../enums';
import { SocialPlatform } from '../enums/social-platform.enum';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  private readonly platformRequiredProps = {
    [SocialPlatform.FACEBOOK]: {
      required: ['content'],
      optional: ['privacyLevel', 'link', 'published'],
    },
    [SocialPlatform.INSTAGRAM]: {
      required: ['caption'],
      optional: ['hashtagList', 'location'],
    },
    [SocialPlatform.TIKTOK]: {
      required: ['description'],
      optional: ['soundtrack'],
    },
    [SocialPlatform.LINKEDIN]: {
      required: ['content'],
      optional: ['visibility'],
    },
  };

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse() as any;

    const message =
      typeof exceptionResponse === 'object'
        ? exceptionResponse.message || 'Validation failed'
        : exceptionResponse;

    const errorType: ErrorType | string =
      exceptionResponse?.errorType ||
      HttpErrorType[status] ||
      'UNEXPECTED_ERROR';

    const errorResponse: Record<string, any> = {
      statusCode: status,
      errorType,
      timestamp: Date.now(),
      message,
    };

    this.logger.error(
      `HTTP ${request.method} ${request.url} - ${status}\nBody: ${JSON.stringify(
        request.body,
        null,
        2,
      )}\nException: ${JSON.stringify(exceptionResponse, null, 2)}\nStack: ${
        exception.stack
      }`,
    );

    const errors: string[] = [];

    if (status === HttpStatus.BAD_REQUEST && request.body?.platforms) {
      const platformErrors = this.extractPlatformErrors(request.body);
      if (platformErrors.length) errors.push(...platformErrors);
    }

    if (Array.isArray(exceptionResponse?.errors)) {
      errors.push(...this.extractValidationErrors(exceptionResponse.errors));
    }

    if (Array.isArray(exceptionResponse?.aggregateErrors)) {
      errors.push(...exceptionResponse.aggregateErrors);
    }

    if (errors.length) {
      errorResponse.errors = errors;
    }

    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      errorResponse.message = 'Internal server error';
    }

    response.status(status).json(errorResponse);
  }

  private extractPlatformErrors(requestBody: any): string[] {
    const errors: string[] = [];

    requestBody.platforms.forEach((platformObj: any, index: number) => {
      const platformType = platformObj.platform;
      const platformParams = platformObj.platformSpecificParams;

      if (!platformType || !platformParams) {
        errors.push(
          `Missing platform or platformSpecificParams at index ${index}`,
        );
        return;
      }

      const rules = this.platformRequiredProps[platformType];
      if (!rules) return;

      // Platform mismatch
      if (platformParams.platform !== platformType) {
        errors.push(
          `Platform mismatch at index ${index}: expected "${platformType}", got "${platformParams.platform || 'undefined'}"`,
        );
      }

      // Required properties
      const missingRequired = rules.required.filter(
        (prop) => platformParams[prop] === undefined,
      );
      if (missingRequired.length) {
        errors.push(
          `Missing required properties for ${platformType} at index ${index}: ${missingRequired.join(', ')}`,
        );
      }

      // Invalid properties
      const allowedProps = [...rules.required, ...rules.optional, 'platform'];
      const invalidProps = Object.keys(platformParams).filter(
        (prop) => !allowedProps.includes(prop),
      );
      if (invalidProps.length) {
        errors.push(
          `Invalid properties in ${platformType} at index ${index}: ${invalidProps.join(', ')}`,
        );
      }
    });

    return errors;
  }

  private extractValidationErrors(errorsArray: any[]): string[] {
    const result: string[] = [];

    const recurse = (error: any, path = '') => {
      if (typeof error === 'string') {
        result.push(error);
        return;
      }

      const currentPath = path
        ? `${path}.${error?.property ?? 'unknown'}`
        : (error?.property ?? 'unknown');

      if (error.constraints && typeof error.constraints === 'object') {
        const messages = Object.values(error.constraints);
        result.push(`${currentPath}: ${messages.join(', ')}`);
      }

      if (Array.isArray(error.children) && error.children.length > 0) {
        error.children.forEach((child: any) => recurse(child, currentPath));
      }
    };

    errorsArray.forEach((error) => recurse(error));
    return result;
  }
}
