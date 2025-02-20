import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { TenantService } from '../../database/tenant.service';
import { ChatService } from '../chat/chat.service';
import { MessageService } from '../message/message.service';
import { MessageStatus } from '../../common/enums/messaging';
import { Socket, Server } from 'socket.io';
import { PinoLogger } from 'nestjs-pino';

@WebSocketGateway()
export class ChatGateway {
  @WebSocketServer()
  server: Server;

  constructor(
    private chatService: ChatService,
    private messageService: MessageService,
    private tenantService: TenantService,
    private logger: PinoLogger,
  ) {}

  @SubscribeMessage('join_chat_room')
  async handleJoinChatRoom(
    @MessageBody() conversationId: string,
    @ConnectedSocket() client: Socket,
  ) {
    const tenantId = this.tenantService.getTenantId();
    client.join(`${tenantId}_${conversationId}`);
  }

  @SubscribeMessage('send_message')
  async handleMessage(
    @MessageBody() data: { conversationId: string; content: string },
    @ConnectedSocket() client: Socket,
  ) {
    const tenantId = this.tenantService.getTenantId();
    const message = await this.chatService.createMessage(
      data.conversationId,
      data.content,
    );
    this.logger.info({ client });
    this.server
      .to(`${tenantId}_${data.conversationId}`)
      .emit('newMessage', message);
  }

  @SubscribeMessage('updateMessageStatus')
  async handleUpdateMessageStatus(
    @MessageBody() data: { messageId: string; status: MessageStatus },
  ) {
    await this.messageService.updateMessageStatus(data.messageId, data.status);
    this.server.emit('messageStatusUpdated', data);
  }
}

// import { Logger, UseFilters, UsePipes, ValidationPipe } from '@nestjs/common';
// import {
//   ConnectedSocket,
//   MessageBody,
//   OnGatewayConnection,
//   OnGatewayDisconnect,
//   SubscribeMessage,
//   WebSocketGateway,
//   WebSocketServer,
// } from '@nestjs/websockets';
// import { IsNotEmpty, IsString } from 'class-validator';
// import { Socket, Server } from 'socket.io';
// import { WebsocketsExceptionFilter } from './ws-exception.filter';

// class ChatMessage {
//   @IsNotEmpty()
//   @IsString()
//   nickname: string;
//   @IsNotEmpty()
//   @IsString()
//   message: string;
// }

// @WebSocketGateway({
//   cors: {
//     origin: '*',
//   },
// })
// // @UseFilters(new WebsocketsExceptionFilter())
// export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
//   @WebSocketServer()
//   server: Server;

//   private logger = new Logger('ChatGateway');

//   @SubscribeMessage('text-chat')
//   // @UsePipes(new ValidationPipe())
//   handleMessage(
//     @MessageBody() message: ChatMessage,
//     @ConnectedSocket() _client: Socket,
//   ) {

//     console.log(essage);

//     this.server.emit('text-chat', {
//       ...message,
//       time: new Date().toDateString(),
//     });
//   }

//   // @SubscribeMessage('sendMessage')
//   // async handleSendMessage(@MessageBody() messageDTO: MessageDTO, @ConnectedSocket() client: Socket): Promise<void> {
//   //   const message = await this.chatService.saveMessage(messageDTO);

//   //   // Emit the message to the receiver's socket
//   //   this.server.to(messageDTO.receiverId).emit('message', message);
//   // }

//   // @SubscribeMessage('joinChat')
//   // async handleJoinChat(@MessageBody() chatDTO: ChatDTO, @ConnectedSocket() client: Socket): Promise<void> {
//   //   const chat = await this.chatService.findOrCreateChat(chatDTO);

//   //   // Let both users join the chat room
//   //   client.join(chat.user1);
//   //   client.join(chat.user2);

//   //   // Send back initial messages if needed
//   //   const messages = await this.chatService.getMessagesByChatId(chat._id);
//   //   client.emit('chatMessages', messages);
//   // }

//    // it will be handled when a client connects to the server
//    handleConnection(socket: Socket) {
//     this.logger.log(`Socket connected: ${socket.id}`);
//   }

//   // it will be handled when a client disconnects from the server
//   handleDisconnect(socket: Socket) {
//     this.logger.log(`Socket disconnected: ${socket.id}`);
//   }
// }
