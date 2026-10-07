import { MigrationInterface, QueryRunner } from "typeorm";

export class CrearUsuariosYPerfiles17891389648788 implements MigrationInterface {
    name = 'CrearUsuariosYPerfiles17891389648788'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "monolithschema"."profiles" ("id" uuid NOT NULL, "user_id" uuid NOT NULL, "full_name" character varying(120) NOT NULL, "headline" character varying(160), "bio" text, "location" character varying(120), "public_email" character varying(255), "avatar_url" text, "is_private" boolean NOT NULL DEFAULT false, "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_9e432b7df0d182f8d292902d1a2" UNIQUE ("user_id"), CONSTRAINT "PK_8e520eb4da7dc01d0e190447c8e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_profiles_is_private" ON "monolithschema"."profiles"  ("is_private") `);
        await queryRunner.query(`CREATE TABLE "monolithschema"."users" ("id" uuid NOT NULL, "username" character varying(50) NOT NULL, "email" character varying(255) NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_fe0bb3f6520ee0469504521e710" UNIQUE ("username"), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_users_is_active" ON "monolithschema"."users"  ("is_active") `);

        // SIN foreign key de `profiles.user_id` a `users.id`, a propósito.
        //
        // Declararla en la entidad obliga a `profile` a importar `UserEntity`,
        // y `user` y `profile` ya están en el mismo módulo, así que el
        // acoplamiento es barato... pero ata la integridad a que la entidad
        // declare la relación: si se escribe a mano aquí sin declararla,
        // TypeORM no la conoce y cada `migration:generate` posterior propone
        // volver a crearla. Un esquema que no para de drift es peor que uno
        // sin integridad.
        //
        // Lo que sí hay es `UNIQUE (user_id)` en la propia tabla: un perfil por
        // usuario, que es la regla que de verdad importaba. El borrado en
        // cascada, cuando exista `deleteUser`, se hace en el caso de uso, que
        // es donde se puede decidir qué pasa con el perfil.
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "monolithschema"."idx_profiles_is_private"`);
        await queryRunner.query(`DROP TABLE "monolithschema"."profiles"`);
        await queryRunner.query(`DROP INDEX "monolithschema"."idx_users_is_active"`);
        await queryRunner.query(`DROP TABLE "monolithschema"."users"`);
        // La extensión no se borra: es del motor, no de esta migración. Dejar
        // `CREATE EXTENSION` sin su DROP es lo correcto cuando la comparten
        // varias tablas.
    }

}
