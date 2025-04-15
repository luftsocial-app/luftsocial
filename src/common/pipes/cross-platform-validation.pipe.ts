import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
  Logger,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

@Injectable()
export class CrossPlatformValidationPipe implements PipeTransform {
  private readonly logger = new Logger(CrossPlatformValidationPipe.name);

  async transform(value: any, { metatype }: ArgumentMetadata) {
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }

    // Pre-process platform-specific params before validation
    if (value && value.platforms && Array.isArray(value.platforms)) {
      this.preprocessPlatforms(value.platforms);
    }

    const object = plainToInstance(metatype, value);

    // Validate
    const errors = await validate(object, {
      whitelist: true,
      forbidNonWhitelisted: true,
      stopAtFirstError: false,
    });

    if (errors.length > 0) {
      const simplifiedErrors = this.extractSimpleErrors(errors);

      throw new BadRequestException({
        message: 'Validation failed',
        errors: simplifiedErrors,
      });
    }

    return object;
  }

  private preprocessPlatforms(platforms: any[]): void {
    for (const platform of platforms) {
      if (!platform.platformSpecificParams) {
        continue;
      }

      // Make sure platformSpecificParams has the platform property matching the parent
      if (platform.platform) {
        platform.platformSpecificParams.platform = platform.platform;
      }
    }
  }

  private toValidate(metatype: any): boolean {
    const types: any[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }

  private extractSimpleErrors(errors: any[]): string[] {
    const simplifiedErrors: string[] = [];

    for (const error of errors) {
      const property = error.property;

      // Direct constraints at the property level
      if (error.constraints) {
        for (const [key, message] of Object.entries(error.constraints)) {
          this.logger.log(
            { key, message },
            '[CrossPlatformValidationPipe] - extractSimpleErrors',
          );
          simplifiedErrors.push(`${property}: ${message}`);
        }
      }

      // Handle nested errors
      if (error.children && error.children.length > 0) {
        this.processNestedErrors(error.children, property, simplifiedErrors);
      }
    }

    return simplifiedErrors;
  }

  private processNestedErrors(
    children: any[],
    parentPath: string,
    errors: string[],
  ): void {
    for (const child of children) {
      const path = `${parentPath}.${child.property}`;

      // Add constraints
      if (child.constraints) {
        for (const [key, message] of Object.entries(child.constraints)) {
          this.logger.log(
            { key, message },
            '[CrossPlatformValidationPipe] - processNestedErrors',
          );

          errors.push(`${path}: ${message}`);
        }
      }

      // Check for platforms array
      if (parentPath === 'platforms' && !isNaN(Number(child.property))) {
        const platformIndex = Number(child.property);
        this.processPlatformErrors(child.children, platformIndex, errors);
      }
      // Handle other nested children
      else if (child.children && child.children.length > 0) {
        this.processNestedErrors(child.children, path, errors);
      }
    }
  }

  private processPlatformErrors(
    children: any[],
    platformIndex: number,
    errors: string[],
  ): void {
    for (const child of children) {
      const path = `platforms[${platformIndex}].${child.property}`;

      if (child.constraints) {
        for (const [key, message] of Object.entries(child.constraints)) {
          this.logger.log(
            { key, message },
            '[CrossPlatformValidationPipe] - processPlatformErrors',
          );
          errors.push(`${path}: ${message}`);
        }
      }

      if (child.children && child.children.length > 0) {
        if (child.property === 'platformSpecificParams') {
          this.processSpecificParamsErrors(
            child.children,
            platformIndex,
            errors,
          );
        } else {
          this.processNestedErrors(child.children, path, errors);
        }
      }
    }
  }

  private processSpecificParamsErrors(
    children: any[],
    platformIndex: number,
    errors: string[],
  ): void {
    for (const child of children) {
      const path = `platforms[${platformIndex}].platformSpecificParams.${child.property}`;

      if (child.constraints) {
        for (const [key, message] of Object.entries(child.constraints)) {
          // Special case for platform-specific validation errors
          if (key === 'unknownValue' && child.property === '') {
            errors.push(
              `platforms[${platformIndex}].platformSpecificParams: Must include the platform property matching the parent platform value`,
            );
          } else {
            errors.push(`${path}: ${message}`);
          }
        }
      }

      if (child.children && child.children.length > 0) {
        this.processNestedErrors(child.children, path, errors);
      }
    }
  }
}
