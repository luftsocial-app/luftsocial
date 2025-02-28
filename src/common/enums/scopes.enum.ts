export enum FACEBOOK_SCOPES {
  PAGES_SHOW_LIST = 'pages_show_list',
  PAGES_READ_ENGAGEMENT = 'pages_read_engagement',
  PAGES_MANAGE_POSTS = 'pages_manage_posts',
  PAGES_MANAGE_METADATA = 'pages_manage_metadata',
  PAGES_READ_USER_CONTENT = 'pages_read_user_content',
}

export enum INSTAGRAM_SCOPES {
  BASIC = 'instagram_basic',
  CONTENT_PUBLISH = 'instagram_content_publish',
  MANAGE_COMMENTS = 'instagram_manage_comments',
  MANAGE_INSIGHTS = 'instagram_manage_insights',
}

export enum LINKEDIN_SCOPES {
  W_MEMBER_SOCIAL = 'w_member_social',
  R_ORGANIZATION_SOCIAL = 'r_organization_social',
  R_ORGANIZATION_ADMINSTRATION = 'r_organization_administration',
  W_ORGANIZATION_SOCIAL = 'w_organization_social',
}

export enum TIKTOK_SCOPES {
  BASIC_INFO = 'user.info.basic', // For reading user profile info
  PROFILE_INFO = 'user.info.profile', // For additional profile info like bio, verified status
  USER_INFO_STATS = 'user.info.stats', // For user statistics (likes, followers, etc)
  VIDEO_LIST = 'video.list', // For reading user's public videos
  VIDEO_PUBLISH = 'video.publish', // For directly posting content
  VIDEO_UPLOAD = 'video.upload', // For creating drafts
}
