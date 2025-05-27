import { MigrationInterface, QueryRunner } from "typeorm";

export class Migrations1748361690923 implements MigrationInterface {
    name = 'Migrations1748361690923'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "linkedin_metrics" DROP COLUMN "uniqueImpressions"`);
        await queryRunner.query(`ALTER TABLE "linkedin_metrics" DROP COLUMN "industryData"`);
        await queryRunner.query(`ALTER TABLE "linkedin_metrics" DROP COLUMN "updatedAt"`);
        await queryRunner.query(`ALTER TABLE "linkedin_metrics" DROP COLUMN "tenantId"`);
        await queryRunner.query(`ALTER TABLE "linkedin_metrics" ADD "tenantId" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "linkedin_metrics" ADD "uniqueImpressions" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "linkedin_metrics" ADD "industryData" jsonb`);
        await queryRunner.query(`ALTER TABLE "linkedin_metrics" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "linkedin_metrics" DROP COLUMN "updatedAt"`);
        await queryRunner.query(`ALTER TABLE "linkedin_metrics" DROP COLUMN "industryData"`);
        await queryRunner.query(`ALTER TABLE "linkedin_metrics" DROP COLUMN "uniqueImpressions"`);
        await queryRunner.query(`ALTER TABLE "linkedin_metrics" DROP COLUMN "tenantId"`);
        await queryRunner.query(`ALTER TABLE "linkedin_metrics" ADD "tenantId" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "linkedin_metrics" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "linkedin_metrics" ADD "industryData" jsonb`);
        await queryRunner.query(`ALTER TABLE "linkedin_metrics" ADD "uniqueImpressions" integer NOT NULL DEFAULT '0'`);
    }

}
