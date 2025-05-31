import { MigrationInterface, QueryRunner } from "typeorm";

export class Migrations1747755109620 implements MigrationInterface {
    name = 'Migrations1747755109620'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."social_accounts_platform_enum" RENAME TO "social_accounts_platform_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."social_accounts_platform_enum" AS ENUM('instagram', 'instagram_business', 'facebook', 'tiktok', 'linkedin')`);
        await queryRunner.query(`ALTER TABLE "social_accounts" ALTER COLUMN "platform" TYPE "public"."social_accounts_platform_enum" USING "platform"::"text"::"public"."social_accounts_platform_enum"`);
        await queryRunner.query(`DROP TYPE "public"."social_accounts_platform_enum_old"`);
        await queryRunner.query(`ALTER TYPE "public"."auth_states_platform_enum" RENAME TO "auth_states_platform_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."auth_states_platform_enum" AS ENUM('instagram', 'instagram_business', 'facebook', 'tiktok', 'linkedin')`);
        await queryRunner.query(`ALTER TABLE "auth_states" ALTER COLUMN "platform" TYPE "public"."auth_states_platform_enum" USING "platform"::"text"::"public"."auth_states_platform_enum"`);
        await queryRunner.query(`DROP TYPE "public"."auth_states_platform_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."auth_states_platform_enum_old" AS ENUM('INSTAGRAM', 'INSTAGRAM_BUSINESS', 'FACEBOOK', 'TIKTOK', 'LINKEDIN')`);
        await queryRunner.query(`ALTER TABLE "auth_states" ALTER COLUMN "platform" TYPE "public"."auth_states_platform_enum_old" USING "platform"::"text"::"public"."auth_states_platform_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."auth_states_platform_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."auth_states_platform_enum_old" RENAME TO "auth_states_platform_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."social_accounts_platform_enum_old" AS ENUM('INSTAGRAM', 'INSTAGRAM_BUSINESS', 'FACEBOOK', 'TIKTOK', 'LINKEDIN')`);
        await queryRunner.query(`ALTER TABLE "social_accounts" ALTER COLUMN "platform" TYPE "public"."social_accounts_platform_enum_old" USING "platform"::"text"::"public"."social_accounts_platform_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."social_accounts_platform_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."social_accounts_platform_enum_old" RENAME TO "social_accounts_platform_enum"`);
    }

}
