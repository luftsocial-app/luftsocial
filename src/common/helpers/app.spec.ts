import {
  getMediaTypeFromMimeType,
  getFilenameFromUrl,
  getMediaType,
  mapMediaTypeToAttachmentType,
} from './app';
import { MediaType } from '../enums/media-type.enum';
import { AttachmentType } from '../../messaging/messages/entities/attachment.entity';

describe('Media Type Helpers', () => {
  describe('getMediaTypeFromMimeType', () => {
    it('should identify media types correctly', () => {
      expect(getMediaTypeFromMimeType('image/jpeg')).toBe(MediaType.IMAGE);
      expect(getMediaTypeFromMimeType('image/png')).toBe(MediaType.IMAGE);
      expect(getMediaTypeFromMimeType('video/mp4')).toBe(MediaType.VIDEO);
      expect(getMediaTypeFromMimeType('audio/mpeg')).toBe(MediaType.AUDIO);
      expect(getMediaTypeFromMimeType('application/pdf')).toBe(MediaType.FILE);
      expect(getMediaTypeFromMimeType('text/plain')).toBe(MediaType.FILE);
    });

    it('should handle empty or invalid mime types', () => {
      expect(getMediaTypeFromMimeType('')).toBe(MediaType.FILE);
      expect(getMediaTypeFromMimeType(undefined as unknown as string)).toBe(
        MediaType.FILE,
      );
    });
  });

  describe('getMediaType', () => {
    it('should be an alias for getMediaTypeFromMimeType', () => {
      expect(getMediaType('image/jpeg')).toBe(MediaType.IMAGE);
      expect(getMediaType('video/mp4')).toBe(MediaType.VIDEO);
    });
  });

  describe('getFilenameFromUrl', () => {
    it('should extract filenames from valid URLs', () => {
      expect(getFilenameFromUrl('https://example.com/image.jpg')).toBe(
        'image.jpg',
      );
      expect(
        getFilenameFromUrl('https://example.com/path/to/file.png?query=param'),
      ).toBe('file.png');
      expect(getFilenameFromUrl('https://example.com/file.pdf#section')).toBe(
        'file.pdf',
      );
    });

    it('should return a generated filename for URLs without a path', () => {
      const result = getFilenameFromUrl('https://example.com/');
      expect(result).toMatch(/^file-\d+$/);
    });

    it('should handle invalid URLs by returning a generated filename', () => {
      const result = getFilenameFromUrl('invalid-url');
      expect(result).toMatch(/^file-\d+$/);
    });
  });

  describe('mapMediaTypeToAttachmentType', () => {
    it('should map mime types to attachment types correctly', () => {
      expect(mapMediaTypeToAttachmentType('image/jpeg')).toBe(
        AttachmentType.IMAGE,
      );
      expect(mapMediaTypeToAttachmentType('video/mp4')).toBe(
        AttachmentType.VIDEO,
      );
      expect(mapMediaTypeToAttachmentType('audio/mpeg')).toBe(
        AttachmentType.AUDIO,
      );
      expect(mapMediaTypeToAttachmentType('application/pdf')).toBe(
        AttachmentType.DOCUMENT,
      );
      expect(mapMediaTypeToAttachmentType('unknown/type')).toBe(
        AttachmentType.OTHER,
      );
    });

    it('should handle empty or invalid mime types', () => {
      expect(mapMediaTypeToAttachmentType('')).toBe(AttachmentType.OTHER);
      expect(mapMediaTypeToAttachmentType(undefined as unknown as string)).toBe(
        AttachmentType.OTHER,
      );
    });
  });
});
