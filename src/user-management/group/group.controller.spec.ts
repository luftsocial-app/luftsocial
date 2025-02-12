import { Test, TestingModule } from '@nestjs/testing';
import { GroupController } from './group.controller';
import { GroupService } from './group.service';
import { HttpException, HttpStatus } from '@nestjs/common';
import * as Chance from 'chance';

const chance = new Chance();

describe('GroupController', () => {
  let controller: GroupController;

  const mockGroupService = {
    createGroup: jest.fn(),
    joinGroup: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    getGroupMembers: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GroupController],
      providers: [
        {
          provide: GroupService,
          useValue: mockGroupService,
        },
      ],
    }).compile();

    controller = module.get<GroupController>(GroupController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createGroup', () => {
    it('should create a group', async () => {
      const mockUserId = chance.guid();
      const mockTenantId = chance.guid();

      const mockRequest = {
        auth: {
          userId: mockUserId,
          orgId: mockTenantId,
        },
      };

      const mockGroupDto = {
        name: chance.word(),
        description: chance.sentence(),
        type: chance.pickone(['PUBLIC', 'PRIVATE']),
        tenantId: mockTenantId,
      };

      const expectedResult = {
        data: {
          id: chance.integer(),
          ...mockGroupDto,
          tenantId: mockTenantId,
          createdBy: mockUserId,
          createdAt: chance.date(),
          updatedAt: chance.date(),
        },
        status: HttpStatus.CREATED,
      };

      mockGroupService.createGroup.mockResolvedValue(expectedResult);

      const result = await controller.createGroup(mockRequest, mockGroupDto);

      expect(result).toEqual(expectedResult);
      expect(mockGroupService.createGroup).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockGroupDto,
          tenantId: mockTenantId,
        }),
        mockUserId,
      );
    });

    it('should throw error when tenantId is missing', async () => {
      const mockRequest = { auth: {} };
      const mockGroupDto = { name: 'Test Group', tenantId: chance.guid() };

      await expect(
        controller.createGroup(mockRequest, mockGroupDto),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('getGroups', () => {
    it('should return all groups', async () => {
      const mockGroups = Array.from({ length: 3 }, () => ({
        id: chance.integer({ min: 1, max: 1000 }),
        name: chance.name(),
        description: chance.paragraph(),
        type: chance.pickone(['PUBLIC', 'PRIVATE']),
        tenantId: chance.guid(),
        createdAt: chance.date(),
        updatedAt: chance.date(),
      }));

      const expectedGroups = {
        data: mockGroups,
        status: HttpStatus.OK,
      };

      mockGroupService.findAll.mockResolvedValue(expectedGroups);

      const result = await controller.getGroups();

      expect(result).toEqual(expectedGroups);
      expect(mockGroupService.findAll).toHaveBeenCalled();
    });
  });

  describe('joinGroup', () => {
    it('should join a group successfully', async () => {
      const mockRequest = {
        auth: {
          userId: chance.guid(),
          orgId: chance.guid(),
        },
      };
      const mockJoinDto = {
        userId: mockRequest.auth.userId,
        groupId: chance.guid(),
        tenantId: mockRequest.auth.orgId,
      };
      const expectedResult = {
        status: 1,
        data: {
          id: chance.integer(),
          ...mockJoinDto,
          createdAt: chance.date(),
        },
      };

      mockGroupService.joinGroup.mockResolvedValue(expectedResult);
      const result = await controller.joinGroup(mockRequest, mockJoinDto);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('getGroup', () => {
    it('should get a single group', async () => {
      const mockGroupId = chance.guid();
      const mockGroup = {
        id: mockGroupId,
        name: chance.word(),
        description: chance.sentence(),
        type: chance.pickone(['PUBLIC', 'PRIVATE']),
        tenantId: chance.guid(),
        members: [],
        user: {
          id: chance.integer(),
          name: chance.name(),
        },
        createdAt: chance.date(),
        updatedAt: chance.date(),
      };

      const expectedResult = {
        data: mockGroup,
        status: HttpStatus.OK,
      };

      mockGroupService.findOne.mockResolvedValue(expectedResult);

      const result = await controller.getGroup({}, mockGroupId);

      expect(result).toEqual(expectedResult);
      expect(mockGroupService.findOne).toHaveBeenCalledWith(mockGroupId);
    });
  });

  describe('getGroupMembers', () => {
    it('should get group members', async () => {
      const groupId = chance.guid();
      const mockMembers = Array.from({ length: 3 }, () => ({
        id: chance.integer(),
        userId: chance.guid(),
        groupId,
        role: chance.pickone(['ADMIN', 'MEMBER']),
      }));
      const expectedResult = {
        data: mockMembers,
        status: HttpStatus.OK,
      };

      mockGroupService.getGroupMembers.mockResolvedValue(expectedResult);
      const result = await controller.getGroupMembers({}, groupId);
      expect(result).toEqual(expectedResult);
    });
  });
});
