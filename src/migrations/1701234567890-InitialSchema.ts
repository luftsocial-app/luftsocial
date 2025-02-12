import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1701234567890 implements MigrationInterface {
  name = 'InitialSchema1701234567890';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE "tbl_permissions" (
                "id" SERIAL NOT NULL,
                "name" character varying NOT NULL,
                "description" character varying,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_permissions" PRIMARY KEY ("id")
            )
        `);

    await queryRunner.query(`
            CREATE TABLE "tbl_roles" (
                "id" SERIAL NOT NULL,
                "name" character varying NOT NULL,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_roles" PRIMARY KEY ("id")
            )
        `);

    await queryRunner.query(`
            CREATE TABLE "tbl_organizations" (
                "id" uuid NOT NULL,
                "name" character varying NOT NULL,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_organizations" PRIMARY KEY ("id")
            )
        `);

    await queryRunner.query(`
            CREATE TABLE "tbl_users" (
                "id" uuid NOT NULL,
                "clerk_id" character varying NOT NULL,
                "email" character varying NOT NULL,
                "first_name" character varying NOT NULL,
                "last_name" character varying NOT NULL,
                "is_active" boolean NOT NULL DEFAULT true,
                "organization_id" uuid NOT NULL,
                CONSTRAINT "UQ_clerk_id" UNIQUE ("clerk_id"),
                CONSTRAINT "UQ_email" UNIQUE ("email"),
                CONSTRAINT "PK_users" PRIMARY KEY ("id")
            )
        `);

    await queryRunner.query(`
            CREATE TABLE "tbl_groups" (
                "id" SERIAL NOT NULL,
                "name" character varying NOT NULL,
                "description" character varying,
                "tenant_id" character varying NOT NULL,
                "created_by" uuid,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_groups" PRIMARY KEY ("id")
            )
        `);

    await queryRunner.query(`
            CREATE TABLE "tbl_group_members" (
                "id" SERIAL NOT NULL,
                "role" character varying NOT NULL,
                "status" boolean NOT NULL DEFAULT true,
                "tenant_id" character varying NOT NULL,
                "user_id" uuid,
                "group_id" integer,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_group_members" PRIMARY KEY ("id")
            )
        `);

    await queryRunner.query(`
            CREATE TABLE "tbl_messages" (
                "id" SERIAL NOT NULL,
                "content" character varying NOT NULL,
                "sender_id" uuid,
                "receiver_id" uuid,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_messages" PRIMARY KEY ("id")
            )
        `);

    await queryRunner.query(`
            CREATE TABLE "tbl_posts" (
                "id" SERIAL NOT NULL,
                "title" character varying NOT NULL,
                "content" character varying NOT NULL,
                "organization_id" character varying NOT NULL,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_posts" PRIMARY KEY ("id")
            )
        `);

    // Add foreign key constraints
    await queryRunner.query(`
            ALTER TABLE "tbl_users" ADD CONSTRAINT "FK_organization"
            FOREIGN KEY ("organization_id") REFERENCES "tbl_organizations"("id")
        `);

    await queryRunner.query(`
            ALTER TABLE "tbl_group_members" ADD CONSTRAINT "FK_user"
            FOREIGN KEY ("user_id") REFERENCES "tbl_users"("id")
        `);

    await queryRunner.query(`
            ALTER TABLE "tbl_group_members" ADD CONSTRAINT "FK_group"
            FOREIGN KEY ("group_id") REFERENCES "tbl_groups"("id")
        `);

    await queryRunner.query(`
            ALTER TABLE "tbl_groups" ADD CONSTRAINT "FK_created_by"
            FOREIGN KEY ("created_by") REFERENCES "tbl_users"("id")
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "tbl_posts"`);
    await queryRunner.query(`DROP TABLE "tbl_messages"`);
    await queryRunner.query(`DROP TABLE "tbl_group_members"`);
    await queryRunner.query(`DROP TABLE "tbl_groups"`);
    await queryRunner.query(`DROP TABLE "tbl_users"`);
    await queryRunner.query(`DROP TABLE "tbl_organizations"`);
    await queryRunner.query(`DROP TABLE "tbl_roles"`);
    await queryRunner.query(`DROP TABLE "tbl_permissions"`);
  }
}
