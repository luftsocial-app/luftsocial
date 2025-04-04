import { Test, TestingModule } from '@nestjs/testing';
import { MediaStorageController } from './media-storage.controller';

describe('MediaStorageController', () => {
  let controller: MediaStorageController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MediaStorageController],
    }).compile();

    controller = module.get<MediaStorageController>(MediaStorageController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
