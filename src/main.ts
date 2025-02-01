import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as config from 'config';

import { Logger, LoggerErrorInterceptor, PinoLogger } from 'nestjs-pino';
import {
  BadRequestException,
  ConsoleLogger,
  ValidationError,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { ValidatorOptions } from '@nestjs/common/interfaces/external/validator-options.interface';

export interface ValidationPipeOptions extends ValidatorOptions {
  transform?: boolean;
  disableErrorMessages?: boolean;
  whitelist?: boolean;
  enableDebugMessages?: boolean;
  forbidNonWhitelisted?: boolean;
  forbidUnknownValues: boolean;
  exceptionFactory?: (errors: ValidationError[]) => BadRequestException;
}

const options: ValidationPipeOptions = {
  transform: true,
  disableErrorMessages: false, // set to true in production to avoid showing exact error messages
  whitelist: true,
  forbidNonWhitelisted: true,
  forbidUnknownValues: true,
  enableDebugMessages: true,
  exceptionFactory: (errors) =>
    new BadRequestException({ errors, message: 'validation failed' }),
};

const logger: Logger = new Logger(
  new PinoLogger({
    pinoHttp: {
      ...config.get('logger'),
    },
  }),
  { renameContext: 'starter-template' },
);

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // logger,
    logger: new ConsoleLogger({
      json: true,
      colors: true,
    }),
  });
  app.enableVersioning({
    type: VersioningType.URI,
  });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe(options));
  app.useGlobalInterceptors(new LoggerErrorInterceptor());
  // app.set('trust proxy', 'loopback'); // Trust requests from the loopback address

  const swaggerConfig = new DocumentBuilder()
    .setTitle('User Profile Service')
    .setDescription('User Profile Service API description')
    .setVersion('1.0')
    .addTag('user-profile-service')
    .addServer('http://localhost:3000') // Replace with actual server URL
    .addSecurity('token', {
      type: 'apiKey',
      scheme: 'api_key',
      in: 'header',
      name: 'auth-token',
    })
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      'access-token',
    )
    .build();

  const documentFactory = () =>
    SwaggerModule.createDocument(app, swaggerConfig);

  SwaggerModule.setup('/api-docs', app, documentFactory, {
    jsonDocumentUrl: 'swagger/json',
    swaggerOptions: {
      swaggerOptions: {
        authAction: {
          Bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, // Apply globally, Replace with actual auth action
        },
      },
    },
    customSiteTitle: 'Custom API Docs',
  });
  // app.enableCors({
  //   origin: '*',
  //   methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  //   preflightContinue: false,
  //   optionsSuccessStatus: 204,
  // });
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
