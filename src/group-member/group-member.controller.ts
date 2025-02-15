import { Controller, Post, Body, UseGuards, Res, HttpStatus, HttpException, Req, Delete, Param } from '@nestjs/common';
import { GroupMemberService } from './group-member.service';
import { GroupDto, GroupMemberDto } from '../dto/base.dto';
// import { AuthMiddleware } from '../middleware/AuthMiddleware';
import { Response } from 'express';
@Controller('group-member')
export class GroupMemberController {
    constructor(private readonly groupMemberService: GroupMemberService) { }

    // @UseGuards(AuthMiddleware)
    @Post('add-member')
    async addMember(@Body() groupMemberDto: GroupMemberDto, @Res() res: Response, @Req() req) {
        try {
            // const { id } = req.user
            const userId = req?.user?.id ?? "1"
            const { data, status } = await this.groupMemberService.addMember(groupMemberDto, userId);
            if (status === 1) {
                return res.status(HttpStatus.OK).json({ message: 'User added to the group successfully.', status: 1, data });
            } else if (status === 2) {
                return res.status(HttpStatus.OK).json({ message: 'Group not found.', status: 2, data });
            } else if (status === 3) {
                return res.status(HttpStatus.FORBIDDEN).json({ message: 'Only admins can add members.', status: 3, data });
            } else if (status === 4) {
                return res.status(HttpStatus.OK).json({ message: 'User is already a member.', status: 4, data });
            } else if (status === 0) {
                return res.status(HttpStatus.BAD_REQUEST).json({ message: 'Failed to add a user. Please try again ', status: 0, data });
            }
        } catch (err) {
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: err.message, status: 'error' });
        }
    }

    @Delete('remove-member/:groupId/:userId')
    async removeMember(@Param('groupId') groupId: string, @Param('userId') userId: string, @Res() res: Response, @Req() req) {
        try {
            const id = req?.user?.id ?? "1"
            const { status, message } = await this.groupMemberService.removeMember(groupId, userId, id);
            if (status === 1) {
                return res.status(HttpStatus.OK).json({ message, status });
            } else if (status === 2) {
                return res.status(HttpStatus.OK).json({ message, status });
            } else if (status === 3) {
                return res.status(HttpStatus.FORBIDDEN).json({ message, status });
            } else if (status === 0) {
                return res.status(HttpStatus.BAD_REQUEST).json({ message, status });
            }
        } catch (err) {
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: err.message, status: 'error' });
        }
    }
}
