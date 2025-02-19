import { Test, TestingModule } from '@nestjs/testing';
import { GroupController } from './group.controller';
import { GroupService } from './group.service';
import { GroupDto, GroupMemberDto } from '../../../dto/base.dto';
import { Response } from 'express';
import { HttpStatus } from '@nestjs/common';

describe('GroupController', () => {
  let controller: GroupController;
  let service: GroupService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GroupController],
      providers: [
        {
          provide: GroupService,
          useValue: {
            createGroup: jest.fn(),
            joinGroup: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<GroupController>(GroupController);
    service = module.get<GroupService>(GroupService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createGroup', () => {
    it('should successfully create a group', async () => {
      const groupDto: GroupDto = { name: 'Test Group', description: 'Test Description' };
      const userId = "1";
      const res: Partial<Response> = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      jest.spyOn(service, 'createGroup').mockResolvedValue({
        data: { id: "1", ...groupDto, createdBy: userId },
        status: 1,
      });

      await controller.createGroup(groupDto, res as Response, { user: { id: userId } });
      expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Group created successfully',
        status: 1,
        data: { id: "1", ...groupDto, createdBy: userId },
      });
    });

    it('should fail to create a group', async () => {
      const groupDto: GroupDto = { name: 'Test Group', description: 'Test Description' };
      const res: Partial<Response> = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      jest.spyOn(service, 'createGroup').mockResolvedValue({ data: null, status: 0 });

      await controller.createGroup(groupDto, res as Response, { user: { id: "1" } });
      expect(res.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Group creation failed. Please try again.',
        status: 0,
        data: null,
      });
    });
  });

  describe('joinGroup', () => {
    it('should successfully join a group', async () => {
      const joinGroupDto: GroupMemberDto = { userId: "1", groupId: "1" };
      const res: Partial<Response> = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      jest.spyOn(service, 'joinGroup').mockResolvedValue({ status: 1, data: {} });

      await controller.joinGroup(joinGroupDto, res as Response);
      expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(res.json).toHaveBeenCalledWith({
        message: 'User joined the group successfully.',
        status: 1,
        data: {},
      });
    });

    it('should fail to join a group because group not found', async () => {
      const joinGroupDto: GroupMemberDto = { userId: "1", groupId: "1" };
      const res: Partial<Response> = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      jest.spyOn(service, 'joinGroup').mockResolvedValue({ status: 2, data: null });

      await controller.joinGroup(joinGroupDto, res as Response);
      expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Group not found.',
        status: 2,
        data: null,
      });
    });
  });
});
