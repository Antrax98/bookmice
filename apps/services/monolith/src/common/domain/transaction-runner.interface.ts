import { PersistenceScope } from './persistence-scope.interface';

/**
 * Abre una transacción y da un `PersistenceScope` dentro.
 *
 * ## Por qué existe, y no inyectar `DataSource` en los casos de uso
 *
 * `RegisterUseCase` necesita una transacción que abarque **tres** tablas de dos
 * módulos, y esa es la única forma de que el alta sea atómica. Podría inyectar
 * `DataSource` de TypeORM y hacer `dataSource.transaction(...)`, y durante un
 * tiempo fue eso lo que hice.
 *
 * **Rompe la generación del `openapi.json`.** `openapi-spec.module.ts` existe
 * justamente para no abrir conexión: es `AppModule` sin `DatabaseModule`, para
 * que `NestFactory.create` no conecte con Postgres al generar el contrato. Pero
 * un caso de uso que inyecta `DataSource` **no se puede instanciar** sin
 * `DatabaseModule`, y `NestFactory.create` instancia los providers aunque no se
 * llame a `listen()`.
 *
 * El fallo es `Nest can't resolve dependencies of the RegisterUseCase (?)`, con
 * `DataSource` en la lista de dependencias. Y no es solo este caso de uso: lo
 * mismo pasaría en cuanto cualquier caso de uso de cualquier módulo necesitara
 * una transacción.
 *
 * ## Cómo lo resuelve
 *
 * `DataSource` queda en `infrastructure`, que es la única capa que puede conocer
 * TypeORM. El caso de uso pide "abre una transacción y dame un ámbito", que es
 * `domain` hablando de transacciones sin saber quién las resuelve. Es el mismo
 * reparto que hace `PersistenceScope` con `save`.
 *
 * ## Lo que no hace
 *
 * No compone transacciones ni gestiona conexiones. Solo abre una. Si algún día
 * hace falta "dentro de esta transacción", eso es un método más aquí y un puerto
 * más en `domain`, no un `DataSource` en el caso de uso.
 */
export abstract class TransactionRunnerPort {
  /**
   * Ejecuta `operacion` dentro de una transacción y devuelve lo que devuelva.
   *
   * Si `operacion` lanza, la transacción se deshace **completa**: usuario,
   * perfil y credencial, que es el motivo de que esto exista.
   */
  abstract run<T>(
    operacion: (scope: PersistenceScope) => Promise<T>,
  ): Promise<T>;
}
