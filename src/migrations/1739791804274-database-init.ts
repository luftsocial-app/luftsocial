import { MigrationInterface, QueryRunner } from 'typeorm';

export class DatabaseInit1739791804274 implements MigrationInterface {
  name = 'DatabaseInit1739791804274';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tbl_messages" DROP CONSTRAINT "FK_9327752904d7093e99bc40adcac"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tbl_posts" RENAME COLUMN "Tenant_id" TO "tenant_id"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."tbl_chat_participants_role_enum" AS ENUM('owner', 'admin', 'moderator', 'member')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."tbl_chat_participants_status_enum" AS ENUM('pending', 'member', 'banned')`,
    );
    await queryRunner.query(
      `CREATE TABLE "tbl_chat_participants" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "role" "public"."tbl_chat_participants_role_enum" NOT NULL DEFAULT 'member', "status" "public"."tbl_chat_participants_status_enum" NOT NULL DEFAULT 'member', "last_active_at" TIMESTAMP NOT NULL DEFAULT now(), "settings" jsonb NOT NULL DEFAULT '{}', "conversation_id" uuid, "user_id" uuid, CONSTRAINT "PK_0b94dd33bdfa39eec78fa013525" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "tbl_conversations" DROP COLUMN "participant_ids"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tbl_messages" ADD "tenant_id" character varying NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tbl_conversations" ADD "senderId" character varying NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tbl_conversations" ADD "tenant_id" character varying NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tbl_messages" DROP COLUMN "conversation_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tbl_messages" ADD "conversation_id" character varying NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0fc3de0aa047281c5b7dcae6a2" ON "tbl_messages" ("tenant_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "tbl_chat_participants" ADD CONSTRAINT "FK_702a7563e36ec9f50940afb80da" FOREIGN KEY ("conversation_id") REFERENCES "tbl_conversations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tbl_chat_participants" ADD CONSTRAINT "FK_34f267edcccbda0a51c0d8570fc" FOREIGN KEY ("user_id") REFERENCES "tbl_users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tbl_chat_participants" DROP CONSTRAINT "FK_34f267edcccbda0a51c0d8570fc"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tbl_chat_participants" DROP CONSTRAINT "FK_702a7563e36ec9f50940afb80da"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_0fc3de0aa047281c5b7dcae6a2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tbl_messages" DROP COLUMN "conversation_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tbl_messages" ADD "conversation_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "tbl_conversations" DROP COLUMN "tenant_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tbl_conversations" DROP COLUMN "senderId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tbl_messages" DROP COLUMN "tenant_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tbl_conversations" ADD "participant_ids" uuid array NOT NULL`,
    );
    await queryRunner.query(`DROP TABLE "tbl_chat_participants"`);
    await queryRunner.query(
      `DROP TYPE "public"."tbl_chat_participants_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."tbl_chat_participants_role_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tbl_posts" RENAME COLUMN "tenant_id" TO "Tenant_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tbl_messages" ADD CONSTRAINT "FK_9327752904d7093e99bc40adcac" FOREIGN KEY ("conversation_id") REFERENCES "tbl_conversations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }
}
