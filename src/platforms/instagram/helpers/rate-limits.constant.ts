export const INSTAGRAM_RATE_LIMITS = {
  // API Rate Limits (per Instagram Business Account)
  API: {
    CALLS_PER_HOUR: 200,
    POSTS_PER_HOUR: 25,
    COMMENTS_PER_HOUR: 60,
    MEDIA_UPLOAD_PER_HOUR: 50,
  },

  // Content Limits
  CONTENT: {
    MAX_CAPTION_LENGTH: 2200,
    MAX_HASHTAGS: 30,
    MAX_MENTIONS: 30,
    MAX_CAROUSEL_ITEMS: 10,
    MAX_VIDEO_DURATION_SECONDS: 60,
    MAX_FILE_SIZE_MB: 8,
  },

  // Media Specifications
  MEDIA: {
    IMAGE: {
      MIN_WIDTH: 320,
      MIN_HEIGHT: 320,
      ASPECT_RATIO_MIN: 4 / 5,
      ASPECT_RATIO_MAX: 1.91,
    },
    VIDEO: {
      MIN_DURATION_SECONDS: 3,
      MAX_DURATION_SECONDS: 60,
    },
  },
};
