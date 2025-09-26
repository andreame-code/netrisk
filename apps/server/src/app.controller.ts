import { Controller, Get } from '@nestjs/common';
import { AppService, type HealthResponse } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  getHealth(): Promise<HealthResponse> {
    return this.appService.getHealth();
  }
}
