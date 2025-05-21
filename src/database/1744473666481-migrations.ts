import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1744473666481 implements MigrationInterface {
  name = 'Migrations1744473666481';

  public async up(queryRunner: QueryRunner): Promise<void> {
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
      `ALTER TYPE "public"."publish_records_status_enum" RENAME TO "publish_records_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."publish_records_status_enum" AS ENUM('PENDING', 'COMPLETED', 'PARTIALLY_COMPLETED', 'FAILED', 'CANCELED')`,
    );
    await queryRunner.query(
      `ALTER TABLE "publish_records" ALTER COLUMN "status" TYPE "public"."publish_records_status_enum" USING "status"::"text"::"public"."publish_records_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."publish_records_status_enum_old"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."publish_records_status_enum_old" AS ENUM('PENDING', 'COMPLETED', 'PARTIALLY_COMPLETED', 'FAILED')`,
    );
    await queryRunner.query(
      `ALTER TABLE "publish_records" ALTER COLUMN "status" TYPE "public"."publish_records_status_enum_old" USING "status"::"text"::"public"."publish_records_status_enum_old"`,
    );
    await queryRunner.query(`DROP TYPE "public"."publish_records_status_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."publish_records_status_enum_old" RENAME TO "publish_records_status_enum"`,
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
  }
}
