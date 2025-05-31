import { MediaType } from '../enums/media-type.enum';
import { AttachmentType } from '../../messaging/messages/entities/attachment.entity';

export function getMediaTypeFromMimeType(mimetype?: string | null): MediaType {
  if (!mimetype) return MediaType.FILE;
  if (mimetype.startsWith('image/')) return MediaType.IMAGE;
  if (mimetype.startsWith('video/')) return MediaType.VIDEO;
  if (mimetype.startsWith('audio/')) return MediaType.AUDIO;
  if (mimetype.startsWith('application/')) return MediaType.FILE;
  return MediaType.FILE;
}

export function getMediaType(mimetype: string): MediaType {
  return getMediaTypeFromMimeType(mimetype);
}

export function getFilenameFromUrl(url: string): string {
  try {
    const { pathname } = new URL(url);
    return pathname.split('/').pop() || `file-${Date.now()}`;
  } catch {
    return `file-${Date.now()}`;
  }
}

export function mapMediaTypeToAttachmentType(mimetype: string): AttachmentType {
  switch (mimetype) {
    case 'image/jpeg':
      return AttachmentType.IMAGE;
    case 'video/mp4':
      return AttachmentType.VIDEO;
    case 'audio/mpeg':
      return AttachmentType.AUDIO;
    case 'application/pdf':
      return AttachmentType.DOCUMENT;
    default:
      return AttachmentType.OTHER;
  }
}
