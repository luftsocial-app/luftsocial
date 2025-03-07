import { ApiPropertyOptional } from '@nestjs/swagger';

export class IConversationSettings {
  @ApiPropertyOptional({ description: 'Whether to mute notifications for this conversation', default: false })
  muteNotifications?: boolean;
  
  @ApiPropertyOptional({ description: 'Theme preference for this conversation', example: 'dark' })
  theme?: string;
  
  @ApiPropertyOptional({ description: 'Whether to enable read receipts', default: true })
  enableReadReceipts?: boolean;
  
  @ApiPropertyOptional({ description: 'Whether to enable typing indicators', default: true })
  enableTypingIndicators?: boolean;
  
  @ApiPropertyOptional({ description: 'Number of days to retain messages before auto-deletion', example: 30 })
  retentionPeriodDays?: number;
  
  @ApiPropertyOptional({ description: 'Whether to auto-delete threads', default: false })
  autoDeleteThreads?: boolean;
  
  @ApiPropertyOptional({ description: 'Whether to allow reactions on messages', default: true })
  allowReactions?: boolean;
  
  @ApiPropertyOptional({ description: 'Default notification sound', example: 'chime' })
  defaultNotificationSound?: string;
} 