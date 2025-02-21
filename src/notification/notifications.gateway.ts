// import {
//   WebSocketGateway,
//   SubscribeMessage,
//   MessageBody,
//   ConnectedSocket,
//   OnGatewayConnection,
//   OnGatewayDisconnect,
//   WebSocketServer,
// } from '@nestjs/websockets';
// import { PinoLogger } from 'nestjs-pino';
// import { Socket, Server } from 'socket.io';
// import { NotificationsService } from './notifications.service'

// @WebSocketGateway()
// export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
//   private readonly logger: PinoLogger;
//   private users: Map<string, Socket> = new Map();

//   @WebSocketServer() server: Server;

//   constructor(private readonly notificationsService: NotificationsService) { }


//   handleConnection(client: Socket) {
//     const userId = client.handshake.query.userId as string;
//     if (!userId) {
//       this.logger.warn('Connection attempt without userId.');
//       client.disconnect();
//       return;
//     }

//     this.users.set(userId, client);
//     this.logger.info(`User connected: ${userId}`);
//   }

//   handleDisconnect(client: Socket) {
//     this.users.forEach((socket, userId) => {
//       if (socket.id === client.id) {
//         this.users.delete(userId);
//         this.logger.info(`User disconnected: ${userId}`);
//       }
//     });
//   }

//   @SubscribeMessage('send_notification_to_user')
//   async handleNotification(
//     @MessageBody() data: { userId: string; message: string },
//     @ConnectedSocket() client: Socket,
//   ) {
//     const { userId, message } = data;
//     const userSocket = this.users.get(userId);

//     // Store the notification in the database
//     try {
//       await this.notificationsService.createNotification(parseInt(userId), message);
//       this.logger.info(`Notification stored in database for user: ${userId}`);
//     } catch (error) {
//       this.logger.error(`Failed to store notification: ${error.message}`);
//       client.emit('error', { message: 'Failed to store notification.' });
//       return;
//     }

//     if (userSocket) {
//       userSocket.emit('receive_notification', { message });
//       this.logger.info(`Notification sent to user: ${userId}`);
//     } else {
//       this.logger.info(`User ${userId} is not connected.`);
//       client.emit('error', { message: `User ${userId} is not connected.` });
//     }
//   }

//   @SubscribeMessage('send_notification_to_all')
//   handleBroadcastNotification(@MessageBody() data: { message: string }, @ConnectedSocket() client: Socket) {
//     client.broadcast.emit('receive_notification', data);
//   }
// }

