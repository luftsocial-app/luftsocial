import { MediaType } from '../../common/enums/media-type.enum';
import { PutObjectOutput } from '@aws-sdk/client-s3';

export class UploadResult {
  sendData: PutObjectOutput;
  cdnUrl: string;
}

export class PreSignedUrlResult {
  preSignedUrl: string;
  cdnUrl: string;
  bucket: string;
  key: string;
}

export interface MediaStorageItem {
  id?: string;
  url: string;
  key: string;
  type: MediaType;
  originalFilename: string;
  size: number;
  mimeType: string;
}
