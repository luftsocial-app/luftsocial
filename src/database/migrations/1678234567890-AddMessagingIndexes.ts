import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration to add optimized indexes to messaging tables
 */
export class AddMessagingIndexes1678234567890 implements MigrationInterface {
  name = 'AddMessagingIndexes1678234567890';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Message indexes
    await queryRunner.query(
      `CREATE INDEX "idx_msg_conversation" ON "messages" ("conversation_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_msg_sender" ON "messages" ("sender_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_msg_type" ON "messages" ("type")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_msg_deleted" ON "messages" ("is_deleted")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_msg_pinned" ON "messages" ("is_pinned")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_msg_status" ON "messages" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_msg_parent" ON "messages" ("parent_message_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_msg_search" ON "messages" ("conversation_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_msg_tenant_created" ON "messages" ("tenant_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_msg_created_at" ON "messages" ("created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_msg_tenant" ON "messages" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_msg_deleted_at" ON "messages" ("deleted_at")`,
    );

    // Conversation indexes
    await queryRunner.query(
      `CREATE INDEX "idx_conv_name" ON "conversations" ("name")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_conv_type" ON "conversations" ("type")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_conv_privacy" ON "conversations" ("is_private")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_conv_last_message" ON "conversations" ("lastMessageAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_conv_tenant_created" ON "conversations" ("tenant_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_conv_created_at" ON "conversations" ("created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_conv_tenant" ON "conversations" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_conv_deleted_at" ON "conversations" ("deleted_at")`,
    );

    // Participant indexes
    await queryRunner.query(
      `CREATE INDEX "idx_part_conversation" ON "conversation_participants" ("conversation_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_part_user" ON "conversation_participants" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_part_role" ON "conversation_participants" ("role")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_part_status" ON "conversation_participants" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_part_last_active" ON "conversation_participants" ("last_active_at")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_part_user_conversation" ON "conversation_participants" ("user_id", "conversation_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_part_tenant_created" ON "conversation_participants" ("tenant_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_part_created_at" ON "conversation_participants" ("created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_part_tenant" ON "conversation_participants" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_part_deleted_at" ON "conversation_participants" ("deleted_at")`,
    );

    // Attachment indexes
    await queryRunner.query(
      `CREATE INDEX "idx_att_message" ON "message_attachments" ("message_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_att_mime_type" ON "message_attachments" ("mime_type")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_att_type" ON "message_attachments" ("type")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_att_processing" ON "message_attachments" ("processingStatus")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_att_tenant_created" ON "message_attachments" ("tenant_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_att_created_at" ON "message_attachments" ("created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_att_tenant" ON "message_attachments" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_att_deleted_at" ON "message_attachments" ("deleted_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop attachment indexes
    await queryRunner.query(`DROP INDEX "idx_att_deleted_at"`);
    await queryRunner.query(`DROP INDEX "idx_att_tenant"`);
    await queryRunner.query(`DROP INDEX "idx_att_created_at"`);
    await queryRunner.query(`DROP INDEX "idx_att_tenant_created"`);
    await queryRunner.query(`DROP INDEX "idx_att_processing"`);
    await queryRunner.query(`DROP INDEX "idx_att_type"`);
    await queryRunner.query(`DROP INDEX "idx_att_mime_type"`);
    await queryRunner.query(`DROP INDEX "idx_att_message"`);

    // Drop participant indexes
    await queryRunner.query(`DROP INDEX "idx_part_deleted_at"`);
    await queryRunner.query(`DROP INDEX "idx_part_tenant"`);
    await queryRunner.query(`DROP INDEX "idx_part_created_at"`);
    await queryRunner.query(`DROP INDEX "idx_part_tenant_created"`);
    await queryRunner.query(`DROP INDEX "idx_part_user_conversation"`);
    await queryRunner.query(`DROP INDEX "idx_part_last_active"`);
    await queryRunner.query(`DROP INDEX "idx_part_status"`);
    await queryRunner.query(`DROP INDEX "idx_part_role"`);
    await queryRunner.query(`DROP INDEX "idx_part_user"`);
    await queryRunner.query(`DROP INDEX "idx_part_conversation"`);

    // Drop conversation indexes
    await queryRunner.query(`DROP INDEX "idx_conv_deleted_at"`);
    await queryRunner.query(`DROP INDEX "idx_conv_tenant"`);
    await queryRunner.query(`DROP INDEX "idx_conv_created_at"`);
    await queryRunner.query(`DROP INDEX "idx_conv_tenant_created"`);
    await queryRunner.query(`DROP INDEX "idx_conv_last_message"`);
    await queryRunner.query(`DROP INDEX "idx_conv_privacy"`);
    await queryRunner.query(`DROP INDEX "idx_conv_type"`);
    await queryRunner.query(`DROP INDEX "idx_conv_name"`);

    // Drop message indexes
    await queryRunner.query(`DROP INDEX "idx_msg_deleted_at"`);
    await queryRunner.query(`DROP INDEX "idx_msg_tenant"`);
    await queryRunner.query(`DROP INDEX "idx_msg_created_at"`);
    await queryRunner.query(`DROP INDEX "idx_msg_tenant_created"`);
    await queryRunner.query(`DROP INDEX "idx_msg_search"`);
    await queryRunner.query(`DROP INDEX "idx_msg_parent"`);
    await queryRunner.query(`DROP INDEX "idx_msg_status"`);
    await queryRunner.query(`DROP INDEX "idx_msg_pinned"`);
    await queryRunner.query(`DROP INDEX "idx_msg_deleted"`);
    await queryRunner.query(`DROP INDEX "idx_msg_type"`);
    await queryRunner.query(`DROP INDEX "idx_msg_sender"`);
    await queryRunner.query(`DROP INDEX "idx_msg_conversation"`);
  }
}
