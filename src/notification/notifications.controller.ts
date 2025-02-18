// import { Controller, Get, Post, Body, Param, Patch } from '@nestjs/common';
// import { NotificationsService } from './notifications.service';

// @Controller('notifications')
// export class NotificationsController {
//   constructor(private readonly notificationsService: NotificationsService) {}

//   @Post()
//   async createNotification(
//     @Body() body: { userId: number; message: string },
//   ) {
//     return this.notificationsService.createNotification(body.userId, body.message);
//   }

//   @Get(':userId')
//   async getNotifications(@Param('userId') userId: number) {
//     return this.notificationsService.getNotifications(userId);
//   }

//   @Patch(':id')
//   async markAsRead(@Param('id') id: number) {
//     return this.notificationsService.markAsRead(id);
//   }
// }
