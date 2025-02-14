import { MigrationInterface, QueryRunner } from 'typeorm';

export class DatabaseInit1739500585197 implements MigrationInterface {
  name = 'DatabaseInit1739500585197';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "tbl_user_role_change" ("id" SERIAL NOT NULL, "userId" uuid NOT NULL, "changedById" uuid NOT NULL, "previousRole" character varying NOT NULL, "new_role" character varying NOT NULL, "reason" text, CONSTRAINT "PK_0e954ce7cb67395e66a7cfb0765" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "tbl_user_role_change"`);
  }
}
