import { Test, TestingModule } from '@nestjs/testing';
import { GroupMemberController } from './group-member.controller';
import { GroupMemberService } from './group-member.service';
import * as Chance from 'chance';
import { GroupRole } from '../../common/enums/roles';

const chance = new Chance();

describe('GroupMemberController', () => {
  let controller: GroupMemberController;

  const mockGroupMemberService = {
    addMember: jest.fn(),
    removeMember: jest.fn(),
    updateMemberRole: jest.fn(),
    getGroupMembers: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GroupMemberController],
      providers: [
        {
          provide: GroupMemberService,
          useValue: mockGroupMemberService,
        },
      ],
    }).compile();

    controller = module.get<GroupMemberController>(GroupMemberController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('addMember', () => {
    it('should add a member to group', async () => {
      const mockUser = {
        id: chance.guid(),
        name: chance.name(),
        email: chance.email(),
      };

      const mockOrgId = chance.guid();
      const mockGroupId = chance.guid();

      const mockReq = {
        auth: {
          orgId: mockOrgId,
        },
      };

      const mockAddMemberDto = {
        groupId: mockGroupId,
        userId: chance.guid(),
        role: chance.pickone(Object.values(GroupRole)),
      };

      const expectedResult = {
        status: 1,
        message: 'User added to the group successfully',
        data: {
          id: chance.integer({ min: 1, max: 1000 }),
          userId: mockAddMemberDto.userId,
          groupId: mockGroupId,
          role: mockAddMemberDto.role,
          createdAt: chance.date(),
        },
      };

      mockGroupMemberService.addMember.mockResolvedValue(expectedResult);

      const result = await controller.addMember(
        mockUser,
        mockGroupId,
        mockAddMemberDto,
        mockReq as any,
      );

      expect(result).toEqual(expectedResult);
      expect(mockGroupMemberService.addMember).toHaveBeenCalledWith(
        mockUser.id,
        mockOrgId,
        { ...mockAddMemberDto, groupId: mockGroupId },
      );
    });
  });

  describe('removeMember', () => {
    it('should remove a member from group', async () => {
      const mockUser = { id: '1' };
      const mockReq = { auth: { orgId: '1' } };
      const expectedResult = {
        status: 1,
        message: 'User removed from the group successfully',
      };

      mockGroupMemberService.removeMember.mockResolvedValue(expectedResult);

      const result = await controller.removeMember(
        mockUser,
        '1',
        '2',
        mockReq as any,
      );

      expect(result).toEqual(expectedResult);
    });
  });

  describe('updateRole', () => {
    it('should update member role', async () => {
      const mockUser = { id: chance.guid() };
      const mockGroupId = chance.guid();
      const mockOrgId = chance.guid();
      const mockUpdateRoleDto = {
        userId: chance.guid(),
        role: chance.pickone(['ADMIN', 'MEMBER']),
        newRole: GroupRole.MODERATOR,
      };
      const mockReq = { auth: { orgId: mockOrgId } };
      const expectedResult = {
        status: 1,
        message: 'Role updated successfully',
        data: {
          id: chance.integer(),
          ...mockUpdateRoleDto,
          groupId: mockGroupId,
          updatedAt: chance.date(),
        },
      };

      mockGroupMemberService.updateMemberRole.mockResolvedValue(expectedResult);

      const result = await controller.updateRole(
        mockUser,
        mockGroupId,
        mockUpdateRoleDto,
        mockReq as any,
      );

      expect(result).toEqual(expectedResult);
      expect(mockGroupMemberService.updateMemberRole).toHaveBeenCalledWith(
        mockUser.id,
        mockOrgId,
        mockGroupId,
        mockUpdateRoleDto,
      );
    });
  });

  describe('getMembers', () => {
    it('should get all members of a group', async () => {
      const mockGroupId = chance.guid();
      const mockOrgId = chance.guid();
      const mockReq = { auth: { orgId: mockOrgId } };
      const mockMembers = Array.from({ length: 3 }, () => ({
        id: chance.integer(),
        userId: chance.guid(),
        groupId: mockGroupId,
        role: chance.pickone(['ADMIN', 'MEMBER']),
      }));

      mockGroupMemberService.getGroupMembers.mockResolvedValue(mockMembers);

      const result = await controller.getMembers(mockGroupId, mockReq as any);

      expect(result).toEqual(mockMembers);
      expect(mockGroupMemberService.getGroupMembers).toHaveBeenCalledWith(
        mockGroupId,
        mockOrgId,
      );
    });
  });
});
