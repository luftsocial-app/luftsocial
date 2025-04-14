import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import { CreateTenantDto, UpdateTenantDto } from './dto/TenantDto';
import { TenantService } from './tenant.service';

@Controller('tenants')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Post()
  createTodo(@Req() req: Request, @Body() data: CreateTenantDto) {
    this.tenantService.createTodo(data);
    return HttpStatus.CREATED;
  }

  @Get('/:uuid')
  getTenant(@Req() req: Request, @Param('uuid') uuid: string) {
    return this.tenantService.getTenant(uuid);
  }

  @Put('/:uuid')
  updateTenant(
    @Req() req: Request,
    @Param('uuid') uuid: string,
    @Body() data: UpdateTenantDto,
  ) {
    this.tenantService.updateTodo(uuid, data);
    return HttpStatus.NO_CONTENT;
  }

  @Delete('/:uuid')
  deleteTodo(@Req() req: Request, @Param('uuid') uuid: string) {
    this.tenantService.delete(uuid);
    return HttpStatus.ACCEPTED;
  }
}
