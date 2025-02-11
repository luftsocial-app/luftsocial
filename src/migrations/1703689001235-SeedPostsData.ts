import { MigrationInterface, QueryRunner } from "typeorm";

export class SeedPostsData1703689001235 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            INSERT INTO "tbl_posts" (title, content, "organization_id", "created_at", "updated_at") VALUES
            ('Post 1', 'Content for post 1', 'org_2se12SO189SxUvkqgTFI1uU7vqb', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
            ('Post 2', 'Content for post 2', 'org_false1', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
            ('Post 3', 'Content for post 3', 'org_false2', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
            ('Post 4', 'Content for post 4', 'org_false3', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DELETE FROM "tbl_posts" 
            WHERE "organization_id" IN (
                'org_2se12SO189SxUvkqgTFI1uU7vqb',
                'org_false1',
                'org_false2',
                'org_false3'
            );
        `);
    }
}
