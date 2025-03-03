import { S3 } from 'aws-sdk';
import { MediaType } from '../../common/enums/media-type.enum';

export class UploadResult {
  sendData: S3.ManagedUpload.SendData;
  cdnUrl: string;
}

export class PreSignedUrlResult {
  preSignedUrl: string;
  contentType: string;
  cdnUrl: string;
  bucket: string;
  key: string;
}

export interface MediaStorageItem {
  id: string;
  url: string;
  key: string;
  type: MediaType;
  originalFilename: string;
  size: number;
  mimeType: string;
}
