import { MigrationInterface, QueryRunner } from 'typeorm';

export class CrearCredenciales1791404490008 implements MigrationInterface {
  name = 'CrearCredenciales1791404490008';

  /**
   * La tabla de `auth`: un usuario, una credencial.
   *
   * ## `user_id` con índice único y SIN foreign key
   *
   * El `UNIQUE` sí, porque es la regla que hace que el login por correo sea
   * único: dos credenciales para el mismo usuario serían un login ambiguo.
   *
   * La foreign key **no**, y es la misma decisión que `profiles.user_id`:
   * declararla en la entidad obliga a un `@ManyToOne`, que ata la integridad de
   * la base a que la entidad mantenga ese import. Escrita a mano aquí y no
   * declarada allá, TypeORM no la conoce y cada `migration:generate` posterior
   * propone volver a crearla. Un esquema que no para de drift es peor que uno
   * sin integridad.
   *
   * ## `id` sin DEFAULT
   *
   * Lo pone la aplicación con `randomUUID()`, igual que `users.id` y
   * `profiles.id`. Insertar sin id falla con "null value in column id", que es lo
   * que se quiere: si el id existe en algún sitio, es el nuestro.
   *
   * ## No lleva `refresh_tokens`
   *
   * Los refresh tokens que emite `TokenService.issue()` los guarda
   * `@nestjs/authentication` en su propio storage, no en una tabla nuestra.
   *
   * Ahora van **en memoria**, que es lo que permite arrancar en desarrollo. En
   * producción el módulo **no arranca** sin un store registrado para cada
   * contrato que use, y cada login lee el de `mfa` aunque no haya segundo factor.
   * Los contratos son `sessions`, `refreshTokens`, `mfa`, `magicLinks`,
   * `oidcStates` y `emailTokens`. Eso es la fase 2 de `auth`, y está anotado en el
   * `AGENTS.md`.
   *
   * Consecuencia hasta entonces: cada reinicio cierra las sesiones abiertas.
   */
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "monolithschema"."credentials" ("id" uuid NOT NULL, "user_id" uuid NOT NULL, "password_hash" character varying(255) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_1e38bc43be6697cdda548ad27a6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_c68a6c53e95a7dc357f4ebce8f" ON "monolithschema"."credentials"  ("user_id") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "monolithschema"."IDX_c68a6c53e95a7dc357f4ebce8f"`,
    );
    await queryRunner.query(`DROP TABLE "monolithschema"."credentials"`);
  }
}
