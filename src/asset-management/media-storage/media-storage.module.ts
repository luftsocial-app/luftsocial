import { Module } from '@nestjs/common';
import { MediaStorageService } from './media-storage.service';
import { MediaStorageController } from './media-storage.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostAsset } from '../entities/post-asset.entity';
import { UserManagementModule } from '../../user-management/user-management.module';

@Module({
  imports: [TypeOrmModule.forFeature([PostAsset]), UserManagementModule],
  providers: [MediaStorageService],
  exports: [MediaStorageService],
  controllers: [MediaStorageController],
})
export class MediaStorageModule {}
