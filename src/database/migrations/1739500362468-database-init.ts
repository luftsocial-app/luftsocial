import { MigrationInterface, QueryRunner } from "typeorm";

export class DatabaseInit1739500362468 implements MigrationInterface {
    name = 'DatabaseInit1739500362468'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "tbl_teams" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "description" character varying, "status" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "tenant_id" uuid, "created_by" uuid, CONSTRAINT "PK_f67d422c12ccdbc2eaa59be89ff" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "tbl_user_tenants" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "userId" uuid, "tenantId" uuid, CONSTRAINT "PK_3a67009cbd1b0f96e77286e3400" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "tbl_tenants" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "slug" character varying NOT NULL, "logo" character varying, "settings" jsonb NOT NULL DEFAULT '{}', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "UQ_6a111522b00b81d4125e757f099" UNIQUE ("name"), CONSTRAINT "UQ_a5b22714c4ec8138130f8f1a777" UNIQUE ("slug"), CONSTRAINT "PK_88f19f0c5788411b2deea454c0b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "tbl_permissions" ("id" SERIAL NOT NULL, "name" character varying(255) NOT NULL, "description" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_5a13bf078da14cd3e1a02c18f1f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."tbl_role_name_enum" AS ENUM('super_admin', 'admin', 'manager', 'editor', 'member')`);
        await queryRunner.query(`CREATE TABLE "tbl_role" ("id" SERIAL NOT NULL, "name" "public"."tbl_role_name_enum" NOT NULL DEFAULT 'member', "description" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_7fb8c467d6259854a09dd60c109" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "tbl_users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "clerkId" character varying NOT NULL, "email" character varying NOT NULL, "username" character varying NOT NULL, "first_name" character varying NOT NULL, "last_name" character varying NOT NULL, "profile" character varying, "phone" character varying, "avatar" character varying, "is_active" boolean NOT NULL DEFAULT true, "permissions" jsonb NOT NULL DEFAULT '[]', "lastSeen" TIMESTAMP, "status" character varying, "customStatus" character varying, "activeTenantId" uuid, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "UQ_f8829e6acbf05847782a009e6cb" UNIQUE ("clerkId"), CONSTRAINT "UQ_d74ab662f9d3964f78b3416d5da" UNIQUE ("email"), CONSTRAINT "PK_bb1d884179b3e42514b36c01e4e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."tbl_conversations_type_enum" AS ENUM('direct', 'group', 'channel')`);
        await queryRunner.query(`CREATE TABLE "tbl_conversations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "type" "public"."tbl_conversations_type_enum" NOT NULL, "is_private" boolean NOT NULL DEFAULT false, "participant_ids" uuid array NOT NULL, "metadata" jsonb NOT NULL DEFAULT '{}', "is_archived" boolean NOT NULL DEFAULT false, "is_deleted" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "settings" jsonb NOT NULL DEFAULT '{}', CONSTRAINT "UQ_adad863dc2a58cea732a621585e" UNIQUE ("name"), CONSTRAINT "PK_d583a2356174d9d8f992cbda455" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."tbl_messages_type_enum" AS ENUM('text', 'image', 'video', 'audio', 'file', 'link', 'location')`);
        await queryRunner.query(`CREATE TYPE "public"."tbl_messages_status_enum" AS ENUM('sending', 'sent', 'delivered', 'read', 'failed')`);
        await queryRunner.query(`CREATE TABLE "tbl_messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "content" character varying NOT NULL, "type" "public"."tbl_messages_type_enum" NOT NULL DEFAULT 'text', "attachments" jsonb, "is_edited" boolean NOT NULL DEFAULT false, "is_deleted" boolean NOT NULL DEFAULT false, "is_pinned" boolean NOT NULL DEFAULT false, "status" "public"."tbl_messages_status_enum" NOT NULL DEFAULT 'sending', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "deleted_by" character varying, "metadata" jsonb NOT NULL DEFAULT '{}', "conversation_id" uuid, "sender_id" uuid, "parent_message_id" uuid, CONSTRAINT "PK_4eb2382c2253d34bbef50ffe260" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "tbl_posts" ("id" SERIAL NOT NULL, "title" character varying NOT NULL, "content" character varying NOT NULL, "Tenant_id" character varying NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_95df0a6af5476f1c4b9cc7024f0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."tbl_conversation_members_role_enum" AS ENUM('owner', 'admin', 'moderator', 'member')`);
        await queryRunner.query(`CREATE TYPE "public"."tbl_conversation_members_status_enum" AS ENUM('pending', 'member', 'banned')`);
        await queryRunner.query(`CREATE TABLE "tbl_conversation_members" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "role" "public"."tbl_conversation_members_role_enum" NOT NULL DEFAULT 'member', "status" "public"."tbl_conversation_members_status_enum" NOT NULL DEFAULT 'member', "last_active_at" TIMESTAMP NOT NULL DEFAULT now(), "settings" jsonb NOT NULL DEFAULT '{}', "conversation_id" uuid, "user_id" uuid, CONSTRAINT "PK_f25af9f59e3217b9d292e7bfe6f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "tbl_message_read" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "read_at" TIMESTAMP NOT NULL DEFAULT now(), "messageId" uuid, "userId" uuid, CONSTRAINT "PK_62a29b4c555cef804a935f07d01" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "user_role_change" ("id" SERIAL NOT NULL, "userId" uuid NOT NULL, "changedById" uuid NOT NULL, "previousRole" character varying NOT NULL, "new_role" character varying NOT NULL, "reason" text, CONSTRAINT "PK_e6729dee50a54584d8f00029cb8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."tbl_notifications_type_enum" AS ENUM('mention', 'reaction', 'message')`);
        await queryRunner.query(`CREATE TABLE "tbl_notifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "type" "public"."tbl_notifications_type_enum" NOT NULL, "is_read" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "userId" uuid, "messageId" uuid, CONSTRAINT "PK_864f5e52afeed73fdfd87ba738b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "tbL_user_team" ("teamId" uuid NOT NULL, "userId" uuid NOT NULL, CONSTRAINT "PK_e9dfcd53c17ff781c020ea4889f" PRIMARY KEY ("teamId", "userId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_68a1d67a78efa96ae407039a40" ON "tbL_user_team" ("teamId") `);
        await queryRunner.query(`CREATE INDEX "IDX_fc13391b902a8ea15e38a97f4e" ON "tbL_user_team" ("userId") `);
        await queryRunner.query(`CREATE TABLE "tbl_user_roles" ("role_id" uuid NOT NULL, "user_id" integer NOT NULL, CONSTRAINT "PK_8fe07cf638d5a10cbbadf9d1acd" PRIMARY KEY ("role_id", "user_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_51268e8174fa9c9005e205b3ce" ON "tbl_user_roles" ("role_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_3d2485c50c1ddde2ef4b5da79a" ON "tbl_user_roles" ("user_id") `);
        await queryRunner.query(`ALTER TABLE "tbl_teams" ADD CONSTRAINT "FK_b1f535ed3774f1ff54c1bbfd092" FOREIGN KEY ("tenant_id") REFERENCES "tbl_tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tbl_teams" ADD CONSTRAINT "FK_10c2ab092899ec1127f95aea849" FOREIGN KEY ("created_by") REFERENCES "tbl_users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tbl_user_tenants" ADD CONSTRAINT "FK_09ff7768b7cfcb668fbb88aecec" FOREIGN KEY ("userId") REFERENCES "tbl_users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tbl_user_tenants" ADD CONSTRAINT "FK_0ecd80fbb657f772cc37d773218" FOREIGN KEY ("tenantId") REFERENCES "tbl_tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tbl_users" ADD CONSTRAINT "FK_56d36118ebe11d3e2f2f4220c49" FOREIGN KEY ("activeTenantId") REFERENCES "tbl_tenants"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tbl_messages" ADD CONSTRAINT "FK_9327752904d7093e99bc40adcac" FOREIGN KEY ("conversation_id") REFERENCES "tbl_conversations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tbl_messages" ADD CONSTRAINT "FK_32be73b4b2a46165650c138c787" FOREIGN KEY ("sender_id") REFERENCES "tbl_users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tbl_messages" ADD CONSTRAINT "FK_27002f451b32428bddb6a02fd3c" FOREIGN KEY ("parent_message_id") REFERENCES "tbl_messages"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tbl_conversation_members" ADD CONSTRAINT "FK_212fc8bbbca9e47a7921c4a38a8" FOREIGN KEY ("conversation_id") REFERENCES "tbl_conversations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tbl_conversation_members" ADD CONSTRAINT "FK_80e91db4959aea003ba36543d25" FOREIGN KEY ("user_id") REFERENCES "tbl_users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tbl_message_read" ADD CONSTRAINT "FK_edd768f5a475f149c845dd36a05" FOREIGN KEY ("messageId") REFERENCES "tbl_messages"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tbl_message_read" ADD CONSTRAINT "FK_df25097fef293ef1e5201f8349a" FOREIGN KEY ("userId") REFERENCES "tbl_users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tbl_notifications" ADD CONSTRAINT "FK_c1fcaf7145486d8cfaa8a4e8a48" FOREIGN KEY ("userId") REFERENCES "tbl_users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tbl_notifications" ADD CONSTRAINT "FK_bc5d82a648b94ab5c73a614fa03" FOREIGN KEY ("messageId") REFERENCES "tbl_messages"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tbL_user_team" ADD CONSTRAINT "FK_68a1d67a78efa96ae407039a407" FOREIGN KEY ("teamId") REFERENCES "tbl_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "tbL_user_team" ADD CONSTRAINT "FK_fc13391b902a8ea15e38a97f4e2" FOREIGN KEY ("userId") REFERENCES "tbl_users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tbl_user_roles" ADD CONSTRAINT "FK_51268e8174fa9c9005e205b3ce8" FOREIGN KEY ("role_id") REFERENCES "tbl_users"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "tbl_user_roles" ADD CONSTRAINT "FK_3d2485c50c1ddde2ef4b5da79a6" FOREIGN KEY ("user_id") REFERENCES "tbl_role"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tbl_user_roles" DROP CONSTRAINT "FK_3d2485c50c1ddde2ef4b5da79a6"`);
        await queryRunner.query(`ALTER TABLE "tbl_user_roles" DROP CONSTRAINT "FK_51268e8174fa9c9005e205b3ce8"`);
        await queryRunner.query(`ALTER TABLE "tbL_user_team" DROP CONSTRAINT "FK_fc13391b902a8ea15e38a97f4e2"`);
        await queryRunner.query(`ALTER TABLE "tbL_user_team" DROP CONSTRAINT "FK_68a1d67a78efa96ae407039a407"`);
        await queryRunner.query(`ALTER TABLE "tbl_notifications" DROP CONSTRAINT "FK_bc5d82a648b94ab5c73a614fa03"`);
        await queryRunner.query(`ALTER TABLE "tbl_notifications" DROP CONSTRAINT "FK_c1fcaf7145486d8cfaa8a4e8a48"`);
        await queryRunner.query(`ALTER TABLE "tbl_message_read" DROP CONSTRAINT "FK_df25097fef293ef1e5201f8349a"`);
        await queryRunner.query(`ALTER TABLE "tbl_message_read" DROP CONSTRAINT "FK_edd768f5a475f149c845dd36a05"`);
        await queryRunner.query(`ALTER TABLE "tbl_conversation_members" DROP CONSTRAINT "FK_80e91db4959aea003ba36543d25"`);
        await queryRunner.query(`ALTER TABLE "tbl_conversation_members" DROP CONSTRAINT "FK_212fc8bbbca9e47a7921c4a38a8"`);
        await queryRunner.query(`ALTER TABLE "tbl_messages" DROP CONSTRAINT "FK_27002f451b32428bddb6a02fd3c"`);
        await queryRunner.query(`ALTER TABLE "tbl_messages" DROP CONSTRAINT "FK_32be73b4b2a46165650c138c787"`);
        await queryRunner.query(`ALTER TABLE "tbl_messages" DROP CONSTRAINT "FK_9327752904d7093e99bc40adcac"`);
        await queryRunner.query(`ALTER TABLE "tbl_users" DROP CONSTRAINT "FK_56d36118ebe11d3e2f2f4220c49"`);
        await queryRunner.query(`ALTER TABLE "tbl_user_tenants" DROP CONSTRAINT "FK_0ecd80fbb657f772cc37d773218"`);
        await queryRunner.query(`ALTER TABLE "tbl_user_tenants" DROP CONSTRAINT "FK_09ff7768b7cfcb668fbb88aecec"`);
        await queryRunner.query(`ALTER TABLE "tbl_teams" DROP CONSTRAINT "FK_10c2ab092899ec1127f95aea849"`);
        await queryRunner.query(`ALTER TABLE "tbl_teams" DROP CONSTRAINT "FK_b1f535ed3774f1ff54c1bbfd092"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3d2485c50c1ddde2ef4b5da79a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_51268e8174fa9c9005e205b3ce"`);
        await queryRunner.query(`DROP TABLE "tbl_user_roles"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fc13391b902a8ea15e38a97f4e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_68a1d67a78efa96ae407039a40"`);
        await queryRunner.query(`DROP TABLE "tbL_user_team"`);
        await queryRunner.query(`DROP TABLE "tbl_notifications"`);
        await queryRunner.query(`DROP TYPE "public"."tbl_notifications_type_enum"`);
        await queryRunner.query(`DROP TABLE "user_role_change"`);
        await queryRunner.query(`DROP TABLE "tbl_message_read"`);
        await queryRunner.query(`DROP TABLE "tbl_conversation_members"`);
        await queryRunner.query(`DROP TYPE "public"."tbl_conversation_members_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."tbl_conversation_members_role_enum"`);
        await queryRunner.query(`DROP TABLE "tbl_posts"`);
        await queryRunner.query(`DROP TABLE "tbl_messages"`);
        await queryRunner.query(`DROP TYPE "public"."tbl_messages_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."tbl_messages_type_enum"`);
        await queryRunner.query(`DROP TABLE "tbl_conversations"`);
        await queryRunner.query(`DROP TYPE "public"."tbl_conversations_type_enum"`);
        await queryRunner.query(`DROP TABLE "tbl_users"`);
        await queryRunner.query(`DROP TABLE "tbl_role"`);
        await queryRunner.query(`DROP TYPE "public"."tbl_role_name_enum"`);
        await queryRunner.query(`DROP TABLE "tbl_permissions"`);
        await queryRunner.query(`DROP TABLE "tbl_tenants"`);
        await queryRunner.query(`DROP TABLE "tbl_user_tenants"`);
        await queryRunner.query(`DROP TABLE "tbl_teams"`);
    }

}
