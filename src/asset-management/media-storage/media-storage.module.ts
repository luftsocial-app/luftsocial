import { Module } from '@nestjs/common';
import { MediaStorageService } from './media-storage.service';
import { MediaStorageController } from './media-storage.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostAsset } from '../entities/post-asset.entity';
import { TenantModule } from '../../user-management/tenant/tenant.module';

@Module({
  imports: [TypeOrmModule.forFeature([PostAsset]), TenantModule],
  providers: [MediaStorageService],
  exports: [MediaStorageService],
  controllers: [MediaStorageController],
})
export class MediaStorageModule {}
