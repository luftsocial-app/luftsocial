import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1744056041332 implements MigrationInterface {
  name = 'Migrations1744056041332';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tbl_user_tenants" DROP CONSTRAINT "FK_0ecd80fbb657f772cc37d773218"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tbl_user_tenants" DROP CONSTRAINT "FK_09ff7768b7cfcb668fbb88aecec"`,
    );
    await queryRunner.query(
      `ALTER TABLE "linkedin_metrics" DROP COLUMN "uniqueImpressions"`,
    );
    await queryRunner.query(
      `ALTER TABLE "linkedin_metrics" DROP COLUMN "industryData"`,
    );
    await queryRunner.query(
      `ALTER TABLE "linkedin_metrics" DROP COLUMN "updatedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "linkedin_metrics" DROP COLUMN "tenantId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tbl_user_tenants" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tbl_user_tenants" DROP COLUMN "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tbl_user_tenants" DROP COLUMN "deleted_at"`,
    );
    await queryRunner.query(`ALTER TABLE "tbl_user_tenants" DROP COLUMN "id"`);
    await queryRunner.query(
      `ALTER TABLE "tbl_user_tenants" DROP COLUMN "userId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tbl_user_tenants" DROP COLUMN "tenantId"`,
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
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
      `ALTER TABLE "tbl_user_tenants" ADD "tenantId" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "tbl_user_tenants" ADD "userId" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "tbl_user_tenants" ADD "id" character varying NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tbl_user_tenants" ADD "deleted_at" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "tbl_user_tenants" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "tbl_user_tenants" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "linkedin_metrics" ADD "tenantId" character varying NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "linkedin_metrics" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "linkedin_metrics" ADD "industryData" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "linkedin_metrics" ADD "uniqueImpressions" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "tbl_user_tenants" ADD CONSTRAINT "FK_09ff7768b7cfcb668fbb88aecec" FOREIGN KEY ("userId") REFERENCES "tbl_users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tbl_user_tenants" ADD CONSTRAINT "FK_0ecd80fbb657f772cc37d773218" FOREIGN KEY ("tenantId") REFERENCES "tbl_tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }
}
