import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CredentialQueryPort } from '../../application/ports/credential-query.port';
import { CredentialProps } from '../../domain/interfaces/credential.interface';

@Injectable()
export class CredentialQueryAdapter implements CredentialQueryPort {
  /**
   * `DataSource` directo y **no** `@InjectRepository`, y la razón no es la
   * preferencia de estilo.
   *
   * `@InjectRepository` hace que Nest cree un repositorio a partir del
   * `TypeOrmModule.forFeature(...)`, que **necesita** el `DataSource` del módulo.
   * `openapi-spec.module.ts` existe precisamente para no tener
   * `DatabaseModule`, así que al generar el contrato fallaría con
   * `Nest can't resolve dependencies of the CredentialEntityRepository (?)`.
   *
   * Con `@InjectDataSource()` el token es `DataSource`, que sí está disponible
   * donde haya `DatabaseModule`, y **no** dispara la creación de repositorios al
   * montar un módulo sin base de datos. Es lo que ya hacen los cuatro
   * repositorios de `user`, y por eso el módulo de spec funciona con ellos.
   */
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * La credencial de ese correo, con su hash. `null` si no hay ninguna.
   *
   * ## `auth` lee una tabla de `user`, y hay que decirlo alto
   *
   * Es una dependencia de datos entre módulos. Se acepta por dos razones que
   * no son la misma:
   *
   * **Leer sí escala.** La frontera ya es el puerto, así que cuando `user` se
   * extraiga a un servicio, esta consulta se convierte en una llamada HTTP sin
   * tocar el método ni a quien lo llama.
   *
   * **Escribir en la misma transacción, no.** Eso no tiene traducción posible, y
   * por eso el alta abre `auth` la transacción y pide a `user` que escriba
   * dentro mediante `UserCreationPort`. La asimetría es real, y es el motivo de
   * que el puerto de escritura lleve `scope` y el de lectura no.
   *
   * ## Por qué una subconsulta y no un JOIN
   *
   * Por un fallo medido: TypeORM **no cualifica de schema** una tabla que se une
   * por nombre. Con `innerJoin('users', ...)` genera `INNER JOIN "users"` sin
   * `"monolithschema"`, y como `search_path` es `public` la tabla no existe ahí.
   * Postgres responde `syntax error at or near "."`.
   *
   * Un `innerJoin` por relación `@ManyToOne` sí la cualificaría, pero esa
   * relación no existe y no va a existir: implicaría la foreign key que este
   * esquema no tiene a propósito. Ver la entidad.
   *
   * Y hay una segunda razón, más de fondo: el JOIN obliga a nombrar la tabla de
   * `user` en el `FROM` y en la condición, y esa es justo la dependencia que se
   * quiere ver en un solo sitio. Con la subconsulta aparece una vez.
   */
  async findByEmail(email: string): Promise<CredentialProps | null> {
    // SQL directo y **no** `findOne` con un objeto `where`.
    //
    // Se probaron las dos vías de TypeORM y fallan las dos, cada una con su
    // error, y está medido:
    //
    // - `Raw` sin operador: TypeORM genera `WHERE (SELECT ...)` y Postgres
    //   responde `argument of WHERE must be type boolean, not type uuid`.
    // - `Raw` con el `=` puesto a mano: el operador queda duplicado y responde
    //   `syntax error at or near "="`.
    //
    // El SQL se escribe entero y se pasa por `query()`, que **sí** admite
    // parámetros. El `email` no se interpola con `${}` en ningún punto: va en el
    // array y el driver lo escapa. Con una interpolación sería una inyección
    // esperando su turno.
    //
    // Los alias van entre comillas dobles porque Postgres pasa los identificadores
    // sin ellos a minúsculas, y `"userId"` quedaría `"userid"`, que no existe.
    const [fila] = await this.dataSource.manager.query<CredentialProps[]>(
      `SELECT c.id AS "id",
              c.user_id AS "userId",
              c.password_hash AS "passwordHash",
              c.created_at AS "createdAt",
              c.updated_at AS "updatedAt"
         FROM "monolithschema"."credentials" c
        WHERE c.user_id = (
                SELECT u.id
                  FROM "monolithschema"."users" u
                 WHERE LOWER(u.email) = LOWER($1)
              )`,
      [email],
    );

    return fila ?? null;
  }
}
