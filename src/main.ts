import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as config from 'config';
import { clerkMiddleware } from '@clerk/express';
import { Logger, LoggerErrorInterceptor, PinoLogger } from 'nestjs-pino';
import {
  BadRequestException,
  ValidationError,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { ValidatorOptions } from '@nestjs/common/interfaces/external/validator-options.interface';
import { RedisIoAdapter } from './messaging/shared/utils/redis-adapter';

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
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          levelFirst: true,
          translateTime: true,
          ignore: 'pid,hostname',
        },
      },
    },
  }),
  { renameContext: 'luftsocial' },
);

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger,
  });

  // Initialize Clerk with the correct middleware
  app.use(
    clerkMiddleware(),
    //   {
    // authorizedParties: ['http://localhost:3000', 'https://example.com']
    //   publishableKey: config.get('clerk.perishableKey'),
    //   secretKey: config.get('clerk.secretKey'),
    // }
  );
  app.enableVersioning({
    type: VersioningType.URI,
  });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe(options));
  app.useGlobalInterceptors(new LoggerErrorInterceptor());
  // app.set('trust proxy', 'loopback'); // Trust requests from the loopback address

  // custom adapter
  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  const swaggerConfig = new DocumentBuilder()
    .setTitle('LuftSocial API')
    .setDescription('The LuftSocial API description')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('lustsocial endpoints')
    .addServer('http://localhost:3000') // Replace with actual server URL
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
  await app.listen(config.get('port') ?? 3000);

  // const clerkClient = createClerkClient({
  //   secretKey: config.get('clerk.secretKey'),
  // });
  // const userList = await clerkClient.users.getUserList();
  // this.logger.info({ userList : userList.data });
}
bootstrap();
