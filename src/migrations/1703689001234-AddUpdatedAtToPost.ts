import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUpdatedAtToPost1703689001234 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "tbl_posts" 
            ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "tbl_posts" 
            DROP COLUMN "updated_at"
        `);
  }
}
