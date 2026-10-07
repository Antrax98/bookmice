import { MigrationInterface, QueryRunner } from 'typeorm';

export class IdEnLaApi17891392015858 implements MigrationInterface {
  name = 'IdEnLaApi17891392015858';

  /**
   * Quita el `DEFAULT gen_random_uuid()` de `id` en las dos tablas.
   *
   * Los UUID los genera ahora la aplicación con `randomUUID()`, en
   * `User.createNew` y `Profile.createNew`. La razón no es estética: si el id
   * existe antes del INSERT, el perfil se puede construir entero con su
   * `userId` real y validarlo antes de abrir la transacción. Con el default, el
   * `userId` solo se conocía después del primer INSERT.
   *
   * Las entidades pasaron de `@PrimaryGeneratedColumn('uuid')` a
   * `@PrimaryColumn('uuid')`, que en TypeORM significa "el valor lo pone el
   * código". Si alguna vuelve a `PrimaryGeneratedColumn`, esta migración se
   * deshace sola en el siguiente `migration:generate`.
   */
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "monolithschema"."profiles" ALTER COLUMN "id" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "monolithschema"."users" ALTER COLUMN "id" DROP DEFAULT`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // `gen_random_uuid()` y no `uuid_generate_v4()`: es la que lleva Postgres
    // de serie y no necesita la extensión `uuid-ossp` activada. Lo que generó
    // TypeORM generó `uuid_generate_v4()`, porque sin `uuidExtension` en las
    // opciones asume la extensión antigua.
    await queryRunner.query(
      `ALTER TABLE "monolithschema"."users" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()`,
    );
    await queryRunner.query(
      `ALTER TABLE "monolithschema"."profiles" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()`,
    );
  }
}