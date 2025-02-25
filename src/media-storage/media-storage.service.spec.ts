import { Test, TestingModule } from '@nestjs/testing';
import { MediaStorageService } from './media-storage.service';

describe('MediaStorageService', () => {
  let service: MediaStorageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MediaStorageService],
    }).compile();

    service = module.get<MediaStorageService>(MediaStorageService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
