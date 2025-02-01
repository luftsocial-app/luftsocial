import { Controller, Get } from '@nestjs/common';
import {
  HealthCheckService,
  HealthCheck,
  TypeOrmHealthIndicator,
  HttpHealthIndicator,
  HealthIndicatorService,
} from '@nestjs/terminus';
import { PinoLogger } from 'nestjs-pino';
import { split } from '../../node_modules/cspell-lib/dist/lib/util/wordSplitter';

@Controller('health')
export class HealthController {
  constructor(
    private healthIndicatorService: HealthIndicatorService,
    private health: HealthCheckService,
    private typeOrmHealthIndicator: TypeOrmHealthIndicator,
    private httpHealthIndicator: HttpHealthIndicator,
    private logger: PinoLogger,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    this.logger.info('Health check');
    return this.health.check([
      () => this.httpHealthIndicator.pingCheck('localhost', '/'),
      //   () => this.typeOrmHealthIndicator.pingCheck('database'),
    ]);
  }

  async isHealthy(key: string) {
    // Start the health indicator check for the given key
    const indicator = this.healthIndicatorService.check(key);

    try {
      const stringArray = await this.getArray();
      if (stringArray.length === 0) {
        // Mark the indicator as "down" and add additional info to the response
        return indicator.down({ stringArray: stringArray.length });
      }
      // Mark the health indicator as up
      return indicator.up();
    } catch (error) {
      return indicator.down('Unable to retrieve dogs');
    }
  }

  private getArray(): string[] {
    return 'abc'.split('');
  }
}
