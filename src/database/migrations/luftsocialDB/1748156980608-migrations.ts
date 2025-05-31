import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1748156980608 implements MigrationInterface {
  name = 'Migrations1748156980608';

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
      `CREATE TYPE "public"."tiktok_upload_sessions_status_enum" AS ENUM('PENDING', 'COMPLETED', 'FAILED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "tiktok_upload_sessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying NOT NULL, "publishId" character varying NOT NULL, "uploadUrl" character varying NOT NULL, "uploadParams" jsonb NOT NULL, "status" "public"."tiktok_upload_sessions_status_enum" NOT NULL, "expiresAt" TIMESTAMP NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "accountId" uuid, CONSTRAINT "PK_b73b09d07cfdf56089ab1f990b2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "linkedin_accounts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying NOT NULL, "linkedinUserId" character varying NOT NULL, "firstName" character varying NOT NULL, "lastName" character varying NOT NULL, "email" character varying, "profileUrl" character varying, "permissions" jsonb NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "metadata" jsonb, "socialAccountId" uuid, CONSTRAINT "REL_cc2c691eedc005243051f7b9a4" UNIQUE ("socialAccountId"), CONSTRAINT "PK_f86cde0cd40f8aaa11f6d3e57bb" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "linkedin_organizations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying NOT NULL, "organizationId" character varying NOT NULL, "name" character varying NOT NULL, "vanityName" character varying NOT NULL, "description" character varying NOT NULL, "permissions" jsonb NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "accountId" uuid, CONSTRAINT "PK_0fc5b78e66cd64eacba2804b8ea" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "linkedin_posts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying NOT NULL, "postId" character varying NOT NULL, "content" text NOT NULL, "shareUrl" character varying, "mediaItems" jsonb, "thumbnailUrl" character varying, "isPublished" boolean NOT NULL DEFAULT false, "scheduledTime" TIMESTAMP, "publishedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "organizationId" uuid, CONSTRAINT "PK_fd37b64c9af6b96cd0fd1f76a1d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "linkedin_metrics" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "impressions" integer NOT NULL DEFAULT '0', "clicks" integer NOT NULL DEFAULT '0', "likes" integer NOT NULL DEFAULT '0', "comments" integer NOT NULL DEFAULT '0', "shares" integer NOT NULL DEFAULT '0', "engagementRate" numeric(5,2) NOT NULL DEFAULT '0', "demographicData" jsonb, "collectedAt" TIMESTAMP NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "postId" uuid, CONSTRAINT "PK_64d99ca8c6e56ee24b4fed3f40f" PRIMARY KEY ("id"))`,
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
      `ALTER TABLE "tiktok_upload_sessions" ADD CONSTRAINT "FK_bcecedb51cc5b6b5755ec298742" FOREIGN KEY ("accountId") REFERENCES "tiktok_accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "linkedin_accounts" ADD CONSTRAINT "FK_cc2c691eedc005243051f7b9a41" FOREIGN KEY ("socialAccountId") REFERENCES "social_accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "linkedin_organizations" ADD CONSTRAINT "FK_b267864087079392e1a0920963a" FOREIGN KEY ("accountId") REFERENCES "linkedin_accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "linkedin_posts" ADD CONSTRAINT "FK_f3686d0e1fcae5a0eb189db41b8" FOREIGN KEY ("organizationId") REFERENCES "linkedin_organizations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "linkedin_metrics" ADD CONSTRAINT "FK_187c3d9eeb2258abe4dd815f356" FOREIGN KEY ("postId") REFERENCES "linkedin_posts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
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
      `ALTER TABLE "linkedin_metrics" DROP CONSTRAINT "FK_187c3d9eeb2258abe4dd815f356"`,
    );
    await queryRunner.query(
      `ALTER TABLE "linkedin_posts" DROP CONSTRAINT "FK_f3686d0e1fcae5a0eb189db41b8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "linkedin_organizations" DROP CONSTRAINT "FK_b267864087079392e1a0920963a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "linkedin_accounts" DROP CONSTRAINT "FK_cc2c691eedc005243051f7b9a41"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiktok_upload_sessions" DROP CONSTRAINT "FK_bcecedb51cc5b6b5755ec298742"`,
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
    await queryRunner.query(`DROP TABLE "instagram_rate_limits"`);
    await queryRunner.query(`DROP TABLE "instagram_accounts"`);
    await queryRunner.query(`DROP TABLE "instagram_post"`);
    await queryRunner.query(`DROP TABLE "instagram_metrics"`);
    await queryRunner.query(`DROP TABLE "linkedin_metrics"`);
    await queryRunner.query(`DROP TABLE "linkedin_posts"`);
    await queryRunner.query(`DROP TABLE "linkedin_organizations"`);
    await queryRunner.query(`DROP TABLE "linkedin_accounts"`);
    await queryRunner.query(`DROP TABLE "tiktok_upload_sessions"`);
    await queryRunner.query(
      `DROP TYPE "public"."tiktok_upload_sessions_status_enum"`,
    );
    await queryRunner.query(`DROP TABLE "analytics_records"`);
    await queryRunner.query(`DROP TABLE "scheduled_posts"`);
    await queryRunner.query(`DROP TYPE "public"."scheduled_posts_status_enum"`);
  }
}
