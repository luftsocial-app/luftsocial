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

  @Get()
  getAll() {
    return this.tenantService.getAll();
  }

  @Post()
  createTodo(@Req() req: Request, @Body() data: CreateTenantDto) {
    this.tenantService.create(data);
    return HttpStatus.CREATED;
  }

  @Get('/:uuid')
  getTenant(@Req() req: Request, @Param('uuid') uuid: string) {
    return this.tenantService.get(uuid);
  }

  @Put('/:uuid')
  updateTenant(
    @Req() req: Request,
    @Param('uuid') uuid: string,
    @Body() data: UpdateTenantDto,
  ) {
    this.tenantService.update(uuid, data);
    return HttpStatus.NO_CONTENT;
  }

  @Delete('/:uuid')
  deleteTodo(@Req() req: Request, @Param('uuid') uuid: string) {
    this.tenantService.delete(uuid);
    return HttpStatus.ACCEPTED;
  }
}
