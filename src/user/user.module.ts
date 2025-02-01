import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Users } from '../entities/user.entity';
import { AuthMiddleware } from '../middleware/AuthMiddleware';

@Module({
  providers: [UserService],
  exports: [UserService],
  controllers: [UserController],
  imports: [TypeOrmModule.forFeature([Users])],
})
export class UserModule implements NestModule {
  public configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthMiddleware)
      .forRoutes(
        { path: 'user', method: RequestMethod.GET },
        { path: 'user', method: RequestMethod.PUT },
      );
  }
}
