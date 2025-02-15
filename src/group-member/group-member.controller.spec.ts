import { Test, TestingModule } from '@nestjs/testing';
import { GroupMemberController } from './group-member.controller';
import { GroupMemberService } from './group-member.service';
import { HttpStatus } from '@nestjs/common';
import { Response } from 'express';

const mockGroupMemberDto = {
  id: "1",
  userId: "2",
  groupId: "3",
};

const mockResponse = {
  status: HttpStatus.OK,
  data: {
    userId: "2",
    groupId: "3",
  },
  message: 'User added to the group successfully.',
};

describe('GroupMemberController', () => {
  let controller: GroupMemberController;
  let service: GroupMemberService;

  const mockGroupMemberService = {
    addMember: jest.fn().mockResolvedValue(mockResponse),
    removeMember: jest.fn().mockResolvedValue({
      status: 1,
      message: 'User removed from the group successfully.',
    }),
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
    service = module.get<GroupMemberService>(GroupMemberService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('addMember', () => {
    it('should add a member successfully', async () => {
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const req = { user: { id: "1" } };
  
      mockGroupMemberService.addMember.mockResolvedValue({
        status: 1,
        message: 'User added to the group successfully.',
        data: mockResponse.data,
      });
  
      await controller.addMember(
        mockGroupMemberDto,
        res as unknown as Response,
        req as any,
      );
  
      expect(service.addMember).toHaveBeenCalledWith(mockGroupMemberDto, "1");
      expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(res.json).toHaveBeenCalledWith({
        message: 'User added to the group successfully.',
        status: 1,
        data: mockResponse.data,
      });
    });  

    it('should handle error if group is not found', async () => {
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const req = { user: { id: "1" } };

      mockGroupMemberService.addMember.mockResolvedValue({
        status: 2,
        message: 'Group not found.',
        data: null,
      });

      await controller.addMember(
        mockGroupMemberDto,
        res as unknown as Response,
        req as any,
      );

      expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Group not found.',
        status: 2,
        data: null,
      });
    });
  });

  describe('removeMember', () => {
    it('should remove a member successfully', async () => {
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const req = { user: { id: "1" } }; // Mocked user ID

      await controller.removeMember(
        "1",
        "2",
        res as unknown as Response,
        req as any,
      );

      expect(service.removeMember).toHaveBeenCalledWith("1", "2", "1");
      expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(res.json).toHaveBeenCalledWith({
        message: 'User removed from the group successfully.',
        status: 1,
      });
    });
  });
});