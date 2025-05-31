import { UploadType } from '../enums/upload.enum';

export interface GeneratePresignedUrlOptions {
  userId: string;
  fileName: string;
  contentType: string;
  fileHash?: string;
  platform?: string;
  uploadType?: UploadType;
  messageId?: string;
  conversationId?: string;
}
