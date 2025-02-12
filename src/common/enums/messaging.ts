export enum ResponseStatus {
  SUCCESS = 1,
  GROUP_NOT_FOUND = 2,
  NOT_ADMIN = 3,
  ALREADY_MEMBER = 4,
  USER_NOT_FOUND = 5,
}

export enum MessageStatus {
  SENDING = 'sending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed',
}

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  FILE = 'file',
  LINK = 'link',
  LOCATION = 'location',
}
