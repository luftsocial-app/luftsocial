import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1747149832965 implements MigrationInterface {
  name = 'Migrations1747149832965';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."scheduled_posts_status_enum" AS ENUM('PENDING', 'PROCESSING', 'PUBLISHED', 'PARTIALLY_PUBLISHED', 'FAILED', 'CANCELLED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "scheduled_posts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" character varying NOT NULL, "content" text NOT NULL, "mediaUrls" text, "mediaItems" jsonb, "platforms" jsonb NOT NULL, "scheduledTime" TIMESTAMP NOT NULL, "status" "public"."scheduled_posts_status_enum" NOT NULL DEFAULT 'PENDING', "results" jsonb, "publishedAt" TIMESTAMP, "error" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_0408d38eae4ccb97d9bbb148da1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "analytics_records" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" character varying NOT NULL, "dateRange" jsonb NOT NULL, "platforms" jsonb NOT NULL, "results" jsonb NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_94cace6e56221f9f8848588d4b6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "audit_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "entityType" character varying NOT NULL, "entityId" character varying NOT NULL, "action" character varying NOT NULL, "userId" character varying NOT NULL, "organizationId" character varying NOT NULL, "tenantId" character varying NOT NULL, "metadata" json, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0ec936941eb8556fcd7a1f0eae" ON "audit_logs" ("action", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_eb2d8e058d2b6160818d17acf8" ON "audit_logs" ("userId", "organizationId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_13c69424c440a0e765053feb4b" ON "audit_logs" ("entityType", "entityId") `,
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
      `CREATE TABLE "tiktok_accounts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying NOT NULL, "tiktokUserId" character varying NOT NULL, "username" character varying NOT NULL, "displayName" character varying, "followerCount" integer NOT NULL DEFAULT '0', "followingCount" integer NOT NULL DEFAULT '0', "likesCount" integer NOT NULL DEFAULT '0', "videoCount" integer NOT NULL DEFAULT '0', "avatarUrl" character varying, "isVerified" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "socialAccountId" uuid, CONSTRAINT "REL_0bfcb0414f0bda0a4f2d70f36f" UNIQUE ("socialAccountId"), CONSTRAINT "PK_78bccdf805fea8f9635bfc4127d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "tiktok_rate_limits" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "action" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "accountId" uuid, CONSTRAINT "PK_4129912141ae940afd9220aed1d" PRIMARY KEY ("id"))`,
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
      `CREATE TABLE "instagram_metrics" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying NOT NULL, "likesCount" integer NOT NULL DEFAULT '0', "commentsCount" integer NOT NULL DEFAULT '0', "savesCount" integer NOT NULL DEFAULT '0', "reach" integer NOT NULL DEFAULT '0', "impressions" integer NOT NULL DEFAULT '0', "engagementRate" numeric(5,2) NOT NULL DEFAULT '0', "audienceBreakdown" jsonb, "locationBreakdown" jsonb, "collectedAt" TIMESTAMP NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "mediaId" uuid, CONSTRAINT "PK_2683d0f68656280ae3d55e2ffaa" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "instagram_post" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying NOT NULL, "postId" character varying NOT NULL, "caption" text, "hashtags" jsonb NOT NULL, "mentions" jsonb NOT NULL, "thumbnailUrl" character varying, "mediaItems" jsonb, "permalink" character varying, "isPublished" boolean NOT NULL DEFAULT false, "scheduledTime" TIMESTAMP, "postedAt" TIMESTAMP NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "accountId" uuid, CONSTRAINT "PK_a0946a290d49ebb27c7684b956d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "instagram_accounts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying NOT NULL, "instagramAccountId" character varying NOT NULL, "username" character varying NOT NULL, "profileUrl" character varying, "permissions" jsonb NOT NULL, "followerCount" integer NOT NULL DEFAULT '0', "followingCount" integer NOT NULL DEFAULT '0', "mediaCount" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "metadata" jsonb NOT NULL, "socialAccountId" uuid, CONSTRAINT "REL_15fc4ab1f3a8f6abcadad0a4f5" UNIQUE ("socialAccountId"), CONSTRAINT "PK_68884488e846a634585d594d511" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "instagram_rate_limits" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "action" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "account_id" uuid, CONSTRAINT "PK_3c57984aa2c9e113c840b67b3ea" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."approval_actions_action_enum" AS ENUM('approve', 'reject')`,
    );
    await queryRunner.query(
      `CREATE TABLE "approval_actions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "action" "public"."approval_actions_action_enum" NOT NULL, "comment" text, "approval_step_id" uuid NOT NULL, "user_id" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_dcf156731ecc8b420b6c39d22c8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."approval_steps_status_enum" AS ENUM('pending', 'approved', 'rejected')`,
    );
    await queryRunner.query(
      `CREATE TABLE "approval_steps" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "order" integer NOT NULL, "requiredRole" character varying NOT NULL, "status" "public"."approval_steps_status_enum" NOT NULL DEFAULT 'pending', "post_id" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_31089858f2c75f4648107ae5280" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."posts_status_enum" AS ENUM('draft', 'in_review', 'approved', 'scheduled', 'published', 'rejected')`,
    );
    await queryRunner.query(
      `CREATE TABLE "posts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying NOT NULL, "content" text NOT NULL, "mediaItems" jsonb, "status" "public"."posts_status_enum" NOT NULL DEFAULT 'draft', "platforms" json, "scheduledFor" TIMESTAMP, "author_id" character varying NOT NULL, "organization_id" uuid NOT NULL, "tenantId" character varying NOT NULL, "publishId" character varying, "submittedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_2829ac61eff60fcec60d7274b9e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."tasks_type_enum" AS ENUM('review', 'publish')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."tasks_status_enum" AS ENUM('pending', 'completed', 'canceled')`,
    );
    await queryRunner.query(
      `CREATE TABLE "tasks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying NOT NULL, "description" text, "type" "public"."tasks_type_enum" NOT NULL, "status" "public"."tasks_status_enum" NOT NULL DEFAULT 'pending', "post_id" uuid NOT NULL, "approval_step_id" uuid, "assignee_id" character varying NOT NULL, "organizationId" character varying NOT NULL, "tenantId" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_8d12ff38fcc62aaba2cab748772" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "workflow_steps" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "description" character varying, "order" integer NOT NULL, "requiredRole" character varying NOT NULL, "estimatedTimeInHours" integer, "workflow_template_id" uuid NOT NULL, CONSTRAINT "PK_b602e5ecb22943db11c96a7f31c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "workflow_templates" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "description" text, "organizationId" character varying NOT NULL, "tenantId" character varying NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "isDefault" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_de336a1fce23ad3261d49423eae" PRIMARY KEY ("id"))`,
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
      `ALTER TABLE "tiktok_metrics" ADD CONSTRAINT "FK_80ddd93994bd81610ea542bdfbe" FOREIGN KEY ("videoId") REFERENCES "tiktok_videos"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiktok_videos" ADD CONSTRAINT "FK_58b388ce9b8eada5e5aef0ad85c" FOREIGN KEY ("accountId") REFERENCES "tiktok_accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiktok_accounts" ADD CONSTRAINT "FK_0bfcb0414f0bda0a4f2d70f36f2" FOREIGN KEY ("socialAccountId") REFERENCES "social_accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiktok_rate_limits" ADD CONSTRAINT "FK_f4eaaf57d7482597e2b271861e7" FOREIGN KEY ("accountId") REFERENCES "tiktok_accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiktok_upload_sessions" ADD CONSTRAINT "FK_bcecedb51cc5b6b5755ec298742" FOREIGN KEY ("accountId") REFERENCES "tiktok_accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiktok_comments" ADD CONSTRAINT "FK_2a8e1ed833504c236f6a475b026" FOREIGN KEY ("videoId") REFERENCES "tiktok_videos"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
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
      `ALTER TABLE "instagram_metrics" ADD CONSTRAINT "FK_4dd707dc9866544a997824983d7" FOREIGN KEY ("mediaId") REFERENCES "instagram_post"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "instagram_post" ADD CONSTRAINT "FK_aa9e241c18cc32024858f02cfb6" FOREIGN KEY ("accountId") REFERENCES "instagram_accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "instagram_accounts" ADD CONSTRAINT "FK_15fc4ab1f3a8f6abcadad0a4f54" FOREIGN KEY ("socialAccountId") REFERENCES "social_accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "instagram_rate_limits" ADD CONSTRAINT "FK_452b2a4f7d3ccfc3c91f808a1dd" FOREIGN KEY ("account_id") REFERENCES "instagram_accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_actions" ADD CONSTRAINT "FK_e1c5b22f26f31b55a8dcd3ab181" FOREIGN KEY ("approval_step_id") REFERENCES "approval_steps"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_actions" ADD CONSTRAINT "FK_025e1722f3b4f4025214400de22" FOREIGN KEY ("user_id") REFERENCES "tbl_users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_steps" ADD CONSTRAINT "FK_ce1ad22a2144cbbc97eb6654251" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "posts" ADD CONSTRAINT "FK_312c63be865c81b922e39c2475e" FOREIGN KEY ("author_id") REFERENCES "tbl_users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "posts" ADD CONSTRAINT "FK_47dffb39b4d5ab644bb67bf12d1" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD CONSTRAINT "FK_d399debcc4f8fb3278876ef3c22" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD CONSTRAINT "FK_b8ed74b7177e56c689492afbfb4" FOREIGN KEY ("approval_step_id") REFERENCES "approval_steps"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD CONSTRAINT "FK_855d484825b715c545349212c7f" FOREIGN KEY ("assignee_id") REFERENCES "tbl_users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "workflow_steps" ADD CONSTRAINT "FK_7ca9b8f51ad724c7f0fe5d41bf6" FOREIGN KEY ("workflow_template_id") REFERENCES "workflow_templates"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "workflow_steps" DROP CONSTRAINT "FK_7ca9b8f51ad724c7f0fe5d41bf6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP CONSTRAINT "FK_855d484825b715c545349212c7f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP CONSTRAINT "FK_b8ed74b7177e56c689492afbfb4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP CONSTRAINT "FK_d399debcc4f8fb3278876ef3c22"`,
    );
    await queryRunner.query(
      `ALTER TABLE "posts" DROP CONSTRAINT "FK_47dffb39b4d5ab644bb67bf12d1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "posts" DROP CONSTRAINT "FK_312c63be865c81b922e39c2475e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_steps" DROP CONSTRAINT "FK_ce1ad22a2144cbbc97eb6654251"`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_actions" DROP CONSTRAINT "FK_025e1722f3b4f4025214400de22"`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_actions" DROP CONSTRAINT "FK_e1c5b22f26f31b55a8dcd3ab181"`,
    );
    await queryRunner.query(
      `ALTER TABLE "instagram_rate_limits" DROP CONSTRAINT "FK_452b2a4f7d3ccfc3c91f808a1dd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "instagram_accounts" DROP CONSTRAINT "FK_15fc4ab1f3a8f6abcadad0a4f54"`,
    );
    await queryRunner.query(
      `ALTER TABLE "instagram_post" DROP CONSTRAINT "FK_aa9e241c18cc32024858f02cfb6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "instagram_metrics" DROP CONSTRAINT "FK_4dd707dc9866544a997824983d7"`,
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
      `ALTER TABLE "tiktok_comments" DROP CONSTRAINT "FK_2a8e1ed833504c236f6a475b026"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiktok_upload_sessions" DROP CONSTRAINT "FK_bcecedb51cc5b6b5755ec298742"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiktok_rate_limits" DROP CONSTRAINT "FK_f4eaaf57d7482597e2b271861e7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiktok_accounts" DROP CONSTRAINT "FK_0bfcb0414f0bda0a4f2d70f36f2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiktok_videos" DROP CONSTRAINT "FK_58b388ce9b8eada5e5aef0ad85c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiktok_metrics" DROP CONSTRAINT "FK_80ddd93994bd81610ea542bdfbe"`,
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
    await queryRunner.query(`DROP TABLE "workflow_templates"`);
    await queryRunner.query(`DROP TABLE "workflow_steps"`);
    await queryRunner.query(`DROP TABLE "tasks"`);
    await queryRunner.query(`DROP TYPE "public"."tasks_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."tasks_type_enum"`);
    await queryRunner.query(`DROP TABLE "posts"`);
    await queryRunner.query(`DROP TYPE "public"."posts_status_enum"`);
    await queryRunner.query(`DROP TABLE "approval_steps"`);
    await queryRunner.query(`DROP TYPE "public"."approval_steps_status_enum"`);
    await queryRunner.query(`DROP TABLE "approval_actions"`);
    await queryRunner.query(
      `DROP TYPE "public"."approval_actions_action_enum"`,
    );
    await queryRunner.query(`DROP TABLE "instagram_rate_limits"`);
    await queryRunner.query(`DROP TABLE "instagram_accounts"`);
    await queryRunner.query(`DROP TABLE "instagram_post"`);
    await queryRunner.query(`DROP TABLE "instagram_metrics"`);
    await queryRunner.query(`DROP TABLE "linkedin_organizations"`);
    await queryRunner.query(`DROP TABLE "linkedin_metrics"`);
    await queryRunner.query(`DROP TABLE "linkedin_posts"`);
    await queryRunner.query(`DROP TABLE "linkedin_accounts"`);
    await queryRunner.query(`DROP TABLE "tiktok_comments"`);
    await queryRunner.query(`DROP TABLE "tiktok_upload_sessions"`);
    await queryRunner.query(
      `DROP TYPE "public"."tiktok_upload_sessions_status_enum"`,
    );
    await queryRunner.query(`DROP TABLE "tiktok_rate_limits"`);
    await queryRunner.query(`DROP TABLE "tiktok_accounts"`);
    await queryRunner.query(`DROP TABLE "tiktok_videos"`);
    await queryRunner.query(`DROP TYPE "public"."tiktok_videos_status_enum"`);
    await queryRunner.query(`DROP TABLE "tiktok_metrics"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_13c69424c440a0e765053feb4b"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_eb2d8e058d2b6160818d17acf8"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_0ec936941eb8556fcd7a1f0eae"`,
    );
    await queryRunner.query(`DROP TABLE "audit_logs"`);
    await queryRunner.query(`DROP TABLE "analytics_records"`);
    await queryRunner.query(`DROP TABLE "scheduled_posts"`);
    await queryRunner.query(`DROP TYPE "public"."scheduled_posts_status_enum"`);
  }
}
