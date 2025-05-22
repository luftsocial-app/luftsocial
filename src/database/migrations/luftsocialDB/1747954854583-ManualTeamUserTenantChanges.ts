import { MigrationInterface, QueryRunner } from "typeorm";

export class ManualTeamUserTenantChanges1747954854583 implements MigrationInterface {
    name = 'ManualTeamUserTenantChanges1747954854583'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add tenant_id column to teams table
        await queryRunner.query(`ALTER TABLE "teams" ADD "tenant_id" uuid`);
        // Add created_by_user_id column to teams table
        await queryRunner.query(`ALTER TABLE "teams" ADD "created_by_user_id" uuid`);

        // Add foreign key constraint for teams.tenant_id -> tbl_tenants.id
        // Making tenant_id NOT NULL as per entity definition (ManyToOne, nullable: false)
        await queryRunner.query(`ALTER TABLE "teams" ALTER COLUMN "tenant_id" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "teams" ADD CONSTRAINT "FK_teams_tenant_id_tbl_tenants" FOREIGN KEY ("tenant_id") REFERENCES "tbl_tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        
        // Add foreign key constraint for teams.created_by_user_id -> tbl_users.id
        // This column is nullable in the entity (createdBy?: User)
        await queryRunner.query(`ALTER TABLE "teams" ADD CONSTRAINT "FK_teams_created_by_user_id_tbl_users" FOREIGN KEY ("created_by_user_id") REFERENCES "tbl_users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop foreign key constraint for teams.created_by_user_id
        await queryRunner.query(`ALTER TABLE "teams" DROP CONSTRAINT "FK_teams_created_by_user_id_tbl_users"`);
        // Drop foreign key constraint for teams.tenant_id
        await queryRunner.query(`ALTER TABLE "teams" DROP CONSTRAINT "FK_teams_tenant_id_tbl_tenants"`);

        // Drop created_by_user_id column from teams table
        await queryRunner.query(`ALTER TABLE "teams" DROP COLUMN "created_by_user_id"`);
        // Drop tenant_id column from teams table
        await queryRunner.query(`ALTER TABLE "teams" DROP COLUMN "tenant_id"`);
    }

}
