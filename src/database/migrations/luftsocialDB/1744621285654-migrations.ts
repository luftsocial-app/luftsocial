import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1744621285654 implements MigrationInterface {
  name = 'Migrations1744621285654';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "teams" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "description" character varying, "tenant_id" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdBy" character varying, "updatedBy" character varying, CONSTRAINT "PK_7e5523774a38b08a6236d322403" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "tbl_permissions" ("id" SERIAL NOT NULL, "name" character varying(255) NOT NULL, "description" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_5a13bf078da14cd3e1a02c18f1f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."tbl_role_name_enum" AS ENUM('super_admin', 'admin', 'manager', 'editor', 'member')`,
    );
    await queryRunner.query(
      `CREATE TABLE "tbl_role" ("id" SERIAL NOT NULL, "name" "public"."tbl_role_name_enum" NOT NULL DEFAULT 'member', "description" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "tenant_id" character varying, CONSTRAINT "PK_7fb8c467d6259854a09dd60c109" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "tbl_tenants" ("id" character varying NOT NULL, "name" character varying NOT NULL, "slug" character varying, "logo" character varying, "settings" jsonb NOT NULL DEFAULT '{}', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "UQ_6a111522b00b81d4125e757f099" UNIQUE ("name"), CONSTRAINT "UQ_a5b22714c4ec8138130f8f1a777" UNIQUE ("slug"), CONSTRAINT "PK_88f19f0c5788411b2deea454c0b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."conversation_participants_role_enum" AS ENUM('owner', 'admin', 'member', 'guest')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."conversation_participants_status_enum" AS ENUM('pending', 'member', 'banned')`,
    );
    await queryRunner.query(
      `CREATE TABLE "conversation_participants" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "tenant_id" character varying NOT NULL, "deleted_at" TIMESTAMP WITH TIME ZONE, "conversation_id" uuid NOT NULL, "user_id" character varying NOT NULL, "role" "public"."conversation_participants_role_enum" NOT NULL DEFAULT 'member', "status" "public"."conversation_participants_status_enum" NOT NULL DEFAULT 'member', "last_active_at" TIMESTAMP NOT NULL DEFAULT now(), "settings" jsonb NOT NULL DEFAULT '{}', CONSTRAINT "PK_61b51428ad9453f5921369fbe94" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_part_conversation" ON "conversation_participants" ("conversation_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_part_user" ON "conversation_participants" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_part_role" ON "conversation_participants" ("role") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_part_status" ON "conversation_participants" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_part_last_active" ON "conversation_participants" ("last_active_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_part_deleted_at" ON "conversation_participants" ("deleted_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_part_tenant" ON "conversation_participants" ("tenant_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_part_created_at" ON "conversation_participants" ("created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_part_tenant_created" ON "conversation_participants" ("tenant_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_part_user_conversation" ON "conversation_participants" ("user_id", "conversation_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."conversations_type_enum" AS ENUM('direct', 'group', 'channel')`,
    );
    await queryRunner.query(
      `CREATE TABLE "conversations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "tenant_id" character varying NOT NULL, "deleted_at" TIMESTAMP WITH TIME ZONE, "name" character varying, "type" "public"."conversations_type_enum" NOT NULL DEFAULT 'direct', "is_private" boolean NOT NULL DEFAULT false, "metadata" jsonb NOT NULL DEFAULT '{}', "last_message_at" TIMESTAMP WITH TIME ZONE, "settings" jsonb NOT NULL DEFAULT '{}', "lastReadMessageIds" jsonb NOT NULL DEFAULT '{}', "unreadCounts" jsonb NOT NULL DEFAULT '{}', CONSTRAINT "PK_ee34f4f7ced4ec8681f26bf04ef" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_conv_name" ON "conversations" ("name") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_conv_type" ON "conversations" ("type") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_conversation_tenant" ON "conversations" ("tenant_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_conv_privacy" ON "conversations" ("is_private") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_conv_last_message" ON "conversations" ("last_message_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_conv_last_read_message_ids" ON "conversations" ("lastReadMessageIds") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_conv_unread_counts" ON "conversations" ("unreadCounts") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_conv_deleted_at" ON "conversations" ("deleted_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_conv_tenant" ON "conversations" ("tenant_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_conv_created_at" ON "conversations" ("created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_conv_tenant_created" ON "conversations" ("tenant_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."message_attachments_type_enum" AS ENUM('image', 'video', 'audio', 'document', 'other')`,
    );
    await queryRunner.query(
      `CREATE TABLE "message_attachments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "tenant_id" character varying NOT NULL, "deleted_at" TIMESTAMP WITH TIME ZONE, "message_id" uuid NOT NULL, "file_name" character varying NOT NULL, "file_size" integer NOT NULL, "mime_type" character varying NOT NULL, "type" "public"."message_attachments_type_enum" NOT NULL DEFAULT 'other', "storage_path" character varying NOT NULL, "public_url" character varying, "thumbnail_url" character varying, "metadata" jsonb NOT NULL DEFAULT '{}', "url" character varying NOT NULL, "processingStatus" character varying NOT NULL, CONSTRAINT "PK_e5085d973567c61e9306f10f95b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_att_message" ON "message_attachments" ("message_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_att_mime_type" ON "message_attachments" ("mime_type") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_att_type" ON "message_attachments" ("type") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_att_processing" ON "message_attachments" ("processingStatus") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_att_deleted_at" ON "message_attachments" ("deleted_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_att_tenant" ON "message_attachments" ("tenant_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_att_created_at" ON "message_attachments" ("created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_att_tenant_created" ON "message_attachments" ("tenant_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."messages_type_enum" AS ENUM('text', 'image', 'video', 'audio', 'file', 'system')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."messages_status_enum" AS ENUM('sending', 'sent', 'delivered', 'read', 'failed')`,
    );
    await queryRunner.query(
      `CREATE TABLE "messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "tenant_id" character varying NOT NULL, "deleted_at" TIMESTAMP WITH TIME ZONE, "content" text NOT NULL, "conversation_id" uuid NOT NULL, "sender_id" character varying NOT NULL, "type" "public"."messages_type_enum" NOT NULL DEFAULT 'text', "is_edited" boolean NOT NULL DEFAULT false, "is_deleted" boolean NOT NULL DEFAULT false, "is_pinned" boolean NOT NULL DEFAULT false, "status" "public"."messages_status_enum" NOT NULL DEFAULT 'sending', "deleted_by" character varying, "parent_message_id" uuid, "metadata" jsonb NOT NULL DEFAULT '{}', "edit_history" jsonb NOT NULL DEFAULT '[]', "read_by" jsonb NOT NULL DEFAULT '{}', CONSTRAINT "PK_18325f38ae6de43878487eff986" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_msg_conversation" ON "messages" ("conversation_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_msg_sender" ON "messages" ("sender_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_msg_type" ON "messages" ("type") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_msg_deleted" ON "messages" ("is_deleted") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_msg_pinned" ON "messages" ("is_pinned") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_msg_status" ON "messages" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_msg_parent" ON "messages" ("parent_message_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_msg_deleted_at" ON "messages" ("deleted_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_msg_tenant" ON "messages" ("tenant_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_msg_created_at" ON "messages" ("created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_msg_tenant_created" ON "messages" ("tenant_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_msg_search" ON "messages" ("conversation_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "tbl_users" ("id" character varying NOT NULL, "clerkId" character varying NOT NULL, "email" character varying NOT NULL, "username" character varying NOT NULL, "first_name" character varying NOT NULL, "last_name" character varying NOT NULL, "profile" character varying, "phone" character varying, "avatar" character varying, "is_active" boolean NOT NULL DEFAULT true, "permissions" jsonb NOT NULL DEFAULT '[]', "lastSeen" TIMESTAMP, "status" character varying, "customStatus" character varying, "activeTenantId" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "created_by" character varying, "updated_by" character varying, "is_deleted" boolean NOT NULL DEFAULT false, "deleted_at" TIMESTAMP, "deleted_by" character varying, CONSTRAINT "UQ_f8829e6acbf05847782a009e6cb" UNIQUE ("clerkId"), CONSTRAINT "UQ_d74ab662f9d3964f78b3416d5da" UNIQUE ("email"), CONSTRAINT "PK_bb1d884179b3e42514b36c01e4e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "tbl_user_role_change" ("id" SERIAL NOT NULL, "userId" uuid NOT NULL, "changedById" uuid NOT NULL, "previousRole" character varying NOT NULL, "new_role" character varying NOT NULL, "reason" text, CONSTRAINT "PK_0e954ce7cb67395e66a7cfb0765" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."publish_records_status_enum" AS ENUM('PENDING', 'COMPLETED', 'PARTIALLY_COMPLETED', 'FAILED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "publish_records" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" character varying NOT NULL, "content" text NOT NULL, "mediaItems" jsonb, "platforms" jsonb NOT NULL, "scheduleTime" TIMESTAMP, "status" "public"."publish_records_status_enum" NOT NULL, "results" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_fb4622d2f62653f6b7209e098ed" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."scheduled_posts_status_enum" AS ENUM('PENDING', 'PROCESSING', 'PUBLISHED', 'PARTIALLY_PUBLISHED', 'FAILED', 'CANCELLED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "scheduled_posts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" character varying NOT NULL, "content" text NOT NULL, "mediaUrls" text, "mediaItems" jsonb, "platforms" jsonb NOT NULL, "scheduledTime" TIMESTAMP NOT NULL, "status" "public"."scheduled_posts_status_enum" NOT NULL DEFAULT 'PENDING', "results" jsonb, "publishedAt" TIMESTAMP, "error" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_0408d38eae4ccb97d9bbb148da1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "post_assets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying NOT NULL, "fileKey" character varying NOT NULL, "fileType" character varying NOT NULL, "uploadedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_ed08ca38aaa5e342de73e419b33" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "analytics_records" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" character varying NOT NULL, "dateRange" jsonb NOT NULL, "platforms" jsonb NOT NULL, "results" jsonb NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_94cace6e56221f9f8848588d4b6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "tiktok_metrics" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying NOT NULL, "viewCount" integer NOT NULL DEFAULT '0', "likeCount" integer NOT NULL DEFAULT '0', "commentCount" integer NOT NULL DEFAULT '0', "shareCount" integer NOT NULL DEFAULT '0', "playCount" integer NOT NULL DEFAULT '0', "downloadCount" integer NOT NULL DEFAULT '0', "engagementRate" numeric(5,2) NOT NULL DEFAULT '0', "averageWatchTime" numeric(10,2), "totalWatchTimeMillis" bigint, "retentionRate" jsonb, "audienceTerritories" jsonb, "collectedAt" TIMESTAMP NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "videoId" uuid, CONSTRAINT "PK_39e2f3ade9bb7fb869dbd004145" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."tiktok_videos_status_enum" AS ENUM('PENDING', 'UPLOADED', 'PUBLISHED', 'FAILED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "tiktok_videos" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying NOT NULL, "publishId" character varying NOT NULL, "uploadUrl" character varying, "privacyLevel" integer NOT NULL, "title" character varying, "disableDuet" boolean NOT NULL DEFAULT false, "disableStitch" boolean NOT NULL DEFAULT false, "disableComment" boolean NOT NULL DEFAULT false, "videoCoverTimestampMs" integer, "brandContentToggle" boolean NOT NULL DEFAULT false, "brandOrganicToggle" boolean NOT NULL DEFAULT false, "isAigc" boolean NOT NULL DEFAULT false, "status" "public"."tiktok_videos_status_enum" NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "accountId" uuid, CONSTRAINT "PK_4666ba905d93fbc75b5d9ce36b0" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "facebook_post_metrics" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying NOT NULL, "likesCount" integer NOT NULL DEFAULT '0', "commentsCount" integer NOT NULL DEFAULT '0', "sharesCount" integer NOT NULL DEFAULT '0', "reach" integer NOT NULL DEFAULT '0', "impressions" integer NOT NULL DEFAULT '0', "engagementRate" numeric(5,2) NOT NULL DEFAULT '0', "demographicBreakdown" jsonb, "collectedAt" TIMESTAMP NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "accountId" uuid, "postId" uuid, CONSTRAINT "PK_d7aea1f2f56cba80ce61fb75d3d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "facebook_posts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying NOT NULL, "postId" character varying NOT NULL, "content" text NOT NULL, "mediaItems" jsonb, "permalinkUrl" character varying, "isPublished" boolean NOT NULL DEFAULT false, "scheduledTime" TIMESTAMP, "publishedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "accountId" uuid, "pageId" uuid, CONSTRAINT "PK_e9981f21016b53fde57297804b5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "facebook_pages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying NOT NULL, "pageId" character varying NOT NULL, "name" character varying NOT NULL, "category" character varying, "about" character varying, "description" character varying, "accessToken" character varying NOT NULL, "permissions" jsonb NOT NULL, "followerCount" integer, "metadata" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "facebookAccountId" uuid, CONSTRAINT "PK_496674684a6f17fd3aee100be28" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "facebook_accounts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying NOT NULL, "userId" character varying NOT NULL, "facebookUserId" character varying NOT NULL, "name" character varying NOT NULL, "email" character varying, "profileUrl" character varying, "permissions" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "socialAccountId" uuid, CONSTRAINT "REL_67050365c5f7e2edb4bf508fac" UNIQUE ("socialAccountId"), CONSTRAINT "PK_cbb18301bf0fd763db534dee458" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."social_accounts_platform_enum" AS ENUM('INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'LINKEDIN')`,
    );
    await queryRunner.query(
      `CREATE TABLE "social_accounts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying NOT NULL, "platform" "public"."social_accounts_platform_enum" NOT NULL, "platformUserId" character varying NOT NULL, "accessToken" character varying NOT NULL, "refreshToken" character varying, "tokenExpiresAt" TIMESTAMP NOT NULL, "metadata" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_e9e58d2d8e9fafa20af914d9750" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "tiktok_accounts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying NOT NULL, "tiktokUserId" character varying NOT NULL, "username" character varying NOT NULL, "displayName" character varying, "followerCount" integer NOT NULL DEFAULT '0', "followingCount" integer NOT NULL DEFAULT '0', "likesCount" integer NOT NULL DEFAULT '0', "videoCount" integer NOT NULL DEFAULT '0', "avatarUrl" character varying, "isVerified" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "socialAccountId" uuid, CONSTRAINT "REL_0bfcb0414f0bda0a4f2d70f36f" UNIQUE ("socialAccountId"), CONSTRAINT "PK_78bccdf805fea8f9635bfc4127d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."tiktok_upload_sessions_status_enum" AS ENUM('PENDING', 'COMPLETED', 'FAILED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "tiktok_upload_sessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying NOT NULL, "publishId" character varying NOT NULL, "uploadUrl" character varying NOT NULL, "uploadParams" jsonb NOT NULL, "status" "public"."tiktok_upload_sessions_status_enum" NOT NULL, "expiresAt" TIMESTAMP NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "accountId" uuid, CONSTRAINT "PK_b73b09d07cfdf56089ab1f990b2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "tiktok_comments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying NOT NULL, "platformCommentId" character varying NOT NULL, "content" character varying NOT NULL, "authorId" character varying NOT NULL, "authorUsername" character varying NOT NULL, "likeCount" integer NOT NULL DEFAULT '0', "replyCount" integer NOT NULL DEFAULT '0', "commentedAt" TIMESTAMP NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "videoId" uuid, CONSTRAINT "PK_017658219ec3c44af1081559a1b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "tiktok_rate_limits" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "action" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "accountId" uuid, CONSTRAINT "PK_4129912141ae940afd9220aed1d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "linkedin_accounts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying NOT NULL, "linkedinUserId" character varying NOT NULL, "firstName" character varying NOT NULL, "lastName" character varying NOT NULL, "email" character varying, "profileUrl" character varying, "permissions" jsonb NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "metadata" jsonb, "socialAccountId" uuid, CONSTRAINT "REL_cc2c691eedc005243051f7b9a4" UNIQUE ("socialAccountId"), CONSTRAINT "PK_f86cde0cd40f8aaa11f6d3e57bb" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "linkedin_posts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying NOT NULL, "postId" character varying NOT NULL, "content" text NOT NULL, "shareUrl" character varying, "mediaItems" jsonb, "thumbnailUrl" character varying, "isPublished" boolean NOT NULL DEFAULT false, "scheduledTime" TIMESTAMP, "publishedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "organizationId" uuid, CONSTRAINT "PK_fd37b64c9af6b96cd0fd1f76a1d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "linkedin_metrics" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "impressions" integer NOT NULL DEFAULT '0', "clicks" integer NOT NULL DEFAULT '0', "likes" integer NOT NULL DEFAULT '0', "comments" integer NOT NULL DEFAULT '0', "shares" integer NOT NULL DEFAULT '0', "engagementRate" numeric(5,2) NOT NULL DEFAULT '0', "demographicData" jsonb, "collectedAt" TIMESTAMP NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "postId" uuid, CONSTRAINT "PK_64d99ca8c6e56ee24b4fed3f40f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "linkedin_organizations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying NOT NULL, "organizationId" character varying NOT NULL, "name" character varying NOT NULL, "vanityName" character varying NOT NULL, "description" character varying NOT NULL, "permissions" jsonb NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "accountId" uuid, CONSTRAINT "PK_0fc5b78e66cd64eacba2804b8ea" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."tbl_notifications_type_enum" AS ENUM('mention', 'reaction', 'message')`,
    );
    await queryRunner.query(
      `CREATE TABLE "tbl_notifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "type" "public"."tbl_notifications_type_enum" NOT NULL, "is_read" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "userId" character varying, "messageId" uuid, CONSTRAINT "PK_864f5e52afeed73fdfd87ba738b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "instagram_accounts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying NOT NULL, "instagramAccountId" character varying NOT NULL, "username" character varying NOT NULL, "profileUrl" character varying, "permissions" jsonb NOT NULL, "followerCount" integer NOT NULL DEFAULT '0', "followingCount" integer NOT NULL DEFAULT '0', "mediaCount" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "metadata" jsonb NOT NULL, "socialAccountId" uuid, CONSTRAINT "REL_15fc4ab1f3a8f6abcadad0a4f5" UNIQUE ("socialAccountId"), CONSTRAINT "PK_68884488e846a634585d594d511" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "instagram_metrics" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying NOT NULL, "likesCount" integer NOT NULL DEFAULT '0', "commentsCount" integer NOT NULL DEFAULT '0', "savesCount" integer NOT NULL DEFAULT '0', "reach" integer NOT NULL DEFAULT '0', "impressions" integer NOT NULL DEFAULT '0', "engagementRate" numeric(5,2) NOT NULL DEFAULT '0', "audienceBreakdown" jsonb, "locationBreakdown" jsonb, "collectedAt" TIMESTAMP NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "mediaId" uuid, CONSTRAINT "PK_2683d0f68656280ae3d55e2ffaa" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "instagram_post" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying NOT NULL, "postId" character varying NOT NULL, "caption" text, "hashtags" jsonb NOT NULL, "mentions" jsonb NOT NULL, "thumbnailUrl" character varying, "mediaItems" jsonb, "permalink" character varying, "isPublished" boolean NOT NULL DEFAULT false, "scheduledTime" TIMESTAMP, "postedAt" TIMESTAMP NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "accountId" uuid, CONSTRAINT "PK_a0946a290d49ebb27c7684b956d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "instagram_rate_limits" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "action" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "account_id" uuid, CONSTRAINT "PK_3c57984aa2c9e113c840b67b3ea" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "facebook_page_metrics" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying NOT NULL, "impressions" integer NOT NULL, "engagedUsers" integer NOT NULL, "newFans" integer NOT NULL, "pageViews" integer NOT NULL, "engagements" integer NOT NULL, "followers" integer NOT NULL, "collectedAt" TIMESTAMP NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "pageId" uuid, CONSTRAINT "PK_a56977bea64f52295fc2a3b3490" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."auth_states_platform_enum" AS ENUM('INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'LINKEDIN')`,
    );
    await queryRunner.query(
      `CREATE TABLE "auth_states" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "state" character varying NOT NULL, "userId" character varying NOT NULL, "platform" "public"."auth_states_platform_enum" NOT NULL, "expiresAt" TIMESTAMP NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_750c9a8eeb2877704d40470721b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "team_members" ("team_id" uuid NOT NULL, "user_id" character varying NOT NULL, CONSTRAINT "PK_1d3c06a8217a8785e2af0ec4ab8" PRIMARY KEY ("team_id", "user_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_fdad7d5768277e60c40e01cdce" ON "team_members" ("team_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c2bf4967c8c2a6b845dadfbf3d" ON "team_members" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "tbl_user_tenants" ("user_id" character varying NOT NULL, "tenant_id" character varying NOT NULL, CONSTRAINT "PK_1fad7310e444cacfbb10dfa1835" PRIMARY KEY ("user_id", "tenant_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ad232c61abe108e538b9f5b4f3" ON "tbl_user_tenants" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bf4173789a56ef26c32acdc0c6" ON "tbl_user_tenants" ("tenant_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "linkedin_metrics" ADD "tenantId" character varying NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "linkedin_metrics" ADD "uniqueImpressions" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "linkedin_metrics" ADD "industryData" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "linkedin_metrics" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "tbl_role" ADD CONSTRAINT "FK_b3587510ea94fcb64d76be48291" FOREIGN KEY ("tenant_id") REFERENCES "tbl_tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversation_participants" ADD CONSTRAINT "FK_1559e8a16b828f2e836a2312800" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversation_participants" ADD CONSTRAINT "FK_377d4041a495b81ee1a85ae026f" FOREIGN KEY ("user_id") REFERENCES "tbl_users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "message_attachments" ADD CONSTRAINT "FK_bf65c3db8657cef6197b68b8c88" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" ADD CONSTRAINT "FK_3bc55a7c3f9ed54b520bb5cfe23" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" ADD CONSTRAINT "FK_22133395bd13b970ccd0c34ab22" FOREIGN KEY ("sender_id") REFERENCES "tbl_users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" ADD CONSTRAINT "FK_72ffa22d68b72a09d5700e4463f" FOREIGN KEY ("parent_message_id") REFERENCES "messages"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiktok_metrics" ADD CONSTRAINT "FK_80ddd93994bd81610ea542bdfbe" FOREIGN KEY ("videoId") REFERENCES "tiktok_videos"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiktok_videos" ADD CONSTRAINT "FK_58b388ce9b8eada5e5aef0ad85c" FOREIGN KEY ("accountId") REFERENCES "tiktok_accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "facebook_post_metrics" ADD CONSTRAINT "FK_03d40f74ef37cf9de021a2d7ab0" FOREIGN KEY ("accountId") REFERENCES "facebook_accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "facebook_post_metrics" ADD CONSTRAINT "FK_fafcdee08d042da3c3056eaf0f7" FOREIGN KEY ("postId") REFERENCES "facebook_posts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "facebook_posts" ADD CONSTRAINT "FK_1e16694e810717920f525e81c5b" FOREIGN KEY ("accountId") REFERENCES "facebook_accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "facebook_posts" ADD CONSTRAINT "FK_5f02c18d7afc130c47b0a83a0fb" FOREIGN KEY ("pageId") REFERENCES "facebook_pages"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "facebook_pages" ADD CONSTRAINT "FK_7f6a605e72b8ec333071603b8d5" FOREIGN KEY ("facebookAccountId") REFERENCES "facebook_accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "facebook_accounts" ADD CONSTRAINT "FK_67050365c5f7e2edb4bf508fac4" FOREIGN KEY ("socialAccountId") REFERENCES "social_accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiktok_accounts" ADD CONSTRAINT "FK_0bfcb0414f0bda0a4f2d70f36f2" FOREIGN KEY ("socialAccountId") REFERENCES "social_accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiktok_upload_sessions" ADD CONSTRAINT "FK_bcecedb51cc5b6b5755ec298742" FOREIGN KEY ("accountId") REFERENCES "tiktok_accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiktok_comments" ADD CONSTRAINT "FK_2a8e1ed833504c236f6a475b026" FOREIGN KEY ("videoId") REFERENCES "tiktok_videos"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiktok_rate_limits" ADD CONSTRAINT "FK_f4eaaf57d7482597e2b271861e7" FOREIGN KEY ("accountId") REFERENCES "tiktok_accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "linkedin_accounts" ADD CONSTRAINT "FK_cc2c691eedc005243051f7b9a41" FOREIGN KEY ("socialAccountId") REFERENCES "social_accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "linkedin_posts" ADD CONSTRAINT "FK_f3686d0e1fcae5a0eb189db41b8" FOREIGN KEY ("organizationId") REFERENCES "linkedin_organizations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "linkedin_metrics" ADD CONSTRAINT "FK_187c3d9eeb2258abe4dd815f356" FOREIGN KEY ("postId") REFERENCES "linkedin_posts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "linkedin_organizations" ADD CONSTRAINT "FK_b267864087079392e1a0920963a" FOREIGN KEY ("accountId") REFERENCES "linkedin_accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tbl_notifications" ADD CONSTRAINT "FK_c1fcaf7145486d8cfaa8a4e8a48" FOREIGN KEY ("userId") REFERENCES "tbl_users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tbl_notifications" ADD CONSTRAINT "FK_bc5d82a648b94ab5c73a614fa03" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "instagram_accounts" ADD CONSTRAINT "FK_15fc4ab1f3a8f6abcadad0a4f54" FOREIGN KEY ("socialAccountId") REFERENCES "social_accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "instagram_metrics" ADD CONSTRAINT "FK_4dd707dc9866544a997824983d7" FOREIGN KEY ("mediaId") REFERENCES "instagram_post"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "instagram_post" ADD CONSTRAINT "FK_aa9e241c18cc32024858f02cfb6" FOREIGN KEY ("accountId") REFERENCES "instagram_accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "instagram_rate_limits" ADD CONSTRAINT "FK_452b2a4f7d3ccfc3c91f808a1dd" FOREIGN KEY ("account_id") REFERENCES "instagram_accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "facebook_page_metrics" ADD CONSTRAINT "FK_85c9838fd5165ca5f89453f7bc4" FOREIGN KEY ("pageId") REFERENCES "facebook_pages"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "team_members" ADD CONSTRAINT "FK_fdad7d5768277e60c40e01cdcea" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "team_members" ADD CONSTRAINT "FK_c2bf4967c8c2a6b845dadfbf3d4" FOREIGN KEY ("user_id") REFERENCES "tbl_users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tbl_user_tenants" ADD CONSTRAINT "FK_ad232c61abe108e538b9f5b4f33" FOREIGN KEY ("user_id") REFERENCES "tbl_users"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "tbl_user_tenants" ADD CONSTRAINT "FK_bf4173789a56ef26c32acdc0c6a" FOREIGN KEY ("tenant_id") REFERENCES "tbl_tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tbl_user_tenants" DROP CONSTRAINT "FK_bf4173789a56ef26c32acdc0c6a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tbl_user_tenants" DROP CONSTRAINT "FK_ad232c61abe108e538b9f5b4f33"`,
    );
    await queryRunner.query(
      `ALTER TABLE "team_members" DROP CONSTRAINT "FK_c2bf4967c8c2a6b845dadfbf3d4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "team_members" DROP CONSTRAINT "FK_fdad7d5768277e60c40e01cdcea"`,
    );
    await queryRunner.query(
      `ALTER TABLE "facebook_page_metrics" DROP CONSTRAINT "FK_85c9838fd5165ca5f89453f7bc4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "instagram_rate_limits" DROP CONSTRAINT "FK_452b2a4f7d3ccfc3c91f808a1dd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "instagram_post" DROP CONSTRAINT "FK_aa9e241c18cc32024858f02cfb6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "instagram_metrics" DROP CONSTRAINT "FK_4dd707dc9866544a997824983d7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "instagram_accounts" DROP CONSTRAINT "FK_15fc4ab1f3a8f6abcadad0a4f54"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tbl_notifications" DROP CONSTRAINT "FK_bc5d82a648b94ab5c73a614fa03"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tbl_notifications" DROP CONSTRAINT "FK_c1fcaf7145486d8cfaa8a4e8a48"`,
    );
    await queryRunner.query(
      `ALTER TABLE "linkedin_organizations" DROP CONSTRAINT "FK_b267864087079392e1a0920963a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "linkedin_metrics" DROP CONSTRAINT "FK_187c3d9eeb2258abe4dd815f356"`,
    );
    await queryRunner.query(
      `ALTER TABLE "linkedin_posts" DROP CONSTRAINT "FK_f3686d0e1fcae5a0eb189db41b8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "linkedin_accounts" DROP CONSTRAINT "FK_cc2c691eedc005243051f7b9a41"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiktok_rate_limits" DROP CONSTRAINT "FK_f4eaaf57d7482597e2b271861e7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiktok_comments" DROP CONSTRAINT "FK_2a8e1ed833504c236f6a475b026"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiktok_upload_sessions" DROP CONSTRAINT "FK_bcecedb51cc5b6b5755ec298742"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiktok_accounts" DROP CONSTRAINT "FK_0bfcb0414f0bda0a4f2d70f36f2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "facebook_accounts" DROP CONSTRAINT "FK_67050365c5f7e2edb4bf508fac4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "facebook_pages" DROP CONSTRAINT "FK_7f6a605e72b8ec333071603b8d5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "facebook_posts" DROP CONSTRAINT "FK_5f02c18d7afc130c47b0a83a0fb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "facebook_posts" DROP CONSTRAINT "FK_1e16694e810717920f525e81c5b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "facebook_post_metrics" DROP CONSTRAINT "FK_fafcdee08d042da3c3056eaf0f7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "facebook_post_metrics" DROP CONSTRAINT "FK_03d40f74ef37cf9de021a2d7ab0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiktok_videos" DROP CONSTRAINT "FK_58b388ce9b8eada5e5aef0ad85c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiktok_metrics" DROP CONSTRAINT "FK_80ddd93994bd81610ea542bdfbe"`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" DROP CONSTRAINT "FK_72ffa22d68b72a09d5700e4463f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" DROP CONSTRAINT "FK_22133395bd13b970ccd0c34ab22"`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" DROP CONSTRAINT "FK_3bc55a7c3f9ed54b520bb5cfe23"`,
    );
    await queryRunner.query(
      `ALTER TABLE "message_attachments" DROP CONSTRAINT "FK_bf65c3db8657cef6197b68b8c88"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversation_participants" DROP CONSTRAINT "FK_377d4041a495b81ee1a85ae026f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversation_participants" DROP CONSTRAINT "FK_1559e8a16b828f2e836a2312800"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tbl_role" DROP CONSTRAINT "FK_b3587510ea94fcb64d76be48291"`,
    );
    await queryRunner.query(
      `ALTER TABLE "linkedin_metrics" DROP COLUMN "updatedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "linkedin_metrics" DROP COLUMN "industryData"`,
    );
    await queryRunner.query(
      `ALTER TABLE "linkedin_metrics" DROP COLUMN "uniqueImpressions"`,
    );
    await queryRunner.query(
      `ALTER TABLE "linkedin_metrics" DROP COLUMN "tenantId"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_bf4173789a56ef26c32acdc0c6"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ad232c61abe108e538b9f5b4f3"`,
    );
    await queryRunner.query(`DROP TABLE "tbl_user_tenants"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c2bf4967c8c2a6b845dadfbf3d"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_fdad7d5768277e60c40e01cdce"`,
    );
    await queryRunner.query(`DROP TABLE "team_members"`);
    await queryRunner.query(`DROP TABLE "auth_states"`);
    await queryRunner.query(`DROP TYPE "public"."auth_states_platform_enum"`);
    await queryRunner.query(`DROP TABLE "facebook_page_metrics"`);
    await queryRunner.query(`DROP TABLE "instagram_rate_limits"`);
    await queryRunner.query(`DROP TABLE "instagram_post"`);
    await queryRunner.query(`DROP TABLE "instagram_metrics"`);
    await queryRunner.query(`DROP TABLE "instagram_accounts"`);
    await queryRunner.query(`DROP TABLE "tbl_notifications"`);
    await queryRunner.query(`DROP TYPE "public"."tbl_notifications_type_enum"`);
    await queryRunner.query(`DROP TABLE "linkedin_organizations"`);
    await queryRunner.query(`DROP TABLE "linkedin_metrics"`);
    await queryRunner.query(`DROP TABLE "linkedin_posts"`);
    await queryRunner.query(`DROP TABLE "linkedin_accounts"`);
    await queryRunner.query(`DROP TABLE "tiktok_rate_limits"`);
    await queryRunner.query(`DROP TABLE "tiktok_comments"`);
    await queryRunner.query(`DROP TABLE "tiktok_upload_sessions"`);
    await queryRunner.query(
      `DROP TYPE "public"."tiktok_upload_sessions_status_enum"`,
    );
    await queryRunner.query(`DROP TABLE "tiktok_accounts"`);
    await queryRunner.query(`DROP TABLE "social_accounts"`);
    await queryRunner.query(
      `DROP TYPE "public"."social_accounts_platform_enum"`,
    );
    await queryRunner.query(`DROP TABLE "facebook_accounts"`);
    await queryRunner.query(`DROP TABLE "facebook_pages"`);
    await queryRunner.query(`DROP TABLE "facebook_posts"`);
    await queryRunner.query(`DROP TABLE "facebook_post_metrics"`);
    await queryRunner.query(`DROP TABLE "tiktok_videos"`);
    await queryRunner.query(`DROP TYPE "public"."tiktok_videos_status_enum"`);
    await queryRunner.query(`DROP TABLE "tiktok_metrics"`);
    await queryRunner.query(`DROP TABLE "analytics_records"`);
    await queryRunner.query(`DROP TABLE "post_assets"`);
    await queryRunner.query(`DROP TABLE "scheduled_posts"`);
    await queryRunner.query(`DROP TYPE "public"."scheduled_posts_status_enum"`);
    await queryRunner.query(`DROP TABLE "publish_records"`);
    await queryRunner.query(`DROP TYPE "public"."publish_records_status_enum"`);
    await queryRunner.query(`DROP TABLE "tbl_user_role_change"`);
    await queryRunner.query(`DROP TABLE "tbl_users"`);
    await queryRunner.query(`DROP INDEX "public"."idx_msg_search"`);
    await queryRunner.query(`DROP INDEX "public"."idx_msg_tenant_created"`);
    await queryRunner.query(`DROP INDEX "public"."idx_msg_created_at"`);
    await queryRunner.query(`DROP INDEX "public"."idx_msg_tenant"`);
    await queryRunner.query(`DROP INDEX "public"."idx_msg_deleted_at"`);
    await queryRunner.query(`DROP INDEX "public"."idx_msg_parent"`);
    await queryRunner.query(`DROP INDEX "public"."idx_msg_status"`);
    await queryRunner.query(`DROP INDEX "public"."idx_msg_pinned"`);
    await queryRunner.query(`DROP INDEX "public"."idx_msg_deleted"`);
    await queryRunner.query(`DROP INDEX "public"."idx_msg_type"`);
    await queryRunner.query(`DROP INDEX "public"."idx_msg_sender"`);
    await queryRunner.query(`DROP INDEX "public"."idx_msg_conversation"`);
    await queryRunner.query(`DROP TABLE "messages"`);
    await queryRunner.query(`DROP TYPE "public"."messages_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."messages_type_enum"`);
    await queryRunner.query(`DROP INDEX "public"."idx_att_tenant_created"`);
    await queryRunner.query(`DROP INDEX "public"."idx_att_created_at"`);
    await queryRunner.query(`DROP INDEX "public"."idx_att_tenant"`);
    await queryRunner.query(`DROP INDEX "public"."idx_att_deleted_at"`);
    await queryRunner.query(`DROP INDEX "public"."idx_att_processing"`);
    await queryRunner.query(`DROP INDEX "public"."idx_att_type"`);
    await queryRunner.query(`DROP INDEX "public"."idx_att_mime_type"`);
    await queryRunner.query(`DROP INDEX "public"."idx_att_message"`);
    await queryRunner.query(`DROP TABLE "message_attachments"`);
    await queryRunner.query(
      `DROP TYPE "public"."message_attachments_type_enum"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_conv_tenant_created"`);
    await queryRunner.query(`DROP INDEX "public"."idx_conv_created_at"`);
    await queryRunner.query(`DROP INDEX "public"."idx_conv_tenant"`);
    await queryRunner.query(`DROP INDEX "public"."idx_conv_deleted_at"`);
    await queryRunner.query(`DROP INDEX "public"."idx_conv_unread_counts"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_conv_last_read_message_ids"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_conv_last_message"`);
    await queryRunner.query(`DROP INDEX "public"."idx_conv_privacy"`);
    await queryRunner.query(`DROP INDEX "public"."idx_conversation_tenant"`);
    await queryRunner.query(`DROP INDEX "public"."idx_conv_type"`);
    await queryRunner.query(`DROP INDEX "public"."idx_conv_name"`);
    await queryRunner.query(`DROP TABLE "conversations"`);
    await queryRunner.query(`DROP TYPE "public"."conversations_type_enum"`);
    await queryRunner.query(`DROP INDEX "public"."idx_part_user_conversation"`);
    await queryRunner.query(`DROP INDEX "public"."idx_part_tenant_created"`);
    await queryRunner.query(`DROP INDEX "public"."idx_part_created_at"`);
    await queryRunner.query(`DROP INDEX "public"."idx_part_tenant"`);
    await queryRunner.query(`DROP INDEX "public"."idx_part_deleted_at"`);
    await queryRunner.query(`DROP INDEX "public"."idx_part_last_active"`);
    await queryRunner.query(`DROP INDEX "public"."idx_part_status"`);
    await queryRunner.query(`DROP INDEX "public"."idx_part_role"`);
    await queryRunner.query(`DROP INDEX "public"."idx_part_user"`);
    await queryRunner.query(`DROP INDEX "public"."idx_part_conversation"`);
    await queryRunner.query(`DROP TABLE "conversation_participants"`);
    await queryRunner.query(
      `DROP TYPE "public"."conversation_participants_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."conversation_participants_role_enum"`,
    );
    await queryRunner.query(`DROP TABLE "tbl_tenants"`);
    await queryRunner.query(`DROP TABLE "tbl_role"`);
    await queryRunner.query(`DROP TYPE "public"."tbl_role_name_enum"`);
    await queryRunner.query(`DROP TABLE "tbl_permissions"`);
    await queryRunner.query(`DROP TABLE "teams"`);
  }
}
