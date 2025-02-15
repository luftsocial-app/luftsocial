import { Controller, Post, Body, UseGuards, Res, HttpStatus, HttpException, Req, Delete, Param } from '@nestjs/common';
import { GroupService } from './group.service';
import { GroupDto, GroupMemberDto } from '../dto/base.dto';
// import { AuthMiddleware } from '../middleware/AuthMiddleware';
import { Response } from 'express';
@Controller('groups')
export class GroupController {
    constructor(private readonly groupService: GroupService) { }

    // @UseGuards(AuthMiddleware)
    @Post('/create')
    async createGroup(@Body() groupDto: GroupDto, @Res() res: Response, @Req() req) {
        try {
            const userId = req?.user?.id
            const { data, status } = await this.groupService.createGroup(groupDto, userId);
            if (status === 1) {
                return res.status(HttpStatus.OK).json({
                    message: 'Group created successfully',
                    status: 1,
                    data
                });
            }
            else if (status === 0) {
                return res.status(HttpStatus.BAD_REQUEST).json({
                    message: 'Group creation failed. Please try again.',
                    status: 0,
                    data
                });
            }
        } catch (error) {
            throw new HttpException(
                `Create-Group failed: ${error}`,
                error.status ? error.status : HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Post('join')
    async joinGroup(@Body() joinGroupDto: GroupMemberDto, @Res() res: Response) {
        try {
            const { data, status } = await this.groupService.joinGroup(joinGroupDto);
            if (status === 1) {
                return res.status(HttpStatus.OK).json({
                    message: 'User joined the group successfully.',
                    status: 1,
                    data
                });
            } else if (status === 2) {
                return res.status(HttpStatus.OK).json({
                    message: 'Group not found.',
                    status: 2,
                    data
                });
            } else if (status === 3) {
                return res.status(HttpStatus.OK).json({
                    message: 'User already joined the group.',
                    status: 0,
                    data
                });
            } else if (status === 0) {
                return res.status(HttpStatus.BAD_REQUEST).json({
                    message: 'Failed to join the group. Please try again.',
                    status: 0,
                    data
                });
            }
        } catch (err) {
            throw new HttpException(err.message || err, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
