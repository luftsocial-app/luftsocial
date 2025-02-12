import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GroupService } from './group.service';
import { Group } from '../../entities/group.entity';
import { GroupMember } from '../../entities/group.members.entity';
import { TenantService } from '../../database/tenant.service';
import { HttpStatus, NotFoundException } from '@nestjs/common';

import * as Chance from 'chance';

const chance = new Chance();

describe('GroupService', () => {
  let service: GroupService;

  const mockGroupRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockGroupMemberRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(), // Added missing create method
  };

  const mockTenantService = {
    getTenantId: jest.fn().mockReturnValue('1'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroupService,
        {
          provide: getRepositoryToken(Group),
          useValue: mockGroupRepository,
        },
        {
          provide: getRepositoryToken(GroupMember),
          useValue: mockGroupMemberRepository,
        },
        {
          provide: TenantService,
          useValue: mockTenantService,
        },
      ],
    }).compile();

    service = module.get<GroupService>(GroupService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all groups for tenant', async () => {
      const mockGroups = [{ id: 1, name: 'Test Group' }];
      mockGroupRepository.find.mockResolvedValue(mockGroups);

      const result = await service.findAll();

      expect(result).toEqual({ data: mockGroups, status: HttpStatus.OK });
      expect(mockGroupRepository.find).toHaveBeenCalledWith({
        where: { tenantId: '1' },
        relations: ['members', 'user'],
      });
    });
  });

  describe('findOne', () => {
    it('should return a single group', async () => {
      const mockGroup = {
        id: chance.integer(),
        name: chance.word(),
        description: chance.sentence(),
        tenantId: '1',
        type: chance.pickone(['PUBLIC', 'PRIVATE']),
        members: [],
        user: {
          id: chance.integer(),
          name: chance.name(),
        },
        createdAt: chance.date(),
        updatedAt: chance.date(),
      };

      mockGroupRepository.findOne.mockResolvedValue(mockGroup);
      const result = await service.findOne(String(mockGroup.id));

      expect(result).toEqual({
        data: mockGroup,
        status: HttpStatus.OK,
      });
      expect(mockGroupRepository.findOne).toHaveBeenCalledWith({
        where: {
          id: String(mockGroup.id),
          tenantId: '1',
        },
        relations: ['members', 'user'],
      });
    });

    it('should throw NotFoundException when group not found', async () => {
      mockGroupRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createGroup', () => {
    it('should create a new group', async () => {
      const mockUserId = chance.guid();
      const mockTenantId = '1';

      const groupDto = {
        name: chance.word(),
        description: chance.sentence(),
        type: chance.pickone(['PUBLIC', 'PRIVATE']),
        tenantId: mockTenantId,
      };

      const mockGroup = {
        id: chance.integer(),
        ...groupDto,
        createdBy: mockUserId,
        members: [],
        createdAt: chance.date(),
        updatedAt: chance.date(),
      };

      const mockGroupMember = {
        id: chance.integer(),
        userId: mockUserId,
        groupId: mockGroup.id,
        status: true,
        tenantId: mockTenantId,
        role: 'ADMIN',
      };

      mockGroupRepository.create.mockReturnValue(mockGroup);
      mockGroupRepository.save.mockResolvedValue(mockGroup);
      mockGroupMemberRepository.save.mockResolvedValue(mockGroupMember);

      const result = await service.createGroup(groupDto, mockUserId);

      expect(result).toEqual({
        data: mockGroup,
        status: HttpStatus.CREATED,
      });
      expect(mockGroupRepository.create).toHaveBeenCalledWith({
        ...groupDto,
        createdBy: mockUserId,
        tenantId: mockTenantId,
      });
      expect(mockGroupMemberRepository.save).toHaveBeenCalledWith({
        status: true,
        tenantId: mockTenantId,
      });
    });
  });
});
