import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import {
  // HealthCheckService,
  // HttpHealthIndicator,
  // TypeOrmHealthIndicator,
  TerminusModule,
} from '@nestjs/terminus';
import { LoggerModule } from 'nestjs-pino';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [TerminusModule, LoggerModule.forRoot()], // Import TerminusModule so it provides all dependencies
      controllers: [HealthController],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
