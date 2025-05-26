import { MigrationInterface, QueryRunner } from "typeorm";

export class Migrations1748236185321 implements MigrationInterface {
    name = 'Migrations1748236185321'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "instagram_accounts" DROP CONSTRAINT "FK_15fc4ab1f3a8f6abcadad0a4f54"`);
        await queryRunner.query(`ALTER TABLE "linkedin_metrics" DROP COLUMN "uniqueImpressions"`);
        await queryRunner.query(`ALTER TABLE "linkedin_metrics" DROP COLUMN "industryData"`);
        await queryRunner.query(`ALTER TABLE "linkedin_metrics" DROP COLUMN "updatedAt"`);
        await queryRunner.query(`ALTER TABLE "linkedin_metrics" DROP COLUMN "tenantId"`);
        await queryRunner.query(`ALTER TABLE "linkedin_metrics" ADD "tenantId" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "linkedin_metrics" ADD "uniqueImpressions" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "linkedin_metrics" ADD "industryData" jsonb`);
        await queryRunner.query(`ALTER TABLE "linkedin_metrics" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "instagram_accounts" ALTER COLUMN "socialAccountId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "instagram_accounts" DROP CONSTRAINT "REL_15fc4ab1f3a8f6abcadad0a4f5"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "instagram_accounts" ADD CONSTRAINT "REL_15fc4ab1f3a8f6abcadad0a4f5" UNIQUE ("socialAccountId")`);
        await queryRunner.query(`ALTER TABLE "instagram_accounts" ALTER COLUMN "socialAccountId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "linkedin_metrics" DROP COLUMN "updatedAt"`);
        await queryRunner.query(`ALTER TABLE "linkedin_metrics" DROP COLUMN "industryData"`);
        await queryRunner.query(`ALTER TABLE "linkedin_metrics" DROP COLUMN "uniqueImpressions"`);
        await queryRunner.query(`ALTER TABLE "linkedin_metrics" DROP COLUMN "tenantId"`);
        await queryRunner.query(`ALTER TABLE "linkedin_metrics" ADD "tenantId" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "linkedin_metrics" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "linkedin_metrics" ADD "industryData" jsonb`);
        await queryRunner.query(`ALTER TABLE "linkedin_metrics" ADD "uniqueImpressions" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "instagram_accounts" ADD CONSTRAINT "FK_15fc4ab1f3a8f6abcadad0a4f54" FOREIGN KEY ("socialAccountId") REFERENCES "social_accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
